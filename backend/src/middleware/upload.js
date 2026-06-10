const multer = require('multer');
const path = require('path');
const { generateId } = require('../utils/helpers');

const createStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../../uploads', folder);
      // Pastikan folder ada
      const fs = require('fs');
      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${generateId()}${ext}`);
    },
  });

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Hanya file gambar yang diizinkan'), false);
};

const uploadSelfie = multer({
  storage: createStorage('selfie'),
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 },
});

const uploadSick = multer({
  storage: createStorage('sick'),
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 },
});

const uploadAvatar = multer({
  storage: createStorage('avatar'),
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 },
});

const uploadOvertime = multer({
  storage: createStorage('overtime'),
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 },
});

module.exports = { uploadSelfie, uploadSick, uploadAvatar, uploadOvertime };
