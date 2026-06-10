import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../models/user_model.dart';
import '../../utils/app_theme.dart';
import '../../services/face_recognizer.dart';
import '../../services/biometric_service.dart';

class IntroScreen extends StatefulWidget {
  const IntroScreen({super.key});

  @override
  State<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends State<IntroScreen> with TickerProviderStateMixin {
  late AnimationController _rotationController;
  late AnimationController _pulseController;
  late AnimationController _progressController;
  late AnimationController _scanLineController;
  final PageController _pageController = PageController();
  int _currentPage = 0;
  bool _cameraInitialized = false;

  String? _tempPassword;
  bool _canEnableLocalBiometric = false;

  // Camera & Face states
  CameraController? _cameraController;
  XFile? _photo;
  bool _detectingFace = false;
  bool _faceDetected = false;
  bool _submitting = false;
  String? _cameraError;
  String? _faceError;
  late final FaceDetector _faceDetector;

  // iOS FaceID Biometric Scan State
  bool _isScanning = false;
  double _scanProgress = 0.0;
  XFile? _straightPhoto;
  Rect? _straightFaceBbox;
  String? _statusText = 'Posisikan wajah Anda di dalam lingkaran';
  int _scanState = 0; // 0 = Idle/Repositioning, 1 = Scanning, 2 = Success, 3 = Error

  bool _autoCaptureRunning = false;

  void _safeDeleteFile(String path) {
    try {
      final file = File(path);
      if (file.existsSync()) {
        file.deleteSync();
      }
    } catch (_) {}
  }

  void _triggerAutoCaptureLoop() {
    if (_autoCaptureRunning) return;
    if (_currentPage == 2 && _cameraInitialized && _photo == null && !_detectingFace && !_submitting && _scanState == 0) {
      _startAutoCaptureLoop();
    }
  }

  Future<void> _startAutoCaptureLoop() async {
    _autoCaptureRunning = true;
    while (mounted && _currentPage == 2 && _photo == null && _scanState == 0) {
      if (_cameraController != null && 
          _cameraController!.value.isInitialized && 
          !_detectingFace && 
          !_submitting &&
          !_isScanning) {
        await _captureAndDetect();
      }
      await Future.delayed(const Duration(milliseconds: 1200));
    }
    _autoCaptureRunning = false;
  }

  void _resetScan() {
    setState(() {
      _scanState = 0;
      _isScanning = false;
      _scanProgress = 0.0;
      _straightPhoto = null;
      _straightFaceBbox = null;
      _faceError = null;
      _faceDetected = false;
      _statusText = 'Posisikan wajah Anda di dalam lingkaran';
    });
    _triggerAutoCaptureLoop();
  }

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );

    _scanLineController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _faceDetector = FaceDetector(
      options: FaceDetectorOptions(
        enableClassification: false,
        enableLandmarks: false,
        enableContours: false,
        enableTracking: false,
        minFaceSize: 0.15,
        performanceMode: FaceDetectorMode.accurate,
      ),
    );
    _checkTempPassword();
  }

  @override
  void dispose() {
    _rotationController.dispose();
    _pulseController.dispose();
    _progressController.dispose();
    _scanLineController.dispose();
    _pageController.dispose();
    _cameraController?.dispose();
    _faceDetector.close();
    super.dispose();
  }

  Future<void> _initCamera() async {
    if (_cameraInitialized) return;
    setState(() {
      _cameraError = null;
    });

    List<CameraDescription> cameras = [];
    try {
      cameras = await availableCameras();
    } catch (e) {
      setState(() => _cameraError = 'Kamera tidak tersedia');
      return;
    }

    if (cameras.isEmpty) {
      setState(() => _cameraError = 'Kamera tidak ditemukan');
      return;
    }

    final frontCamera = cameras.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.front,
      orElse: () => cameras.first,
    );

    try {
      _cameraController = CameraController(
        frontCamera,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await _cameraController!.initialize();
      if (mounted) {
        setState(() {
          _cameraInitialized = true;
        });
        _triggerAutoCaptureLoop();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _cameraError = 'Gagal menginisialisasi kamera: $e');
      }
    }
  }

  Future<void> _captureAndDetect() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) return;
    if (_detectingFace || _isScanning || _scanState != 0) return;

    setState(() {
      _detectingFace = true;
      _faceError = null;
      _faceDetected = false;
    });

    try {
      final photo = await _cameraController!.takePicture();
      final inputImage = InputImage.fromFilePath(photo.path);
      final faces = await _faceDetector.processImage(inputImage);

      if (!mounted) return;
      if (faces.isEmpty) {
        _safeDeleteFile(photo.path);
        setState(() {
          _photo = null;
          _faceDetected = false;
          _faceError = 'Wajahmu nggak kelihatan nih. 🧐 Yuk, pas-in posisi wajahmu di dalam lingkaran!';
          _detectingFace = false;
        });
        return;
      }
      final face = faces.first;
      
      // Trigger haptic feedback
      HapticFeedback.lightImpact();

      setState(() {
        _isScanning = true;
        _scanState = 1; // Scanning
        _faceDetected = true;
        _faceError = null;
        _detectingFace = false;
        _straightPhoto = photo;
        _straightFaceBbox = face.boundingBox;
        _statusText = 'Memindai wajah tampan/cantikmu... 📸 Tetap diam ya!';
      });

      // Animate progress from 0 to 1
      _progressController.reset();
      _progressController.addListener(() {
        if (mounted) {
          setState(() {
            _scanProgress = _progressController.value;
          });
        }
      });

      await _progressController.forward();

      if (!mounted) return;

      // Scanning completed successfully!
      HapticFeedback.mediumImpact();
      setState(() {
        _scanState = 2; // Success
        _statusText = 'Pemindaian selesai! Mantap! 🎉';
      });

      // Wait 1 second to display the successful scan checkmark
      await Future.delayed(const Duration(milliseconds: 1000));
      
      if (!mounted) return;
      await _submitFaceReference();

    } catch (e) {
      if (mounted) {
        setState(() {
          _faceError = 'Waduh, gagal mendeteksi wajahmu: $e 🥺';
          _detectingFace = false;
          _scanState = 3; // Error
        });
      }
    }
  }

  Future<void> _submitFaceReference() async {
    if (_straightPhoto == null) return;

    final auth = context.read<AuthProvider>();
    final user = auth.user;
    if (user == null) return;

    final scaffoldMessenger = ScaffoldMessenger.of(context);

    setState(() => _submitting = true);

    try {
      final file = File(_straightPhoto!.path);

      // Extract embedding locally using TFLite FaceRecognizer
      final embedding = await FaceRecognizer().predict(file, _straightFaceBbox);
      if (embedding == null) {
        throw Exception('Gagal memproses fitur wajahmu. 🥺 Pastikan pencahayaannya cukup terang ya!');
      }

      final res = await ApiService().registerFace(file);

      if (res['success'] == true && res['user'] != null) {
        final updatedUser = UserModel.fromJson(res['user']);
        // Save face embedding locally
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('face_embedding_${user.id}', jsonEncode(embedding));
        await prefs.setString('face_embedding_avatar_${user.id}', updatedUser.facePhoto ?? updatedUser.avatar ?? '');
        // Update user state di AuthProvider
        auth.updateUser(updatedUser);

        // Tampilkan feedback sukses
        scaffoldMessenger.showSnackBar(
          const SnackBar(
            content: Text('Registrasi wajah berhasil! Selamat bekerja.'),
            backgroundColor: AppColors.success,
          ),
        );

        // Masuk ke slide sukses
        if (mounted) {
          _pageController.animateToPage(
            3,
            duration: const Duration(milliseconds: 500),
            curve: Curves.easeInOutCubic,
          );
        }
      } else {
        throw Exception(res['message'] ?? 'Gagal menyimpan wajah referensi');
      }
    } catch (e) {
      setState(() {
        _scanState = 3; // Error
        _faceError = e.toString().replaceAll('Exception: ', '');
      });
      _safeDeleteFile(_straightPhoto!.path);
      _straightPhoto = null;
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _checkTempPassword() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final tempPass = prefs.getString('temp_login_pass');
      final bioAvail = await BiometricService().isAvailable();
      final bioEnabled = await BiometricService().isEnabled();
      if (mounted) {
        setState(() {
          _tempPassword = tempPass;
          _canEnableLocalBiometric = bioAvail && !bioEnabled && tempPass != null;
        });
      }
    } catch (_) {}
  }

  Future<void> _setupLocalBiometrics() async {
    if (_tempPassword == null) return;
    final auth = context.read<AuthProvider>();
    final user = auth.user;
    if (user == null) return;

    setState(() => _submitting = true);

    try {
      final success = await BiometricService().enable(user.email, _tempPassword!);
      if (success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Login biometrik HP berhasil diaktifkan!'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Gagal mengaktifkan biometrik perangkat.'),
              backgroundColor: AppColors.danger,
            ),
          );
        }
      }
    } catch (_) {}

    // Clear temp password and navigate to /home
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('temp_login_pass');

    if (mounted) {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  Future<void> _skipLocalBiometrics() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('temp_login_pass');
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  Widget _buildStepIndicator() {
    if (_currentPage >= 3) return const SizedBox.shrink();
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(3, (index) {
        final active = index == _currentPage;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: active ? 24 : 8,
          height: 8,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: active ? const Color(0xFFEF5350) : Colors.white24,
          ),
        );
      }),
    );
  }

  Widget _buildWelcomeSlide() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 20.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Glowing welcome icon
            Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 140,
                  height: 140,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withOpacity(0.02),
                  ),
                ),
                Container(
                  width: 110,
                  height: 110,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        const Color(0xFFEF5350).withOpacity(0.15),
                        Colors.transparent,
                      ],
                      radius: 0.8,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.04),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withOpacity(0.08),
                      width: 1.5,
                    ),
                  ),
                  child: const Icon(
                    Icons.waving_hand_rounded,
                    color: Colors.white,
                    size: 56,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            const Text(
              'Selamat Datang!',
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Everiware adalah platform kehadiran digital modern Anda. Aplikasi ini membantu mencatat waktu kerja Anda secara efisien, transparan, dan aman.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.65),
                fontSize: 14,
                height: 1.6,
              ),
            ),
            const SizedBox(height: 36),
            _buildFeatureRow(Icons.check_circle_outline, 'Presensi Instan & Mudah'),
            const SizedBox(height: 12),
            _buildFeatureRow(Icons.map_outlined, 'Verifikasi Lokasi Kerja GPS'),
            const SizedBox(height: 12),
            _buildFeatureRow(Icons.notifications_active_outlined, 'Notifikasi Informasi Instan'),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureRow(IconData icon, String text) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.03),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.06)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF5350).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: const Color(0xFFEF5350), size: 18),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  text,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSecuritySlide() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 20.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Glowing shield icon
            Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 140,
                  height: 140,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withOpacity(0.02),
                  ),
                ),
                Container(
                  width: 110,
                  height: 110,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        const Color(0xFFEF5350).withOpacity(0.15),
                        Colors.transparent,
                      ],
                      radius: 0.8,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.04),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withOpacity(0.08),
                      width: 1.5,
                    ),
                  ),
                  child: const Icon(
                    Icons.shield_outlined,
                    color: Colors.white,
                    size: 56,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            const Text(
              'Verifikasi Wajah & Keamanan',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Untuk menjaga integritas data absensi dan mencegah penyalahgunaan akun, kehadiran Anda divalidasi menggunakan deteksi wajah kecerdasan buatan.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.65),
                fontSize: 14,
                height: 1.6,
              ),
            ),
            const SizedBox(height: 36),
            _buildInfoBox(
              Icons.face_unlock_outlined,
              'Satu Wajah per Akun',
              'Wajah Anda yang terdaftar pada langkah berikutnya akan menjadi satu-satunya wajah yang dapat melakukan absensi pada akun ini.',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoBox(IconData icon, String title, String desc) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.03),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.06)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF5350).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: const Color(0xFFEF5350), size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      desc,
                      style: TextStyle(color: Colors.white.withOpacity(0.55), fontSize: 12, height: 1.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSuccessSlide() {
    return Center(
      child: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Large glowing checkmark
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.green.withOpacity(0.1),
                  border: Border.all(
                    color: Colors.green.withOpacity(0.4),
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.green.withOpacity(0.2),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: Colors.green,
                  size: 80,
                ),
              ),
              const SizedBox(height: 32),
              const Text(
                'Registrasi Berhasil!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Wajah Anda telah berhasil didaftarkan sebagai referensi absensi biometrik.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.65),
                  fontSize: 14,
                  height: 1.6,
                ),
              ),

              if (_canEnableLocalBiometric) ...[
                const SizedBox(height: 40),
                // Lock screen biometric activation card
                ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: BackdropFilter(
                    filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.04),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.1),
                          width: 1.5,
                        ),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEF5350).withOpacity(0.1),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.fingerprint_rounded,
                                  color: Color(0xFFEF5350),
                                  size: 28,
                                ),
                              ),
                              const SizedBox(width: 16),
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Login Cepat Biometrik',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    SizedBox(height: 4),
                                    Text(
                                      'Masuk aplikasi instan dengan sidik jari/wajah bawaan HP.',
                                      style: TextStyle(
                                        color: Colors.white60,
                                        fontSize: 11,
                                        height: 1.4,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: double.infinity,
                            height: 48,
                            child: ElevatedButton(
                              onPressed: _setupLocalBiometrics,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFEF5350),
                                foregroundColor: Colors.white,
                                elevation: 4,
                                shadowColor: const Color(0xFFEF5350).withOpacity(0.5),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: const Text(
                                'Aktifkan Biometrik HP',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 32),

              // Skip/finish button
              TextButton(
                onPressed: _skipLocalBiometrics,
                style: TextButton.styleFrom(
                  foregroundColor: Colors.white70,
                ),
                child: Text(
                  _canEnableLocalBiometric ? 'Nanti Saja / Masuk Beranda' : 'Masuk ke Beranda',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCameraSlide() {
    if (!_cameraInitialized && _cameraError == null) {
      _initCamera();
    }

    return LayoutBuilder(builder: (context, constraints) {
      final boxW = constraints.maxWidth;

      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 12.0),
        child: Column(
          children: [
            const Text(
              'Registrasi Wajah',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Verifikasi biometrik wajah Anda untuk keamanan dan akurasi presensi.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.6),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 30),

            // Circular Camera Viewport (FaceID Style)
            Expanded(
              child: Center(
                child: _cameraError != null
                    ? _buildCameraErrorWidget()
                    : _photo != null
                        ? _buildPhotoPreviewWidgetCircular(boxW * 0.72)
                        : _buildCameraPreviewWidgetCircular(constraints, boxW * 0.72),
              ),
            ),
            const SizedBox(height: 20),

            _buildFaceStatusWidget(),
            
            // Try Again button if scan failed (state == 3)
            if (_scanState == 3) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: 200,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: _resetScan,
                  icon: const Icon(Icons.refresh_rounded, color: Color(0xFF6B0E11)),
                  label: const Text('Coba Lagi', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF6B0E11),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20),
          ],
        ),
      );
    });
  }

  Widget _buildCameraErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.camera_alt_outlined, color: Colors.white38, size: 48),
            const SizedBox(height: 12),
            Text(
              _cameraError!,
              style: const TextStyle(color: Colors.white70, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _initCamera,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF5350),
                foregroundColor: Colors.white,
              ),
              child: const Text('Coba Lagi'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotoPreviewWidgetCircular(double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white.withOpacity(0.08), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipOval(
            child: Image.file(File(_photo!.path), fit: BoxFit.cover),
          ),
          ClipOval(
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    Colors.transparent,
                    Colors.black.withOpacity(0.15),
                    Colors.black.withOpacity(0.40),
                  ],
                  stops: const [0.6, 0.85, 1.0],
                ),
              ),
            ),
          ),
          if (_detectingFace)
            ClipOval(
              child: Container(
                color: Colors.black54,
                child: const Center(
                  child: CircularProgressIndicator(color: Colors.white),
                ),
              ),
            ),
          CustomPaint(
            size: Size(size, size),
            painter: _FaceIDScannerPainter(
              scanState: _scanState,
              faceDetected: true,
              rotationValue: 0.0,
              pulseValue: 0.0,
              scanProgress: 1.0,
              scanLineValue: 0.0,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCameraPreviewWidgetCircular(BoxConstraints constraints, double size) {
    if (_cameraController?.value.isInitialized != true) {
      return const Center(child: CircularProgressIndicator(color: Colors.white));
    }

    final previewSize = _cameraController!.value.previewSize!;
    final camW = previewSize.height;
    final camH = previewSize.width;
    final camAspect = camW / camH;

    double scale = 1.0;
    if (camAspect > 1.0) {
      scale = size / (size / camAspect);
    } else {
      scale = size / (size * camAspect);
    }
    if (scale < 1.0) scale = 1.0;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white.withOpacity(0.08), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          ClipOval(
            child: SizedBox(
              width: size,
              height: size,
              child: Transform.scale(
                scale: scale,
                child: Center(child: CameraPreview(_cameraController!)),
              ),
            ),
          ),
          ClipOval(
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    Colors.transparent,
                    Colors.black.withOpacity(0.15),
                    Colors.black.withOpacity(0.40),
                  ],
                  stops: const [0.6, 0.85, 1.0],
                ),
              ),
            ),
          ),
          AnimatedBuilder(
            animation: Listenable.merge([_rotationController, _pulseController, _progressController, _scanLineController]),
            builder: (context, child) {
              return CustomPaint(
                size: Size(size, size),
                painter: _FaceIDScannerPainter(
                  scanState: _scanState,
                  faceDetected: _faceDetected,
                  rotationValue: _rotationController.value,
                  pulseValue: _pulseController.value,
                  scanProgress: _scanProgress,
                  scanLineValue: _scanLineController.value,
                ),
              );
            },
          ),
          Positioned(
            bottom: 20,
            child: Center(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: BackdropFilter(
                  filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.45),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.12)),
                    ),
                    child: Text(
                      _scanState == 1
                          ? 'Tetap diam, memindai...'
                          : _scanState == 2
                              ? 'Pemindaian sukses!'
                              : _scanState == 3
                                  ? 'Pemindaian gagal'
                                  : 'Hadap depan & lurus',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFaceStatusWidget() {
    if (_faceError == null && _scanState == 0) return const SizedBox.shrink();
    
    final isSuccess = _scanState == 2 || _scanState == 1;
    final isError = _scanState == 3;
    
    Color statusColor = const Color(0xFF00E5FF); // Blue for scanning
    if (_scanState == 2) statusColor = const Color(0xFF00FF66); // Green for success
    if (isError) statusColor = AppColors.danger; // Red for error
    
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: statusColor.withOpacity(0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: statusColor.withOpacity(0.4),
              width: 1.5,
            ),
          ),
          child: Row(
            children: [
              if (_submitting)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              else
                Icon(
                  _scanState == 2
                      ? Icons.check_circle_rounded
                      : isError
                          ? Icons.warning_rounded
                          : Icons.face_retouching_natural_rounded,
                  color: statusColor,
                  size: 20,
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  _submitting
                      ? 'Menyimpan wajah referensi ke server...'
                      : isError
                          ? (_faceError ?? 'Terjadi kesalahan.')
                          : _scanState == 2
                              ? 'Pemindaian Wajah Sukses!'
                              : _statusText ?? '',
                  style: TextStyle(
                    color: isError
                        ? const Color(0xFFFFB9B9)
                        : _scanState == 2
                            ? const Color(0xFFB9FFD2)
                            : const Color(0xFFB9E5FF),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        height: double.infinity,
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Color(0xFF6B0E11), // Top deep red
              Color(0xFF380507), // Mid dark red
              Color(0xFF160102), // Bottom almost black
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Header & Logo
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Image.asset(
                          'assets/images/logo.png',
                          width: 28,
                          height: 28,
                          errorBuilder: (_, __, ___) => const Icon(Icons.security, color: Colors.white),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'EVERIWARE',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                            fontStyle: FontStyle.italic,
                            fontFamily: 'Usuzi',
                          ),
                        ),
                      ],
                    ),
                    // Tombol Keluar (jika salah akun)
                    TextButton.icon(
                      onPressed: () async {
                        final auth = context.read<AuthProvider>();
                        final navigator = Navigator.of(context);
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            title: const Text('Keluar dari Akun?', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                            content: const Text('Anda akan keluar dari sesi login saat ini.', style: TextStyle(fontSize: 13)),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
                              ElevatedButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6B0E11), foregroundColor: Colors.white),
                                child: const Text('Keluar'),
                              ),
                            ],
                          ),
                        );
                        if (ok == true) {
                          await auth.logout();
                          navigator.pushReplacementNamed('/login');
                        }
                      },
                      icon: const Icon(Icons.logout_rounded, color: Colors.white60, size: 16),
                      label: const Text('Keluar', style: TextStyle(color: Colors.white60, fontSize: 12)),
                    ),
                  ],
                ),
              ),

              // PageView Slides
              Expanded(
                child: PageView(
                  controller: _pageController,
                  physics: const NeverScrollableScrollPhysics(), // Paksa alur runtut, tidak bisa di-swipe manual
                  onPageChanged: (page) {
                    setState(() {
                      _currentPage = page;
                    });
                    if (page == 2) {
                      _triggerAutoCaptureLoop();
                    }
                  },
                  children: [
                    _buildWelcomeSlide(),
                    _buildSecuritySlide(),
                    _buildCameraSlide(),
                    _buildSuccessSlide(),
                  ],
                ),
              ),

              // Bottom control bar (indicator & next buttons)
              Padding(
                padding: const EdgeInsets.fromLTRB(28, 12, 28, 28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildStepIndicator(),
                    const SizedBox(height: 24),
                    if (_currentPage < 2)
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          onPressed: () {
                            HapticFeedback.lightImpact();
                            _pageController.nextPage(
                              duration: const Duration(milliseconds: 300),
                              curve: Curves.easeInOut,
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFF6B0E11),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'Lanjutkan',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, letterSpacing: 0.3),
                              ),
                              SizedBox(width: 8),
                              Icon(Icons.arrow_forward_rounded, size: 18),
                            ],
                          ),
                        ),
                      )
                    else
                      const SizedBox.shrink(), // Kontrol kamera ada di dalam slide 3
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FaceIDScannerPainter extends CustomPainter {
  final int scanState;
  final bool faceDetected;
  final double rotationValue;
  final double pulseValue;
  final double scanProgress;
  final double scanLineValue;

  _FaceIDScannerPainter({
    required this.scanState,
    required this.faceDetected,
    required this.rotationValue,
    required this.pulseValue,
    required this.scanProgress,
    required this.scanLineValue,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final double radius = size.width / 2;
    final center = Offset(radius, radius);
    final rect = Rect.fromCircle(center: center, radius: radius + 4);

    // Color based on scanState
    Color themeColor;
    if (scanState == 2) {
      themeColor = const Color(0xFF00FF66); // Success Green
    } else if (scanState == 3) {
      themeColor = const Color(0xFFEF5350); // Fail Red
    } else if (scanState == 1) {
      themeColor = const Color(0xFF00FF66); // Scanning Green
    } else {
      themeColor = faceDetected ? const Color(0xFF00FF66) : const Color(0xFF00E5FF); // Blue or Green
    }

    // 1. Draw glowing outer scanning ring progress
    final progressPaint = Paint()
      ..color = themeColor.withOpacity(0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.0;
    canvas.drawCircle(center, radius + 4, progressPaint);

    if (scanState == 1 && scanProgress > 0) {
      // Draw progress arc
      final activeProgressPaint = Paint()
        ..color = const Color(0xFF00FF66)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4.0
        ..strokeCap = StrokeCap.round
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2.0);
      
      canvas.drawArc(
        rect,
        -pi / 2, // Start from top
        2 * pi * scanProgress,
        false,
        activeProgressPaint,
      );
    } else if (scanState == 2) {
      // Solid green ring
      final successRingPaint = Paint()
        ..color = const Color(0xFF00FF66)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4.0
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5);
      canvas.drawCircle(center, radius + 4, successRingPaint);
    }

    // 2. Draw rotating dotted/dashed outer ring (high-tech iOS scanner feel)
    final rotatePaint = Paint()
      ..color = themeColor.withOpacity(0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    const double dashAngle = 8.0;
    const double spaceAngle = 8.0;
    const int dashCount = 360 ~/ (dashAngle + spaceAngle);
    
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(rotationValue * 2 * pi); // rotate based on rotation animation
    
    for (int i = 0; i < dashCount; i++) {
      final double startAngle = (i * (dashAngle + spaceAngle)) * pi / 180.0;
      final double sweepAngle = dashAngle * pi / 180.0;
      canvas.drawArc(
        Rect.fromCircle(center: Offset.zero, radius: radius + 14),
        startAngle,
        sweepAngle,
        false,
        rotatePaint,
      );
    }
    canvas.restore();

    // 3. Inner scanning ring indicator
    final innerPaint = Paint()
      ..color = Colors.white.withOpacity(0.04)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    canvas.drawCircle(center, radius - 8, innerPaint);

    // 4. Draw horizontal scanning laser line (sweeping up and down)
    if (scanState == 1) {
      final laserPaint = Paint()
        ..shader = LinearGradient(
          colors: [
            const Color(0xFF00FF66).withOpacity(0.0),
            const Color(0xFF00FF66).withOpacity(0.8),
            const Color(0xFF00FF66).withOpacity(0.0),
          ],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ).createShader(Rect.fromLTWH(center.dx - radius, 0, radius * 2, 0))
        ..strokeWidth = 3.0
        ..strokeCap = StrokeCap.round;

      // Calculate Y coordinate based on scanLineValue
      final double laserY = center.dy - radius + (radius * 2 * scanLineValue);
      // Draw horizontal line bounded by the circle
      final double halfWidth = sqrt(pow(radius, 2) - pow(laserY - center.dy, 2)) * 0.95;
      
      canvas.drawLine(
        Offset(center.dx - halfWidth, laserY),
        Offset(center.dx + halfWidth, laserY),
        laserPaint,
      );

      // Draw subtle neon shading below the laser line
      final glowPaint = Paint()
        ..color = const Color(0xFF00FF66).withOpacity(0.05)
        ..style = PaintingStyle.fill;
      final glowPath = Path()
        ..moveTo(center.dx - halfWidth, laserY)
        ..lineTo(center.dx + halfWidth, laserY)
        ..arcToPoint(
          Offset(center.dx - halfWidth, laserY),
          radius: Radius.circular(radius),
          clockwise: false,
        );
      canvas.drawPath(glowPath, glowPaint);
    }

    // 5. Draw face stencil silhouette to guide user
    _drawFaceStencil(canvas, center, radius, themeColor);

    // 6. Draw Animated Checkmark on success
    if (scanState == 2) {
      final checkPaint = Paint()
        ..color = const Color(0xFF00FF66)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6.0
        ..strokeCap = StrokeCap.round;

      final path = Path();
      path.moveTo(center.dx - radius * 0.25, center.dy);
      path.lineTo(center.dx - radius * 0.05, center.dy + radius * 0.18);
      path.lineTo(center.dx + radius * 0.3, center.dy - radius * 0.18);

      canvas.drawPath(path, checkPaint);
    }
  }

  void _drawFaceStencil(Canvas canvas, Offset center, double radius, Color themeColor) {
    final stencilPaint = Paint()
      ..color = themeColor.withOpacity(faceDetected ? (0.20 + pulseValue * 0.15) : (0.12 + pulseValue * 0.08))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    final path = Path();
    final double headW = radius * 0.44;
    final double headH = radius * 0.60;
    
    // Draw outer head outline (U-shaped chin and round top)
    path.moveTo(center.dx - headW, center.dy - headH * 0.1);
    
    // Left ear area curve down to chin
    path.cubicTo(
      center.dx - headW, center.dy + headH * 0.38,
      center.dx - headW * 0.5, center.dy + headH * 0.72,
      center.dx, center.dy + headH * 0.72,
    );
    
    // Chin bottom curve up to right ear
    path.cubicTo(
      center.dx + headW * 0.5, center.dy + headH * 0.72,
      center.dx + headW, center.dy + headH * 0.38,
      center.dx + headW, center.dy - headH * 0.1,
    );
    
    // Top of head curve
    path.cubicTo(
      center.dx + headW, center.dy - headH * 0.60,
      center.dx - headW, center.dy - headH * 0.60,
      center.dx - headW, center.dy - headH * 0.1,
    );

    // Subtle face feature guide marks (hairline, eyes alignment line)
    final eyeLinePath = Path()
      ..moveTo(center.dx - headW * 0.5, center.dy)
      ..lineTo(center.dx - headW * 0.15, center.dy)
      ..moveTo(center.dx + headW * 0.15, center.dy)
      ..lineTo(center.dx + headW * 0.5, center.dy);

    final nosePath = Path()
      ..moveTo(center.dx, center.dy - headH * 0.12)
      ..lineTo(center.dx, center.dy + headH * 0.08)
      ..lineTo(center.dx + headW * 0.10, center.dy + headH * 0.08);

    canvas.drawPath(path, stencilPaint);
    
    final guidePaint = Paint()
      ..color = stencilPaint.color.withOpacity(stencilPaint.color.opacity * 0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    canvas.drawPath(eyeLinePath, guidePaint);
    canvas.drawPath(nosePath, guidePaint);
  }

  @override
  bool shouldRepaint(_FaceIDScannerPainter oldDelegate) {
    return oldDelegate.scanState != scanState || 
           oldDelegate.faceDetected != faceDetected ||
           oldDelegate.rotationValue != rotationValue ||
           oldDelegate.pulseValue != pulseValue ||
           oldDelegate.scanProgress != scanProgress ||
           oldDelegate.scanLineValue != scanLineValue;
  }
}
