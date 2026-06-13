const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const userRoutes = require('./routes/users');
const shiftRoutes = require('./routes/shifts');
const leaveTypeRoutes = require('./routes/leaveTypes');
const exportRoutes = require('./routes/export');
const analyticsRoutes = require('./routes/analytics');
const departmentRoutes = require('./routes/departments');
const overtimeRoutes   = require('./routes/overtime');
const holidayRoutes    = require('./routes/holidays');
const auditLogRoutes   = require('./routes/auditLog');
const realtimeRoutes   = require('./routes/realtime');
const announcementRoutes = require('./routes/announcements');

const app = express();

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://192.168.120.223:5173',
  'http://192.168.120.223:4173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (Postman, mobile app), dari allowed list,
    // atau jika berasal dari IP lokal (Private Network Range) saat development
    const isLocalNetwork = process.env.NODE_ENV === 'development' &&
      /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);

    if (!origin || allowedOrigins.includes(origin) || isLocalNetwork) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting — longgar untuk penggunaan normal dashboard
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 5000,                 // 5000 request per IP per 15 menit
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => {
    // Skip rate limit untuk static files
    return req.path.startsWith('/uploads');
  }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // lebih longgar untuk auth
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Middleware
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files — serve dari absolute path
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Pastikan semua folder uploads ada
const fs = require('fs');
['selfie', 'sick', 'avatar', 'overtime'].forEach(folder => {
  const dir = path.join(__dirname, '../uploads', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/announcements', announcementRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'iWare Presence API is running 🚀', timestamp: new Date() }));

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'Ukuran file terlalu besar (max 5MB)' });
  res.status(500).json({ success: false, message: err.message || 'Terjadi kesalahan server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', async () => {
  await testConnection();
  console.log(`🚀 iWare Presence API running on port ${PORT}`);
});

module.exports = app;
