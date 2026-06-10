import 'dart:io';
import 'dart:math';
import 'package:flutter/services.dart';
import 'package:flutter_litert/flutter_litert.dart';
import 'package:image/image.dart' as img;

class FaceRecognizer {
  static final FaceRecognizer _instance = FaceRecognizer._internal();
  factory FaceRecognizer() => _instance;
  FaceRecognizer._internal();

  Interpreter? _interpreter;
  bool _isModelLoaded = false;

  bool get isModelLoaded => _isModelLoaded;

  /// Load MobileFaceNet model from assets
  Future<void> loadModel() async {
    if (_isModelLoaded) return;
    try {
      final options = InterpreterOptions();
      // Use XNNPack delegate if available for faster CPU inference
      // options.addDelegate(XNNPackDelegate()); // Optional: can cause compatibility issues on older devices, let's omit for high stability
      
      _interpreter = await Interpreter.fromAsset(
        'assets/models/mobilefacenet.tflite',
        options: options,
      );
      _isModelLoaded = true;
      print('[FaceRecognizer] Model loaded successfully.');
    } catch (e) {
      print('[FaceRecognizer] Failed to load model: $e');
    }
  }

  /// Close the interpreter when no longer needed
  void dispose() {
    _interpreter?.close();
    _interpreter = null;
    _isModelLoaded = false;
  }

  /// Predict embedding from a face in an image file using its bounding box
  Future<List<double>?> predict(File imageFile, Rect? bbox) async {
    await loadModel();
    if (_interpreter == null) {
      throw Exception('Model TFLite FaceID belum berhasil diinisialisasi.');
    }

    try {
      // 1. Wait a moment for file to be ready and fully flushed to disk
      int retries = 5;
      while (retries > 0 && !(await imageFile.exists() && await imageFile.length() > 0)) {
        await Future.delayed(const Duration(milliseconds: 100));
        retries--;
      }

      if (!(await imageFile.exists())) {
        throw Exception('File foto tidak ditemukan di penyimpanan.');
      }

      final Uint8List bytes = await imageFile.readAsBytes();
      if (bytes.isEmpty) {
        throw Exception('File foto kosong (0 bytes).');
      }

      img.Image? originalImage = img.decodeImage(bytes);
      if (originalImage == null) {
        throw Exception('Format foto tidak valid atau gagal didekode.');
      }

      // Bake orientation to handle rotation from camera correctly
      originalImage = img.bakeOrientation(originalImage);

      // Dynamically get input and output tensor shapes to prevent dimension mismatches
      final inputTensor = _interpreter!.getInputTensor(0);
      final outputTensor = _interpreter!.getOutputTensor(0);
      final inputShape = inputTensor.shape; // e.g., [1, 112, 112, 3] or [112, 112, 3]
      final outputShape = outputTensor.shape; // e.g., [1, 192] or [192]

      // Safely parse dimensions from shapes
      int inputWidth = 112;
      int inputHeight = 112;
      int inputChannels = 3;

      if (inputShape.length == 4) {
        inputWidth = inputShape[1];
        inputHeight = inputShape[2];
        inputChannels = inputShape[3];
      } else if (inputShape.length == 3) {
        inputWidth = inputShape[0];
        inputHeight = inputShape[1];
        inputChannels = inputShape[2];
      }

      int outputSize = 192;
      if (outputShape.isNotEmpty) {
        outputSize = outputShape.length > 1 ? outputShape[1] : outputShape[0];
      }

      print('[FaceRecognizer] Running inference with dynamic config: Input ${inputWidth}x${inputHeight}x$inputChannels, Output $outputSize. Original Image: ${originalImage.width}x${originalImage.height}');

      // 2. Crop face region
      img.Image croppedFace;
      if (bbox != null) {
        int x = bbox.left.toInt();
        int y = bbox.top.toInt();
        int w = bbox.width.toInt();
        int h = bbox.height.toInt();

        // Clamp crop boundaries to image dimensions
        x = x.clamp(0, originalImage.width);
        y = y.clamp(0, originalImage.height);
        w = w.clamp(0, originalImage.width - x);
        h = h.clamp(0, originalImage.height - y);

        if (w > 10 && h > 10) {
          try {
            croppedFace = img.copyCrop(originalImage, x: x, y: y, width: w, height: h);
          } catch (cropErr) {
            print('[FaceRecognizer] Crop error, falling back to full image: $cropErr');
            croppedFace = originalImage;
          }
        } else {
          croppedFace = originalImage;
        }
      } else {
        // Crop center if no bbox is provided
        final int size = min(originalImage.width, originalImage.height);
        if (size > 0) {
          final int x = (originalImage.width - size) ~/ 2;
          final int y = (originalImage.height - size) ~/ 2;
          croppedFace = img.copyCrop(originalImage, x: x, y: y, width: size, height: size);
        } else {
          croppedFace = originalImage;
        }
      }

      // 3. Resize to model's expected dimensions
      final img.Image resizedFace = img.copyResize(croppedFace, width: inputWidth, height: inputHeight);

      // 4. Preprocess pixels (normalize: (val - 127.5) / 127.5) and construct nested input list
      final input3D = List.generate(
        inputHeight,
        (y) => List.generate(
          inputWidth,
          (x) {
            final pixel = resizedFace.getPixel(x, y);
            return [
              (pixel.r.toDouble() - 127.5) / 127.5,
              (pixel.g.toDouble() - 127.5) / 127.5,
              (pixel.b.toDouble() - 127.5) / 127.5,
            ];
          },
        ),
      );

      dynamic input;
      if (inputShape.length == 4) {
        input = [input3D];
      } else {
        input = input3D;
      }

      // 5. Preallocate output container matching expected output tensor shape
      dynamic output;
      if (outputShape.length == 2) {
        output = List.generate(1, (_) => List<double>.filled(outputSize, 0.0));
      } else {
        output = List<double>.filled(outputSize, 0.0);
      }

      // 6. Run TFLite inference
      try {
        _interpreter!.run(input, output);
      } catch (runErr) {
        throw Exception('Gagal menjalankan inferensi model TFLite: $runErr');
      }

      // Convert back to standard List<double> for downstream matching
      if (outputShape.length == 2) {
        return (output as List<List<double>>)[0];
      } else {
        return output as List<double>;
      }
    } catch (e) {
      print('[FaceRecognizer] Inference error: $e');
      throw Exception('Gagal memproses fitur wajah: $e');
    }
  }

  /// Calculate Euclidean Distance between two face embeddings
  double calculateDistance(List<double> emb1, List<double> emb2) {
    if (emb1.length != emb2.length) return double.maxFinite;
    double sum = 0.0;
    for (int i = 0; i < emb1.length; i++) {
      final double diff = emb1[i] - emb2[i];
      sum += diff * diff;
    }
    return sqrt(sum);
  }

  /// Calculate Cosine Similarity between two face embeddings
  /// Returns value between -1.0 (opposite) and 1.0 (identical)
  /// More robust against lighting and angle variations than Euclidean distance
  double cosineSimilarity(List<double> emb1, List<double> emb2) {
    if (emb1.length != emb2.length) return -1.0;
    double dotProduct = 0.0, norm1 = 0.0, norm2 = 0.0;
    for (int i = 0; i < emb1.length; i++) {
      dotProduct += emb1[i] * emb2[i];
      norm1 += emb1[i] * emb1[i];
      norm2 += emb2[i] * emb2[i];
    }
    if (norm1 == 0 || norm2 == 0) return 0.0;
    return dotProduct / (sqrt(norm1) * sqrt(norm2));
  }

  /// L2-normalize an embedding vector for better comparison
  List<double> l2Normalize(List<double> embedding) {
    double norm = 0.0;
    for (final v in embedding) {
      norm += v * v;
    }
    norm = sqrt(norm);
    if (norm == 0) return embedding;
    return embedding.map((v) => v / norm).toList();
  }

  /// Verification using a weighted scoring system to be more robust.
  /// Thresholds tuned for MobileFaceNet 192-dim embeddings on L2-normalized vectors.
  bool isMatch(List<double> emb1, List<double> emb2, {
    double euclideanThreshold = 0.88,
    double cosineThreshold = 0.68,
    double minCombinedScore = 0.68,
  }) {
    final norm1 = l2Normalize(emb1);
    final norm2 = l2Normalize(emb2);

    final double dist = calculateDistance(norm1, norm2);
    final double cosine = cosineSimilarity(norm1, norm2);

    // Convert Euclidean distance to a 0-1 similarity metric
    // L2 normalized distance ranges from 0 (identical) to 2 (opposite)
    final double euclideanSimilarity = 1.0 - (dist / 2.0);
    
    // Combine metrics: 60% Cosine Similarity, 40% Euclidean Similarity
    final double combinedScore = (cosine * 0.6) + (euclideanSimilarity * 0.4);

    // Detailed debug logs for visibility during testing
    print('[FaceRecognizer] Verification Metrics:');
    print('  - Euclidean Distance: ${dist.toStringAsFixed(4)} (Threshold: <= $euclideanThreshold)');
    print('  - Cosine Similarity: ${cosine.toStringAsFixed(4)} (Threshold: >= $cosineThreshold)');
    print('  - Combined Score: ${combinedScore.toStringAsFixed(4)} (Min required: $minCombinedScore)');

    // Pass if combined score is high enough, OR if both individual thresholds are met
    final bool match = combinedScore >= minCombinedScore || (dist <= euclideanThreshold && cosine >= cosineThreshold);
    print('  - Result: ${match ? "MATCH" : "MISMATCH"}');
    
    return match;
  }
}
