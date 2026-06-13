const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getAnnouncements, createAnnouncement } = require('../controllers/announcementController');

router.use(authenticate);

// Semua role yang terautentikasi bisa membaca pengumuman perusahaan
router.get('/', getAnnouncements);

// Hanya superadmin, admin, dan hrd yang bisa membuat pengumuman
router.post('/', authorize('superadmin', 'admin', 'hrd'), createAnnouncement);

module.exports = router;
