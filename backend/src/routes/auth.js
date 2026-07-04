const express = require('express');
const router = express.Router();
const { verifyOTP, resendOTP, login, getMe, forgotPassword, verifyResetOTP, resetPassword, activateAccount, checkActivationToken } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

// Aktivasi akun karyawan baru (set password pertama kali)
router.get('/activation/:token', checkActivationToken);
router.post('/activate', activateAccount);

module.exports = router;
