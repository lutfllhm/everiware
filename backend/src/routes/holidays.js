const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getHolidays, createHoliday, updateHoliday, deleteHoliday, bulkImportHolidays } = require('../controllers/holidayController');

router.use(authenticate);

// Semua role bisa lihat (untuk cek hari libur di frontend)
router.get('/', getHolidays);

// Hanya admin yang bisa kelola
router.post('/', authorize('superadmin', 'admin'), createHoliday);
router.post('/bulk', authorize('superadmin', 'admin'), bulkImportHolidays);
router.put('/:id', authorize('superadmin', 'admin'), updateHoliday);
router.delete('/:id', authorize('superadmin', 'admin'), deleteHoliday);

module.exports = router;
