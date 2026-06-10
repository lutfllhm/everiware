const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { uploadSelfie } = require('../middleware/upload');
const {
  checkIn, checkOut, getTodayAttendance, getMyAttendance,
  getAllAttendances, getAttendanceReport, getLocations,
  createLocation, updateLocation, deleteLocation, deleteAttendance, updateAttendance
} = require('../controllers/attendanceController');

router.use(authenticate);

// Employee routes
router.post('/check-in', uploadSelfie.single('photo'), checkIn);
router.post('/check-out', uploadSelfie.single('photo'), checkOut);
router.get('/today', getTodayAttendance);
router.get('/my', getMyAttendance);

// Location routes — harus SEBELUM /:id agar tidak konflik
router.get('/locations', getLocations);
router.post('/locations', authorize('superadmin', 'admin', 'hrd'), createLocation);
router.put('/locations/:id', authorize('superadmin', 'admin', 'hrd'), updateLocation);
router.delete('/locations/:id', authorize('superadmin', 'admin'), deleteLocation);

// Admin routes
router.get('/all', authorize('superadmin', 'admin', 'hrd'), getAllAttendances);
router.get('/report', authorize('superadmin', 'admin', 'hrd'), getAttendanceReport);
router.put('/:id', authorize('superadmin', 'admin', 'hrd'), updateAttendance);
router.delete('/:id', authorize('superadmin', 'admin'), deleteAttendance);

module.exports = router;
