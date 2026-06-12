const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getLeaveTypes, getActiveLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType } = require('../controllers/leaveTypeController');

router.use(authenticate);

router.get('/', authorize('superadmin', 'admin', 'hrd'), getLeaveTypes);
router.get('/active', getActiveLeaveTypes);
router.post('/', authorize('superadmin', 'admin', 'hrd'), createLeaveType);
router.put('/:id', authorize('superadmin', 'admin', 'hrd'), updateLeaveType);
router.delete('/:id', authorize('superadmin', 'admin', 'hrd'), deleteLeaveType);

module.exports = router;
