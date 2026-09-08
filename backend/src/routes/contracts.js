const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getContracts, getContractHistory, createContract, updateContract, deleteContract,
  updateEmployment, terminateEmployee, reactivateEmployee, getExpiringContracts, getMasterData,
  searchEmployees, createEmployeeWithContract, resendActivation,
} = require('../controllers/contractController');
const { getYearlyRecap, getRecapDetail } = require('../controllers/contractRecapController');

router.use(authenticate);

// Seluruh modul status hubungan kerja hanya untuk admin/HRD
const hrOnly = authorize('superadmin', 'admin', 'hrd');

// Daftar & master data
router.get('/', hrOnly, getContracts);
router.get('/master', hrOnly, getMasterData);
router.get('/expiring', hrOnly, getExpiringContracts);
router.get('/search-employees', hrOnly, searchEmployees);   // autocomplete form kontrak

// Daftarkan karyawan baru sekaligus kontrak pertamanya (akun + email aktivasi)
router.post('/employee', hrOnly, createEmployeeWithContract);

// Terbitkan ulang tautan aktivasi untuk karyawan yang belum membuat kata sandi
router.post('/resend-activation/:userId', hrOnly, resendActivation);

// Rekap tahunan
router.get('/recap', hrOnly, getYearlyRecap);
router.get('/recap/detail', hrOnly, getRecapDetail);

// Riwayat kontrak per karyawan
router.get('/history/:userId', hrOnly, getContractHistory);

// Data kepegawaian & status keluar
router.put('/employment/:userId', hrOnly, updateEmployment);
router.put('/terminate/:userId', hrOnly, terminateEmployee);
router.put('/reactivate/:userId', hrOnly, reactivateEmployee);

// CRUD kontrak — perpanjangan memakai POST (membuat baris baru, histori tersimpan)
router.post('/', hrOnly, createContract);
router.put('/:id', hrOnly, updateContract);
router.delete('/:id', hrOnly, deleteContract);

module.exports = router;
