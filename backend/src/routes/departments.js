const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getDepartments, getAllDepartments,
  createDepartment, updateDepartment, deleteDepartment,
  createPosition, updatePosition, deletePosition
} = require('../controllers/departmentController');

router.use(authenticate);

// Departemen
router.get('/', getDepartments);                                                    // semua user (untuk dropdown)
router.get('/all', authorize('superadmin', 'admin', 'hrd'), getAllDepartments);     // admin (termasuk nonaktif)
router.post('/', authorize('superadmin', 'admin', 'hrd'), createDepartment);
router.put('/:id', authorize('superadmin', 'admin', 'hrd'), updateDepartment);
router.delete('/:id', authorize('superadmin', 'admin', 'hrd'), deleteDepartment);

// Posisi/Jabatan
router.post('/positions', authorize('superadmin', 'admin', 'hrd'), createPosition);
router.put('/positions/:id', authorize('superadmin', 'admin', 'hrd'), updatePosition);
router.delete('/positions/:id', authorize('superadmin', 'admin', 'hrd'), deletePosition);

module.exports = router;
