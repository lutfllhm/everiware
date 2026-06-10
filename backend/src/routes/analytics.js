const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getAttendanceTrend, getCheckInHeatmap, getDepartmentStats, getTopLate, getFullDashboard } = require('../controllers/analyticsController');

router.use(authenticate);
router.use(authorize('superadmin', 'admin', 'hrd'));

router.get('/dashboard', getFullDashboard);
router.get('/trend', getAttendanceTrend);
router.get('/checkin-heatmap', getCheckInHeatmap);
router.get('/departments', getDepartmentStats);
router.get('/top-late', getTopLate);

module.exports = router;
