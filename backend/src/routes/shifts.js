const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getShifts, createShift, updateShift, deleteShift, getUserShift, assignShift, bulkAssignShift, getAllUserShifts } = require('../controllers/shiftController');

router.use(authenticate);

router.get('/', getShifts);
router.get('/my', getUserShift);
router.get('/assignments', authorize('superadmin', 'admin', 'hrd'), getAllUserShifts);
router.get('/user/:userId', authorize('superadmin', 'admin', 'hrd'), getUserShift);
router.post('/', authorize('superadmin', 'admin', 'hrd'), createShift);
router.put('/:id', authorize('superadmin', 'admin', 'hrd'), updateShift);
router.delete('/:id', authorize('superadmin', 'admin', 'hrd'), deleteShift);
router.post('/assign', authorize('superadmin', 'admin', 'hrd'), assignShift);
router.post('/assign/bulk', authorize('superadmin', 'admin', 'hrd'), bulkAssignShift);

module.exports = router;
