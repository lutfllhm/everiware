const express = require('express');
const router = express.Router();
const { authenticate, authorize, authorizeOrPermission } = require('../middleware/auth');
const { getShifts, createShift, updateShift, deleteShift, getUserShift, assignShift, bulkAssignShift, getAllUserShifts } = require('../controllers/shiftController');

router.use(authenticate);

router.get('/', getShifts);
router.get('/my', getUserShift);
router.get('/assignments', authorizeOrPermission('shifts.manage'), getAllUserShifts);
router.get('/user/:userId', authorizeOrPermission('shifts.manage'), getUserShift);
router.post('/', authorize('superadmin', 'admin', 'hrd'), createShift);
router.put('/:id', authorize('superadmin', 'admin', 'hrd'), updateShift);
router.delete('/:id', authorize('superadmin', 'admin', 'hrd'), deleteShift);
router.post('/assign', authorizeOrPermission('shifts.manage'), assignShift);
router.post('/assign/bulk', authorizeOrPermission('shifts.manage'), bulkAssignShift);

module.exports = router;
