const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { exportAttendanceExcel, exportAttendancePDF, exportAttendanceDetailPDF, exportLeaveExcel, exportMonthlyRecapExcel, exportAttendanceTimesheetExcel } = require('../controllers/exportController');

router.use(authenticate);
router.use(authorize('superadmin', 'admin', 'hrd'));

router.get('/attendance/excel', exportAttendanceExcel);
router.get('/attendance/pdf', exportAttendancePDF);
router.get('/attendance/detail-pdf', exportAttendanceDetailPDF);
router.get('/leave/excel', exportLeaveExcel);
router.get('/monthly-recap/excel', exportMonthlyRecapExcel);
router.get('/attendance/timesheet-excel', exportAttendanceTimesheetExcel);

module.exports = router;
