/**
 * Face Verification Utility — menggunakan sharp (pure JS, no native AI)
 *
 * Cara kerja:
 * 1. Flutter mengirim koordinat bounding box wajah dari ML Kit (selfie)
 * 2. Backend crop region wajah dari selfie dan avatar profil
 * 3. Bandingkan histogram warna (HSV) dari kedua crop
 * 4. Jika similarity cukup tinggi → wajah dianggap cocok
 *
 * Ini bukan face recognition berbasis AI, tapi cukup untuk mendeteksi
 * perbedaan orang yang jelas (warna kulit, rambut, proporsi wajah berbeda).
 * Untuk keamanan lebih tinggi, bisa diganti dengan AI di masa depan.
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Threshold keamanan wajah (makin tinggi makin ketat)
const PEARSON_THRESHOLD   = 0.48; // Membandingkan posisi struktural wajah (mata, hidung, mulut)
const HISTOGRAM_THRESHOLD = 0.45; // Membandingkan kemiripan warna kulit, kontras, dan pencahayaan (diturunkan agar toleran cahaya)

/**
 * Hitung histogram channel (array 256 bucket) dari buffer grayscale
 */
function computeHistogram(buffer) {
  const hist = new Array(256).fill(0);
  for (const val of buffer) hist[val]++;
  // Normalisasi
  const total = buffer.length;
  return hist.map(v => v / total);
}

/**
 * Hitung Bhattacharyya coefficient antara dua histogram (0–1, makin tinggi makin mirip)
 */
function bhattacharyyaCoeff(h1, h2) {
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += Math.sqrt(h1[i] * h2[i]);
  }
  return sum;
}

/**
 * Hitung Pearson Correlation Coefficient (Korelasi Spasial) antara dua buffer grayscale
 * Menghasilkan nilai antara -1 hingga 1. Nilai >= 0.50 menandakan kemiripan struktur wajah yang kuat.
 */
function pearsonCorrelation(buf1, buf2) {
  if (buf1.length !== buf2.length) return 0;
  const n = buf1.length;
  let sum1 = 0, sum2 = 0;
  for (let i = 0; i < n; i++) {
    sum1 += buf1[i];
    sum2 += buf2[i];
  }
  const mean1 = sum1 / n;
  const mean2 = sum2 / n;

  let num = 0;
  let den1 = 0;
  let den2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = buf1[i] - mean1;
    const diff2 = buf2[i] - mean2;
    num += diff1 * diff2;
    den1 += diff1 * diff1;
    den2 += diff2 * diff2;
  }

  if (den1 === 0 || den2 === 0) return 0;
  return num / Math.sqrt(den1 * den2);
}

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
 *
 * @param {string} selfieFilename  - filename selfie di uploads/selfie/
 * @param {string} avatarFilename  - filename avatar di uploads/avatar/
 * @param {object|null} selfieBbox - bounding box wajah dari ML Kit { x, y, width, height }
 * @returns {{ match: boolean, similarity: number, message: string }}
 */
async function verifyFace(selfieFilename, avatarFilename, selfieBbox = null) {
  try {
    const selfiePath = path.join(UPLOADS_DIR, 'selfie', selfieFilename);
    const avatarPath = path.join(UPLOADS_DIR, 'avatar', avatarFilename);

    // Pastikan kedua file ada
    if (!fs.existsSync(avatarPath)) {
      return { match: false, similarity: 0, message: 'Foto referensi wajah (avatar) tidak ditemukan' };
    }
    if (!fs.existsSync(selfiePath)) {
      return { match: false, similarity: 0, message: 'File selfie tidak ditemukan' };
    }

    // Extract region wajah dari selfie (pakai bbox jika ada)
    const selfieBuffer = await extractFaceRegion(selfiePath, selfieBbox);
    
    // Putar avatar terlebih dahulu dan baca metadatanya agar pembagian koordinat bbox akurat
    const rotatedAvatarBuffer = await sharp(avatarPath).rotate().toBuffer();
    const avatarMeta = await sharp(rotatedAvatarBuffer).metadata();
    const avatarBbox = avatarMeta ? {
      x:      Math.round(avatarMeta.width  * 0.15),
      y:      Math.round(avatarMeta.height * 0.05),
      width:  Math.round(avatarMeta.width  * 0.70),
      height: Math.round(avatarMeta.height * 0.65),
    } : null;
    const avatarBuffer = await extractFaceRegion(rotatedAvatarBuffer, avatarBbox);

    if (!selfieBuffer || !avatarBuffer) {
      return { match: false, similarity: 0, message: 'Gagal mengekstrak area wajah dari foto' };
    }

    // Hitung histogram dan similarity
    const h1 = computeHistogram(selfieBuffer);
    const h2 = computeHistogram(avatarBuffer);
    const histSim = bhattacharyyaCoeff(h1, h2);
    
    // Hitung korelasi spasial Pearson
    const pearsonSim = pearsonCorrelation(selfieBuffer, avatarBuffer);

    // Wajah dianggap cocok jika korelasi spasial AND kemiripan histogram memenuhi batas
    const match = pearsonSim >= PEARSON_THRESHOLD && histSim >= HISTOGRAM_THRESHOLD;

    console.log(`[FaceVerification] similarity_pearson=${pearsonSim.toFixed(4)} (th=${PEARSON_THRESHOLD}) similarity_histogram=${histSim.toFixed(4)} (th=${HISTOGRAM_THRESHOLD}) match=${match}`);

    return {
      match,
      similarity: parseFloat(((pearsonSim + histSim) / 2).toFixed(4)),
      message: match
        ? 'Wajah terverifikasi'
        : 'Wajah tidak cocok dengan akun kamu. Pastikan kamu yang melakukan absensi.',
    };
  } catch (err) {
    console.error('[FaceVerification] verifyFace error:', err.message);
    return { match: false, similarity: 0, message: 'Terjadi kesalahan sistem saat memproses verifikasi wajah' };
  }
}

module.exports = { verifyFace };
