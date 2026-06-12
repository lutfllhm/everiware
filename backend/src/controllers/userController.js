const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');
const { auditLog } = require('../utils/auditLog');
const { validateRegistrationFace } = require('../utils/faceVerification');


// Get all users (admin)
const getAllUsers = async (req, res) => {
  try {
    const { role, department, location_id, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.face_photo, u.role, u.department, u.position, u.employee_id, u.join_date, u.is_active, u.is_verified, u.created_at, u.face_registered,
                 u.location_id, al.name as location_name,
                 lq.total_days, lq.used_days, lq.remaining_days
                 FROM users u
                 LEFT JOIN leave_quotas lq ON u.id = lq.user_id AND lq.year = YEAR(NOW())
                 LEFT JOIN attendance_locations al ON u.location_id = al.id
                 WHERE 1=1`;
    const params = [];

    if (role) { query += ' AND u.role = ?'; params.push(role); }
    if (department) { query += ' AND u.department = ?'; params.push(department); }
    if (location_id) { query += ' AND u.location_id = ?'; params.push(location_id); }
    if (search) { query += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.employee_id LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);
    
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams = [];
    if (role) { countQuery += ' AND role = ?'; countParams.push(role); }
    if (location_id) { countQuery += ' AND location_id = ?'; countParams.push(location_id); }
    const [countResult] = await pool.query(countQuery, countParams);

    res.json({ success: true, users: rows, total: countResult[0].total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Get single user
const getUser = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.*, al.name as location_name, lq.total_days, lq.used_days, lq.remaining_days 
       FROM users u 
       LEFT JOIN leave_quotas lq ON u.id = lq.user_id AND lq.year = YEAR(NOW())
       LEFT JOIN attendance_locations al ON u.location_id = al.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    const user = rows[0];
    delete user.password;
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Create user (admin)
const createUser = async (req, res) => {
  try {
    const { name, email, phone, role, department, position, employee_id, join_date, send_invitation, location_id } = req.body;
    const avatar = req.file ? req.file.filename : null;
    
    // Validasi email
    if (!email || !name) {
      return res.status(400).json({ success: false, message: 'Nama dan email wajib diisi' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });
    }

    const id = generateId();
    
    // Generate activation token (valid 7 hari)
    const activationToken = generateId(); // UUID sebagai token
    const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

    // Buat user dengan password NULL dan is_verified FALSE
    await pool.query(
      `INSERT INTO users (id, name, email, password, phone, role, department, position, employee_id, join_date, avatar, is_verified, otp_code, otp_expires, location_id) 
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?, ?)`,
      [id, name, email, phone, role || 'employee', department, position, employee_id, join_date, avatar, activationToken, tokenExpires, location_id || null]
    );

    // Kirim email undangan jika diminta
    if (send_invitation !== 'false' && send_invitation !== false) {
      const activationLink = `${process.env.WEB_URL || 'http://localhost:3000'}/activate/${activationToken}`;
      console.log('[createUser] Sending invitation email to:', email);
      console.log('[createUser] Activation link:', activationLink);
      console.log('[createUser] send_invitation value:', send_invitation);
      try {
        await sendInvitationEmail(email, name, activationLink);
        console.log('[createUser] ✅ Email sent successfully to:', email);
      } catch (emailErr) {
        console.error('[createUser] ❌ Failed to send invitation email:', emailErr);
        // Tidak gagalkan request jika email gagal
      }
    } else {
      console.log('[createUser] Email invitation skipped. send_invitation:', send_invitation);
    }

    await auditLog(req, 'CREATE_USER', 'user', id, `Membuat akun karyawan baru: ${name} (${email})`);

    res.status(201).json({ 
      success: true, 
      message: (send_invitation !== 'false' && send_invitation !== false)
        ? 'Karyawan berhasil ditambahkan. Email undangan telah dikirim.' 
        : 'Karyawan berhasil ditambahkan.',
      id,
      activation_token: activationToken, // Return token untuk testing/manual share
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Helper: kirim email undangan
async function sendInvitationEmail(email, name, activationLink) {
  console.log('[sendInvitationEmail] Starting email send to:', email);
  const { sendEmail } = require('../utils/email');
  const subject = 'Undangan Bergabung - Everiware';
  
  const text = `Halo ${name},\n\nAnda telah didaftarkan sebagai karyawan di sistem absensi Everiware oleh HRD.\n\nUntuk mengaktifkan akun Anda dan mengatur password baru, silakan buka tautan berikut:\n${activationLink}\n\nTautan ini berlaku selama 7 hari.\n\nTerima kasih,\nTim HRD Everiware`;
  
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 40px 10px; margin: 0; color: #1e293b;">
      <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
        <!-- Header Banner -->
        <div style="background-color: #6B0E11; padding: 30px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 3px; font-style: italic;">EVERIWARE</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0 0; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;">Undangan Aktivasi Akun</p>
        </div>
        
        <!-- Content Body -->
        <div style="padding: 30px;">
          <p style="font-size: 16px; font-weight: 700; margin-top: 0; color: #0f172a;">Halo ${name},</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">Anda telah didaftarkan sebagai karyawan di sistem absensi <strong>Everiware</strong> oleh HRD.</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">Untuk mengaktifkan akun Anda, silakan klik tombol di bawah ini dan atur kata sandi baru Anda:</p>
          
          <!-- Button Box -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${activationLink}" style="background-color: #6B0E11; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 15px; box-shadow: 0 4px 10px rgba(107, 14, 17, 0.15);">
              Aktifkan Akun Saya
            </a>
          </div>
          
          <!-- Alternative Link Card -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 25px 0;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1px; display: block; margin-bottom: 5px;">Tautan Alternatif (Salin & Tempel di Browser):</span>
            <a href="${activationLink}" style="color: #6B0E11; font-size: 13px; word-break: break-all; text-decoration: underline;">${activationLink}</a>
          </div>
          
          <p style="font-size: 12px; color: #64748b;">* Tautan aktivasi ini berlaku selama <strong>7 hari</strong>.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;">
          
          <!-- Footer Info -->
          <div style="text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
            <p style="margin: 0 0 5px 0;">Email ini dikirimkan secara otomatis oleh sistem Everiware, mohon untuk tidak membalas.</p>
            <p style="margin: 0; font-weight: 600;">© 2026 Everiware · CV. Rajawali Bina Maju. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  console.log('[sendInvitationEmail] Calling sendEmail function...');
  const result = await sendEmail(email, subject, html, text);
  console.log('[sendInvitationEmail] Email sent! Message ID:', result.messageId);
  return result;
}

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, department, position, employee_id, join_date, is_active, new_password, manager_id, location_id } = req.body;

    // Jika ada new_password, hash dan update sekalian
    if (new_password) {
      const hashed = await bcrypt.hash(new_password, 10);
      await pool.query(
        'UPDATE users SET name = ?, phone = ?, role = ?, department = ?, position = ?, employee_id = ?, join_date = ?, is_active = ?, password = ?, manager_id = ?, location_id = ? WHERE id = ?',
        [name, phone, role, department, position, employee_id, join_date || null, is_active !== undefined ? is_active : true, hashed, manager_id || null, location_id || null, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET name = ?, phone = ?, role = ?, department = ?, position = ?, employee_id = ?, join_date = ?, is_active = ?, manager_id = ?, location_id = ? WHERE id = ?',
        [name, phone, role, department, position, employee_id, join_date || null, is_active !== undefined ? is_active : true, manager_id || null, location_id || null, id]
      );
    }

    res.json({ success: true, message: 'Data user berhasil diperbarui' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Deactivate user (soft delete)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ success: false, message: 'Tidak bisa menonaktifkan akun sendiri' });
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);
    res.json({ success: true, message: 'Akun karyawan berhasil dinonaktifkan' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Permanent delete user
const permanentDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ success: false, message: 'Tidak bisa menghapus akun sendiri' });
    const [rows] = await pool.query('SELECT name FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: `Akun ${rows[0].name} berhasil dihapus permanen` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Update profile (self)
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const avatar = req.file ? req.file.filename : undefined;

    console.log('[updateProfile] user:', req.user.id, '| file:', req.file?.filename, '| body:', req.body);

    // Jika hanya upload avatar (name/phone boleh kosong, ambil dari DB)
    if (avatar && !name) {
      await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.id]);
    } else {
      let query = 'UPDATE users SET name = ?, phone = ?';
      const params = [name || req.user.name, phone ?? req.user.phone];

      if (avatar) { query += ', avatar = ?'; params.push(avatar); }
      query += ' WHERE id = ?';
      params.push(req.user.id);

      await pool.query(query, params);
    }

    // Return updated user data including avatar
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, avatar, face_photo, role, department, position, employee_id, face_registered FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, message: 'Profil berhasil diperbarui', user: rows[0] });
  } catch (err) {
    console.error('[updateProfile] error:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];

    if (user.password) {
      const isMatch = await bcrypt.compare(old_password, user.password);
      if (!isMatch) return res.status(400).json({ success: false, message: 'Password lama salah' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Get notifications
const getNotifications = async (req, res) => {
  try {
    // Auto-hapus notifikasi > 7 hari yang sudah dibaca
    await pool.query(
      "DELETE FROM notifications WHERE user_id = ? AND is_read = TRUE AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)",
      [req.user.id]
    );

    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const [unread] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ success: true, notifications: rows, unread: unread[0].count });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Mark notification read
const markNotificationRead = async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, message: 'Notifikasi ditandai sudah dibaca' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Hapus satu notifikasi
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, message: 'Notifikasi dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Hapus semua notifikasi milik user
const deleteAllNotifications = async (req, res) => {
  try {
    const { only_read } = req.query;
    if (only_read === 'true') {
      await pool.query('DELETE FROM notifications WHERE user_id = ? AND is_read = TRUE', [req.user.id]);
      res.json({ success: true, message: 'Notifikasi yang sudah dibaca berhasil dihapus' });
    } else {
      await pool.query('DELETE FROM notifications WHERE user_id = ?', [req.user.id]);
      res.json({ success: true, message: 'Semua notifikasi berhasil dihapus' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Broadcast notification to all employees
const broadcastNotification = async (req, res) => {
  try {
    const { title, message, type, department, location_id } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: 'Judul dan pesan wajib diisi' });

    let sql = "SELECT id FROM users WHERE role = 'employee' AND is_active = TRUE";
    const params = [];

    if (department && department !== 'all') {
      sql += " AND department = ?";
      params.push(department);
    }
    if (location_id && location_id !== 'all') {
      sql += " AND location_id = ?";
      params.push(location_id);
    }

    const [employees] = await pool.query(sql, params);
    if (!employees.length) return res.status(400).json({ success: false, message: 'Tidak ada karyawan aktif yang cocok dengan kriteria target' });

    const values = employees.map(e => [generateId(), e.id, title, message, type || 'info']);
    await pool.query(
      'INSERT INTO notifications (id, user_id, title, message, type) VALUES ?',
      [values]
    );

    const { broadcastEvent } = require('../utils/realtimeManager');
    broadcastEvent('notification_update', { event: 'notification_update' });

    res.json({ success: true, message: `Notifikasi berhasil dikirim ke ${employees.length} karyawan` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const [totalUsers] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'employee' AND is_active = TRUE");
    const [presentToday] = await pool.query("SELECT COUNT(*) as count FROM attendances WHERE date = ? AND status IN ('present','late')", [today]);
    const [pendingLeaves] = await pool.query("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'");
    const [monthlyAttendance] = await pool.query("SELECT COUNT(*) as count FROM attendances WHERE MONTH(date) = ? AND YEAR(date) = ? AND status IN ('present','late')", [month, year]);

    res.json({
      success: true,
      stats: {
        total_employees: totalUsers[0].count,
        present_today: presentToday[0].count,
        pending_leaves: pendingLeaves[0].count,
        monthly_attendance: monthlyAttendance[0].count,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Get/Update settings
const getSettings = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM app_settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await pool.query('UPDATE app_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
    }
    res.json({ success: true, message: 'Pengaturan berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Save FCM token
const saveFcmToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token wajib diisi' });
    const id = generateId();
    await pool.query(
      `INSERT INTO fcm_tokens (id, user_id, token, platform) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE token = VALUES(token), updated_at = NOW()`,
      [id, req.user.id, token, platform || 'android']
    );
    res.json({ success: true, message: 'FCM token tersimpan' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Remove FCM token (logout)
const removeFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (token) {
      await pool.query('DELETE FROM fcm_tokens WHERE user_id = ? AND token = ?', [req.user.id, token]);
    } else {
      await pool.query('DELETE FROM fcm_tokens WHERE user_id = ?', [req.user.id]);
    }
    res.json({ success: true, message: 'FCM token dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Register face (self)
const registerFace = async (req, res) => {
  try {
    const facePhoto = req.file ? req.file.filename : undefined;
    if (!facePhoto) {
      return res.status(400).json({ success: false, message: 'File foto wajah tidak ditemukan' });
    }

    console.log('[registerFace] user:', req.user.id, '| file:', facePhoto);

    // Validasi foto wajah menggunakan Python AI Service (atau fallback)
    const detectResult = await validateRegistrationFace(facePhoto);
    if (!detectResult.success) {
      // Hapus file yang terunggah karena tidak valid
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../uploads/avatar', facePhoto);
      fs.unlink(filePath, () => {});

      return res.status(400).json({ success: false, message: detectResult.message });
    }

    // Update face_photo and set face_registered = TRUE
    await pool.query('UPDATE users SET face_photo = ?, face_registered = TRUE WHERE id = ?', [facePhoto, req.user.id]);

    // Return updated user data including face_photo
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, avatar, face_photo, role, department, position, employee_id, face_registered FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, message: 'Verifikasi wajah berhasil diaktifkan', user: rows[0] });
  } catch (err) {
    console.error('[registerFace] error:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};


module.exports = { getAllUsers, getUser, createUser, updateUser, deleteUser, permanentDeleteUser, updateProfile, changePassword, getNotifications, markNotificationRead, deleteNotification, deleteAllNotifications, broadcastNotification, getDashboardStats, getSettings, updateSettings, saveFcmToken, removeFcmToken, registerFace };
