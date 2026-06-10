const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { generateOTP, generateId } = require('../utils/helpers');
const { sendOTPEmail, sendPasswordResetEmail } = require('../utils/email');
const { OAuth2Client } = require('google-auth-library');

// Helper: format user object konsisten untuk web & mobile
const formatUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  avatar: user.avatar,
  face_photo: user.face_photo,
  department: user.department,
  position: user.position,
  employee_id: user.employee_id,
  join_date: user.join_date,
  is_active: user.is_active,
  is_verified: user.is_verified,
  face_registered: user.face_registered === 1 || user.face_registered === true || false,
  location_id: user.location_id,
  location_name: user.location_name,
});

const generateToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password || !phone)
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    const id = generateId();

    await pool.query(
      'INSERT INTO users (id, name, email, password, phone, otp_code, otp_expires) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, hashedPassword, phone, otp, otpExpires]
    );

    await sendOTPEmail(email, name, otp);
    res.status(201).json({ success: true, message: 'Registrasi berhasil! Cek email untuk kode OTP', userId: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const [rows] = await pool.query(
      `SELECT u.*, al.name as location_name 
       FROM users u 
       LEFT JOIN attendance_locations al ON u.location_id = al.id 
       WHERE u.id = ?`,
      [userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    const user = rows[0];
    if (user.otp_code !== otp) return res.status(400).json({ success: false, message: 'Kode OTP salah' });
    if (new Date() > new Date(user.otp_expires)) return res.status(400).json({ success: false, message: 'Kode OTP sudah kadaluarsa' });

    await pool.query('UPDATE users SET is_verified = TRUE, otp_code = NULL, otp_expires = NULL WHERE id = ?', [userId]);

    const token = generateToken(user);
    res.json({ success: true, message: 'Verifikasi berhasil!', token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { userId } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    const user = rows[0];
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('UPDATE users SET otp_code = ?, otp_expires = ? WHERE id = ?', [otp, otpExpires, userId]);
    await sendOTPEmail(user.email, user.name, otp);

    res.json({ success: true, message: 'Kode OTP baru telah dikirim ke email kamu' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query(
      `SELECT u.*, al.name as location_name 
       FROM users u 
       LEFT JOIN attendance_locations al ON u.location_id = al.id 
       WHERE u.email = ? AND u.is_active = TRUE`,
      [email]
    );
    if (!rows.length) return res.status(401).json({ success: false, message: 'Email atau password salah' });

    const user = rows[0];
    if (!user.password) return res.status(401).json({ success: false, message: 'Akun ini terdaftar via Google. Gunakan login Google.' });
    if (!user.is_verified) return res.status(401).json({ success: false, message: 'Akun belum diverifikasi', userId: user.id, needVerify: true });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Email atau password salah' });

    const token = generateToken(user);
    res.json({
      success: true, message: 'Login berhasil!', token,
      user: formatUser(user)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Google OAuth
const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;
    const { OAuth2Client: GoogleOAuth2Client } = require('google-auth-library');
    const authClient = new GoogleOAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await authClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let [rows] = await pool.query(
      `SELECT u.*, al.name as location_name 
       FROM users u 
       LEFT JOIN attendance_locations al ON u.location_id = al.id 
       WHERE u.email = ? OR u.google_id = ?`,
      [email, googleId]
    );
    let user;

    if (rows.length) {
      user = rows[0];
      await pool.query('UPDATE users SET google_id = ?, avatar = ?, is_verified = TRUE WHERE id = ?', [googleId, picture, user.id]);
    } else {
      const id = generateId();
      await pool.query(
        'INSERT INTO users (id, name, email, google_id, avatar, is_verified) VALUES (?, ?, ?, ?, ?, TRUE)',
        [id, name, email, googleId, picture]
      );
      const [newUser] = await pool.query(
        `SELECT u.*, al.name as location_name 
         FROM users u 
         LEFT JOIN attendance_locations al ON u.location_id = al.id 
         WHERE u.id = ?`,
        [id]
      );
      user = newUser[0];
    }

    if (!user.phone) {
      return res.json({ success: true, needPhone: true, userId: user.id, message: 'Lengkapi nomor WhatsApp kamu' });
    }

    const jwtToken = generateToken(user);
    res.json({
      success: true, message: 'Login Google berhasil!', token: jwtToken,
      user: formatUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal login dengan Google' });
  }
};

// Update phone after Google login
const updatePhone = async (req, res) => {
  try {
    const { userId, phone } = req.body;
    await pool.query('UPDATE users SET phone = ? WHERE id = ?', [phone, userId]);
    const [rows] = await pool.query(
      `SELECT u.*, al.name as location_name 
       FROM users u 
       LEFT JOIN attendance_locations al ON u.location_id = al.id 
       WHERE u.id = ?`,
      [userId]
    );
    const user = rows[0];
    const token = generateToken(user);
    res.json({ success: true, message: 'Nomor WhatsApp berhasil disimpan!', token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.face_photo, u.role, u.department, u.position, u.employee_id, u.join_date, u.is_active, u.is_verified, u.created_at, u.face_registered,
              u.location_id, al.name as location_name
       FROM users u
       LEFT JOIN attendance_locations al ON u.location_id = al.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email wajib diisi' });

    const [rows] = await pool.query('SELECT id, name, email FROM users WHERE email = ? AND is_active = TRUE', [email]);
    // Selalu return success agar tidak bocorkan info email terdaftar atau tidak
    if (!rows.length) return res.json({ success: true, message: 'Jika email terdaftar, kode reset akan dikirim' });

    const user = rows[0];
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    await pool.query('UPDATE users SET otp_code = ?, otp_expires = ? WHERE id = ?', [otp, otpExpires, user.id]);
    await sendPasswordResetEmail(user.email, user.name, otp);

    res.json({ success: true, message: 'Kode reset password telah dikirim ke email kamu', userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── VERIFY RESET OTP ──────────────────────────────────────────────────────────
const verifyResetOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    const user = rows[0];
    if (user.otp_code !== otp) return res.status(400).json({ success: false, message: 'Kode OTP salah' });
    if (new Date() > new Date(user.otp_expires)) return res.status(400).json({ success: false, message: 'Kode OTP sudah kadaluarsa' });

    // Tandai OTP valid tapi belum reset — hapus OTP setelah diverifikasi
    await pool.query('UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE id = ?', [userId]);
    // Buat reset token sementara (simpan di otp_code sebagai token)
    const resetToken = generateId();
    const resetExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 menit untuk reset
    await pool.query('UPDATE users SET otp_code = ?, otp_expires = ? WHERE id = ?', [resetToken, resetExpires, userId]);

    res.json({ success: true, message: 'OTP valid', resetToken });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { userId, resetToken, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    const user = rows[0];
    if (user.otp_code !== resetToken) return res.status(400).json({ success: false, message: 'Token reset tidak valid' });
    if (new Date() > new Date(user.otp_expires)) return res.status(400).json({ success: false, message: 'Token reset sudah kadaluarsa, ulangi proses' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ?, otp_code = NULL, otp_expires = NULL WHERE id = ?', [hashedPassword, userId]);

    res.json({ success: true, message: 'Password berhasil direset! Silakan login dengan password baru.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── Aktivasi akun (set password pertama kali) ────────────────────────────────
const activateAccount = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token dan password wajib diisi' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
    }

    // Cari user dengan activation token yang valid
    const [rows] = await pool.query(
      `SELECT u.*, al.name as location_name 
       FROM users u 
       LEFT JOIN attendance_locations al ON u.location_id = al.id 
       WHERE u.otp_code = ? AND u.otp_expires > ? AND u.password IS NULL`,
      [token, new Date()]
    );

    if (!rows.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token aktivasi tidak valid atau sudah kadaluarsa' 
      });
    }

    const user = rows[0];

    // Hash password dan aktifkan akun
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password = ?, is_verified = TRUE, otp_code = NULL, otp_expires = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    // Generate JWT token untuk auto-login
    const jwtToken = generateToken(user);

    res.json({
      success: true,
      message: 'Akun berhasil diaktifkan! Silakan login.',
      token: jwtToken,
      user: formatUser({ ...user, is_verified: true }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── Cek validitas activation token ───────────────────────────────────────────
const checkActivationToken = async (req, res) => {
  try {
    const { token } = req.params;
    console.log('[checkActivationToken] Checking token:', token);

    const [rows] = await pool.query(
      'SELECT id, name, email, otp_expires, password FROM users WHERE otp_code = ?',
      [token]
    );

    console.log('[checkActivationToken] Found users:', rows.length);
    
    if (rows.length > 0) {
      const user = rows[0];
      console.log('[checkActivationToken] User:', {
        id: user.id,
        name: user.name,
        email: user.email,
        has_password: !!user.password,
        otp_expires: user.otp_expires,
        is_expired: new Date() > new Date(user.otp_expires)
      });
    }

    const [validRows] = await pool.query(
      'SELECT id, name, email FROM users WHERE otp_code = ? AND otp_expires > ? AND password IS NULL',
      [token, new Date()]
    );

    if (!validRows.length) {
      console.log('[checkActivationToken] Token invalid or expired');
      return res.status(400).json({ 
        success: false, 
        message: 'Token aktivasi tidak valid atau sudah kadaluarsa' 
      });
    }

    console.log('[checkActivationToken] Token valid for user:', validRows[0].email);
    res.json({
      success: true,
      user: {
        name: validRows[0].name,
        email: validRows[0].email,
      },
    });
  } catch (err) {
    console.error('[checkActivationToken] Error:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = { register, verifyOTP, resendOTP, login, googleAuth, updatePhone, getMe, forgotPassword, verifyResetOTP, resetPassword, activateAccount, checkActivationToken };
