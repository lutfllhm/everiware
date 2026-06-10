const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getShifts, createShift, updateShift, deleteShift, getUserShift, assignShift, bulkAssignShift, getAllUserShifts } = require('../controllers/shiftController');

router.use(authenticate);

router.get('/', getShifts);
router.get('/my', getUserShift);
router.get('/assignments', authorize('superadmin', 'admin', 'hrd'), getAllUserShifts);
router.get('/user/:userId', authorize('superadmin', 'admin', 'hrd'), getUserShift);
router.post('/', authorize('superadmin', 'admin'), createShift);
router.put('/:id', authorize('superadmin', 'admin'), updateShift);
router.delete('/:id', authorize('superadmin', 'admin'), deleteShift);
router.post('/assign', authorize('superadmin', 'admin', 'hrd'), assignShift);
router.post('/assign/bulk', authorize('superadmin', 'admin', 'hrd'), bulkAssignShift);

module.exports = router;
