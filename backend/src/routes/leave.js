const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { uploadSick } = require('../middleware/upload');
const {
  getMyQuota, submitLeave, getMyLeaves, getAllLeaves,
  reviewLeave, spvReviewLeave, getSpvPendingLeaves,
  getLeaveReport, updateQuota, deleteLeave,
  getTeamCalendar, triggerCarryOver
} = require('../controllers/leaveController');

router.use(authenticate);

// Employee routes
router.get('/quota', getMyQuota);
router.post('/submit', uploadSick.single('attachment'), submitLeave);
router.get('/my', getMyLeaves);

// SPV routes (manager/atasan)
router.get('/spv-pending', getSpvPendingLeaves);
router.put('/spv-review/:id', spvReviewLeave);

// Team calendar (semua role)
router.get('/team-calendar', getTeamCalendar);

// Admin/HRD routes
router.get('/all', authorize('superadmin', 'admin', 'hrd'), getAllLeaves);
router.put('/review/:id', authorize('superadmin', 'admin', 'hrd'), reviewLeave);
router.get('/report', authorize('superadmin', 'admin', 'hrd'), getLeaveReport);
router.put('/quota/:userId', authorize('superadmin', 'admin', 'hrd'), updateQuota);
router.post('/carry-over', authorize('superadmin', 'admin', 'hrd'), triggerCarryOver);
router.delete('/:id', authorize('superadmin', 'admin', 'hrd'), deleteLeave);

module.exports = router;
