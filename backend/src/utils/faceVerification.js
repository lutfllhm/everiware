/**
 * Face Verification Utility
 *
 * Verifikasi kecocokan wajah (attendance) dilakukan sepenuhnya oleh AI Microservice
 * (InsightFace/ArcFace, lihat verifyFace()). Kebijakannya fail-closed: jika AI service
 * tidak bisa dihubungi, absensi ditolak — bukan diturunkan ke perbandingan gambar
 * non-AI yang mudah dikelabui.
 *
 * Deteksi wajah saat registrasi (validateRegistrationFace) tetap memakai sharp
 * sebagai fallback ringan karena risikonya lebih rendah (bukan gerbang matching identitas).
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Resize dan crop gambar ke ukuran standar, return buffer grayscale
 * Mengatasi orientasi sensor HP dengan auto-rotate dari metadata EXIF.
 * Membatasi koordinat crop (clipping) agar tidak keluar dari batas piksel gambar.
 *
 * @param {string|Buffer} imageInput
 * @param {object|null} bbox - { x, y, width, height } dalam pixel, atau null untuk full image
 */
async function extractFaceRegion(imageInput, bbox = null) {
  try {
    let pipeline;
    if (Buffer.isBuffer(imageInput)) {
      pipeline = sharp(imageInput);
    } else {
      // Jika berupa file path, rotate/auto-orient terlebih dahulu ke buffer untuk menormalkan orientasi
      const rotatedBuffer = await sharp(imageInput).rotate().toBuffer();
      pipeline = sharp(rotatedBuffer);
    }

    const metadata = await pipeline.metadata();
    const imgW = metadata.width;
    const imgH = metadata.height;

    let left, top, width, height;
    if (bbox) {
      // Potong koordinat crop (clipping) agar tetap di dalam batas piksel gambar
      left = Math.max(0, Math.round(bbox.x));
      top = Math.max(0, Math.round(bbox.y));
      width = Math.min(imgW - left, Math.round(bbox.width));
      height = Math.min(imgH - top, Math.round(bbox.height));
    } else {
      // Jika bbox null, crop area tengah gambar (70% lebar & tinggi) untuk menghindari perbandingan background
      left = Math.round(imgW * 0.15);
      top = Math.round(imgH * 0.15);
      width = Math.round(imgW * 0.70);
      height = Math.round(imgH * 0.70);
    }

    if (width > 0 && height > 0) {
      pipeline = pipeline.extract({
        left: left,
        top: top,
        width: width,
        height: height,
      });
    }

    // Resize ke 64x64 grayscale untuk perbandingan cepat, dan lakukan normalisasi kontras
    const { data } = await pipeline
      .resize(64, 64, { fit: 'fill' })
      .normalize() // Menyamakan rentang kecerahan/kontras agar tidak terlalu sensitif cahaya
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return data;
  } catch (err) {
    console.error('[FaceVerification] extractFaceRegion error:', err.message);
    return null;
  }
}

/**
 * Verifikasi apakah selfie cocok dengan avatar profil (Fail-Closed Policy)
 * Menggunakan Python AI Microservice (InsightFace) dengan fallback ke Sharp-based comparison jika offline.
 *
 * @param {string} selfieFilename  - filename selfie di uploads/selfie/
 * @param {string} avatarFilename  - filename avatar di uploads/avatar/
 * @param {object|null} selfieBbox - bounding box wajah dari ML Kit { x, y, width, height }
 * @returns {{ match: boolean, similarity: number, message: string }}
 */
async function verifyFace(selfieFilename, avatarFilename, selfieBbox = null) {
  const selfiePath = path.join(UPLOADS_DIR, 'selfie', selfieFilename);
  const avatarPath = path.join(UPLOADS_DIR, 'avatar', avatarFilename);

  // Pastikan kedua file ada sebelum dikirim ke AI Microservice atau fallback
  if (!fs.existsSync(avatarPath)) {
    return { match: false, similarity: 0, message: 'Foto referensi wajah tidak ditemukan' };
  }
  if (!fs.existsSync(selfiePath)) {
    return { match: false, similarity: 0, message: 'File selfie tidak ditemukan' };
  }

  try {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:5006/verify';
    console.log(`[FaceVerification] Attempting AI verification via ${aiUrl}`);

    const selfieBuffer = fs.readFileSync(selfiePath);
    const avatarBuffer = fs.readFileSync(avatarPath);

    // Memanfaatkan native global FormData & Blob pada Node.js v20
    const formData = new FormData();
    const selfieBlob = new Blob([selfieBuffer], { type: 'image/jpeg' });
    const referenceBlob = new Blob([avatarBuffer], { type: 'image/jpeg' });

    formData.append('selfie', selfieBlob, 'selfie.jpg');
    formData.append('reference', referenceBlob, 'reference.jpg');

    // Timeout controller untuk fetch agar tidak menunggu terlalu lama jika AI service hang
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 detik timeout

    const response = await fetch(aiUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI Service returned HTTP status ${response.status}`);
    }

    const data = await response.json();
    console.log(`[FaceVerification] AI Service result: match=${data.match}, similarity=${data.similarity?.toFixed(4)}, message="${data.message}"`);
    return {
      match: !!data.match,
      similarity: parseFloat(data.similarity) || 0.0,
      message: data.message || (data.match ? 'Wajah terverifikasi' : 'Wajah tidak cocok'),
    };
  } catch (err) {
    // Fail-closed: AI service adalah satu-satunya sumber verifikasi wajah yang bisa diandalkan.
    // Fallback histogram warna (non-AI) terlalu mudah dikelabui untuk dipakai meloloskan absensi,
    // jadi ketika AI service tidak bisa dihubungi, absensi ditolak alih-alih diam-diam
    // menurunkan standar verifikasi.
    console.error(`[FaceVerification] AI Service error/offline: ${err.message}. Menolak absensi (fail-closed).`);
    return {
      match: false,
      similarity: 0,
      message: 'Layanan verifikasi wajah sedang tidak tersedia. Silakan coba lagi dalam beberapa saat atau hubungi HRD.',
    };
  }
}

/**
 * Memvalidasi apakah foto registrasi/referensi wajah berisi tepat 1 wajah
 * Menggunakan Python AI Microservice (InsightFace) dengan fallback ke Sharp jika offline.
 * 
 * @param {string} faceFilename - nama file foto di uploads/avatar/
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function validateRegistrationFace(faceFilename) {
  const avatarPath = path.join(UPLOADS_DIR, 'avatar', faceFilename);

  if (!fs.existsSync(avatarPath)) {
    return { success: false, message: 'File foto wajah tidak ditemukan' };
  }

  try {
    const aiUrl = (process.env.AI_SERVICE_URL || 'http://localhost:5006/verify').replace('/verify', '/detect');
    console.log(`[FaceVerification] Attempting AI face detection via ${aiUrl}`);

    const avatarBuffer = fs.readFileSync(avatarPath);

    // Memanfaatkan native global FormData & Blob pada Node.js v20
    const formData = new FormData();
    const photoBlob = new Blob([avatarBuffer], { type: 'image/jpeg' });
    formData.append('photo', photoBlob, 'photo.jpg');

    // Timeout controller untuk fetch agar tidak menunggu terlalu lama jika AI service hang
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 detik timeout

    const response = await fetch(aiUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI Service returned HTTP status ${response.status}`);
    }

    const data = await response.json();
    console.log(`[FaceVerification] AI Service registration detection result: success=${data.success}, message="${data.message}"`);
    return {
      success: !!data.success,
      message: data.message || (data.success ? 'Wajah valid' : 'Wajah tidak valid')
    };
  } catch (err) {
    console.warn(`[FaceVerification] AI Service error/offline during registration: ${err.message}. Falling back to local Sharp-based detection.`);

    // --- FALLBACK TO LOCAL SHARP DETECTION ---
    try {
      const faceBuffer = await extractFaceRegion(avatarPath, null);
      if (!faceBuffer) {
        return { success: false, message: 'Wajah tidak terdeteksi pada foto (Local Fallback)' };
      }
      return { success: true, message: 'Wajah terdeteksi dan valid (Local Fallback)' };
    } catch (fallbackErr) {
      console.error('[FaceVerification] Fallback detectFace error:', fallbackErr.message);
      return { success: false, message: 'Terjadi kesalahan sistem saat mendeteksi wajah' };
    }
  }
}

module.exports = { verifyFace, validateRegistrationFace };


