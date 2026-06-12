const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { uploadSelfie, uploadAvatar } = require('../middleware/upload');
const {
  getAllUsers, getUser, createUser, updateUser, deleteUser, permanentDeleteUser,
  updateProfile, changePassword, getNotifications, markNotificationRead,
  deleteNotification, deleteAllNotifications,
  broadcastNotification, getDashboardStats, getSettings, updateSettings,
  saveFcmToken, removeFcmToken, registerFace
} = require('../controllers/userController');

router.use(authenticate);

// Self routes
router.put('/profile', uploadAvatar.single('avatar'), updateProfile);
router.put('/register-face', uploadAvatar.single('face_photo'), registerFace);
router.put('/change-password', changePassword);
router.get('/notifications', getNotifications);
router.put('/notifications/read', markNotificationRead);
router.delete('/notifications/all', deleteAllNotifications);
router.delete('/notifications/:id', deleteNotification);
router.post('/notifications/broadcast', authorize('superadmin', 'admin', 'hrd'), broadcastNotification);
router.post('/fcm-token', saveFcmToken);
router.delete('/fcm-token', removeFcmToken);

// Admin routes
router.get('/dashboard', authorize('superadmin', 'admin', 'hrd'), getDashboardStats);
router.get('/settings', authorize('superadmin', 'admin'), getSettings);
router.put('/settings', authorize('superadmin', 'admin'), updateSettings);
router.get('/', authorize('superadmin', 'admin', 'hrd'), getAllUsers);
router.post('/', authorize('superadmin', 'admin', 'hrd'), uploadAvatar.single('avatar'), createUser);
router.get('/:id', authorize('superadmin', 'admin', 'hrd'), getUser);
router.put('/:id', authorize('superadmin', 'admin', 'hrd'), updateUser);
router.delete('/:id', authorize('superadmin', 'admin', 'hrd'), deleteUser);
router.delete('/:id/permanent', authorize('superadmin', 'admin'), permanentDeleteUser);

module.exports = router;
