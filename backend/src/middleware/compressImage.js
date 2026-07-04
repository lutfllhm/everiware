const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 75;

/**
 * Middleware yang jalan setelah multer menulis file ke disk.
 * Resize (max lebar 1280px, proporsional) dan compress ke JPEG,
 * lalu timpa file yang sama sehingga filename & path di DB tidak berubah.
 * Auto-rotate berdasarkan EXIF sebelum strip metadata.
 */
const compressUploadedImage = () => async (req, res, next) => {
  if (!req.file) return next();

  const filePath = req.file.path;

  try {
    const buffer = await sharp(filePath)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    const jpgPath = filePath.slice(0, filePath.lastIndexOf(path.extname(filePath))) + '.jpg';
    fs.writeFileSync(jpgPath, buffer);
    if (jpgPath !== filePath) fs.unlinkSync(filePath);

    req.file.path = jpgPath;
    req.file.filename = path.basename(jpgPath);
    req.file.size = buffer.length;
  } catch (err) {
    console.error('[compressImage] Gagal compress gambar, menggunakan file asli:', err.message);
  }

  next();
};

module.exports = { compressUploadedImage };
