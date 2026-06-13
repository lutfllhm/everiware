const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { 
  getAnnouncements, 
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} = require('../controllers/announcementController');

router.use(authenticate);

// Semua role yang terautentikasi bisa membaca pengumuman perusahaan
router.get('/', getAnnouncements);

// Hanya superadmin, admin, dan hrd yang bisa membuat, mengubah, dan menghapus pengumuman
router.post('/', authorize('superadmin', 'admin', 'hrd'), createAnnouncement);
router.put('/:id', authorize('superadmin', 'admin', 'hrd'), updateAnnouncement);
router.delete('/:id', authorize('superadmin', 'admin', 'hrd'), deleteAnnouncement);

module.exports = router;
