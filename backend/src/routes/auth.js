const express = require('express');
const router = express.Router();
const { register, verifyOTP, resendOTP, login, googleAuth, updatePhone, getMe, forgotPassword, verifyResetOTP, resetPassword, activateAccount, checkActivationToken } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/update-phone', updatePhone);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

// Aktivasi akun karyawan baru (set password pertama kali)
router.get('/activation/:token', checkActivationToken);
router.post('/activate', activateAccount);

module.exports = router;
