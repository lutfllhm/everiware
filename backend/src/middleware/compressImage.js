const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 75;

async function compressOneFile(fileObj) {
  const filePath = fileObj.path;
  try {
    const buffer = await sharp(filePath)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    const jpgPath = filePath.slice(0, filePath.lastIndexOf(path.extname(filePath))) + '.jpg';
    fs.writeFileSync(jpgPath, buffer);
    if (jpgPath !== filePath) fs.unlinkSync(filePath);

    fileObj.path = jpgPath;
    fileObj.filename = path.basename(jpgPath);
    fileObj.size = buffer.length;
  } catch (err) {
    console.error('[compressImage] Gagal compress gambar, menggunakan file asli:', err.message);
  }
}

/**
 * Middleware yang jalan setelah multer menulis file ke disk.
 * Resize (max lebar 1280px, proporsional) dan compress ke JPEG,
 * lalu timpa file yang sama sehingga filename & path di DB tidak berubah.
 * Auto-rotate berdasarkan EXIF sebelum strip metadata.
 *
 * Menangani baik `req.file` (multer .single()) maupun `req.files`
 * (multer .fields(), berupa objek { fieldName: [file, ...] }).
 */
const compressUploadedImage = () => async (req, res, next) => {
  try {
    if (req.file) {
      await compressOneFile(req.file);
    }
    if (req.files && !Array.isArray(req.files)) {
      const allFiles = Object.values(req.files).flat();
      await Promise.all(allFiles.map(compressOneFile));
    }
  } catch (err) {
    console.error('[compressImage] Error tak terduga saat compress:', err.message);
  }

  next();
};

module.exports = { compressUploadedImage };
