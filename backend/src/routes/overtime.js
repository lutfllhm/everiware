const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { uploadOvertime } = require('../middleware/upload');
const {
  submitOvertime, getMyOvertime, getAllOvertime,
  reviewOvertime, deleteOvertime, getOvertimeReport
} = require('../controllers/overtimeController');

router.use(authenticate);

// Karyawan
router.post('/submit', uploadOvertime.single('attachment'), submitOvertime);
router.get('/my', getMyOvertime);
router.delete('/:id', deleteOvertime);

// Admin / HRD
router.get('/all', authorize('superadmin', 'admin', 'hrd'), getAllOvertime);
router.put('/review/:id', authorize('superadmin', 'admin', 'hrd'), reviewOvertime);
router.get('/report', authorize('superadmin', 'admin', 'hrd'), getOvertimeReport);

module.exports = router;
