const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getHolidays, createHoliday, updateHoliday, deleteHoliday, bulkImportHolidays } = require('../controllers/holidayController');

router.use(authenticate);

// Semua role bisa lihat (untuk cek hari libur di frontend)
router.get('/', getHolidays);

// Hanya admin yang bisa kelola
router.post('/', authorize('superadmin', 'admin', 'hrd'), createHoliday);
router.post('/bulk', authorize('superadmin', 'admin', 'hrd'), bulkImportHolidays);
router.put('/:id', authorize('superadmin', 'admin', 'hrd'), updateHoliday);
router.delete('/:id', authorize('superadmin', 'admin', 'hrd'), deleteHoliday);

module.exports = router;
