const { pool } = require('../config/database');
const { generateId, calculateDistance } = require('../utils/helpers');
const { auditLog } = require('../utils/auditLog');
const { verifyFace } = require('../utils/faceVerification');

// Helper: waktu sekarang (server berjalan di timezone lokal/WIB)
const nowWIB = () => new Date();

const todayWIB = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Check in
const checkIn = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id;
    const today = todayWIB();

    // Cek apakah hari ini Sabtu dan apakah Sabtu masuk kerja
    const dayOfWeek = new Date().getDay(); // 6 = Sabtu
    const [satSettings] = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('saturday_work_enabled')"
    );
    const satEnabled = satSettings.find(s => s.setting_key === 'saturday_work_enabled')?.setting_value !== 'false';

    if (dayOfWeek === 0) {
      return res.status(400).json({ success: false, message: 'Hari Minggu libur, tidak ada absensi' });
    }
    if (dayOfWeek === 6 && !satEnabled) {
      return res.status(400).json({ success: false, message: 'Hari Sabtu libur sesuai pengaturan perusahaan' });
    }

    // Check if already checked in today
    const [existing] = await pool.query('SELECT * FROM attendances WHERE user_id = ? AND date = ?', [userId, today]);
    if (existing.length && existing[0].check_in) {
      return res.status(400).json({ success: false, message: 'Kamu sudah absen masuk hari ini' });
    }

    // ── Cek izin yang tidak memblokir absensi (non-blocking permits) ──────────
    const [permits] = await pool.query(`
      SELECT lr.*, lt.blocks_attendance, lt.code as leave_type_code
      FROM leave_requests lr
      JOIN leave_types lt ON lr.type = lt.code
      WHERE lr.user_id = ? AND lr.start_date <= ? AND lr.end_date >= ?
        AND lr.status = 'approved' AND lt.blocks_attendance = FALSE
    `, [userId, today, today]);

    const hasNonBlockingPermit = permits.length > 0;
    const latePermit = permits.find(p => p.leave_type_code === 'late_permission');

    // Jika late_permission, validasi batas waktu maksimal
    if (latePermit) {
      const [setting] = await pool.query(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'late_permission_max_time'"
      );
      const maxTime = setting[0]?.setting_value || '11:00';
      const now = nowWIB();
      const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (nowHHMM > maxTime) {
        return res.status(400).json({
          success: false,
          message: `Izin terlambat maksimal pukul ${maxTime} WIB`
        });
      }
    }

    // ── Cek izin yang memblokir absensi (blocking leave) ─────────────────────
    if (!hasNonBlockingPermit) {
      const [blockingLeave] = await pool.query(`
        SELECT lr.id
        FROM leave_requests lr
        JOIN leave_types lt ON lr.type = lt.code
        WHERE lr.user_id = ? AND lr.start_date <= ? AND lr.end_date >= ?
          AND lr.status = 'approved' AND lt.blocks_attendance = TRUE
      `, [userId, today, today]);

      if (blockingLeave.length) {
        return res.status(400).json({
          success: false,
          message: 'Kamu sedang dalam masa cuti/izin yang memblokir absensi'
        });
      }
    }

    // Validate location
    // Ambil data lokasi penempatan user
    const [locationUserRows] = await pool.query('SELECT location_id FROM users WHERE id = ?', [userId]);
    const assignedLocationId = locationUserRows[0]?.location_id;

    let queryLocations = 'SELECT * FROM attendance_locations WHERE is_active = TRUE';
    const queryParams = [];
    if (assignedLocationId) {
      queryLocations += ' AND id = ?';
      queryParams.push(assignedLocationId);
    }
    
    const [locations] = await pool.query(queryLocations, queryParams);
    
    if (!locations.length) {
      if (assignedLocationId) {
        return res.status(400).json({ success: false, message: 'Lokasi penempatan Anda tidak aktif atau tidak ditemukan' });
      } else {
        return res.status(400).json({ success: false, message: 'Anda belum memiliki lokasi penempatan. Silakan hubungi HRD.' });
      }
    }

    let validLocation = null;
    for (const loc of locations) {
      const distance = calculateDistance(parseFloat(latitude), parseFloat(longitude), parseFloat(loc.latitude), parseFloat(loc.longitude));
      if (distance <= loc.radius) { validLocation = loc; break; }
    }

    if (!validLocation) {
      if (assignedLocationId) {
        return res.status(400).json({ success: false, message: `Kamu berada di luar area lokasi penempatan (${locations[0].name}).` });
      } else {
        return res.status(400).json({ success: false, message: 'Kamu berada di luar area absensi yang ditentukan. Pastikan kamu berada di lokasi kerja.' });
      }
    }

    if (!req.file) return res.status(400).json({ success: false, message: 'Foto selfie wajib diupload' });

    const photoPath = req.file.filename;

    // ── Face Verification ─────────────────────────────────────────────────────
    const [userRows] = await pool.query('SELECT face_photo, avatar FROM users WHERE id = ?', [userId]);
    const facePhotoFilename = userRows[0]?.face_photo;
    const localVerified = req.body.local_verified === 'true';
    if (facePhotoFilename && facePhotoFilename.trim() !== '' && !localVerified) {
      // face_bbox dikirim dari Flutter sebagai JSON string: {"x":..,"y":..,"width":..,"height":..}
      let selfieBbox = null;
      try { selfieBbox = req.body.face_bbox ? JSON.parse(req.body.face_bbox) : null; } catch (_) {}
      const faceResult = await verifyFace(photoPath, facePhotoFilename, selfieBbox);
      console.log(`[Attendance CheckIn] Face verification for user ${userId}: match=${faceResult.match}, similarity=${faceResult.similarity}, message=${faceResult.message}`);
      if (!faceResult.match && !faceResult.message.startsWith('skip')) {
        const fs = require('fs');
        const path = require('path');
        fs.unlink(path.join(__dirname, '../../uploads/selfie', photoPath), () => {});
        return res.status(400).json({
          success: false,
          message: faceResult.message,
          face_similarity: faceResult.similarity,
        });
      }
    } else {
      console.log(`[Attendance CheckIn] Face verification bypassed for user ${userId}: localVerified=${localVerified}, hasFacePhoto=${!!facePhotoFilename}`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const now = nowWIB();
    const id = generateId();

    // Determine status (late check)
    const [settings] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'work_start_time'");
    const workStart = settings[0]?.setting_value || '08:00';
    const [toleranceRow] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'late_tolerance'");
    const tolerance = parseInt(toleranceRow[0]?.setting_value || '15');

    const [startH, startM] = workStart.split(':').map(Number);
    const workStartMinutes = startH * 60 + startM + tolerance;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Jika memiliki non-blocking permit, set status 'present' walaupun terlambat
    let status;
    if (hasNonBlockingPermit) {
      status = 'present';
    } else {
      status = nowMinutes > workStartMinutes ? 'late' : 'present';
    }

    if (existing.length) {
      await pool.query(
        'UPDATE attendances SET check_in = ?, check_in_photo = ?, check_in_lat = ?, check_in_lng = ?, location_id = ?, status = ? WHERE id = ?',
        [now, photoPath, latitude, longitude, validLocation.id, status, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO attendances (id, user_id, date, check_in, check_in_photo, check_in_lat, check_in_lng, location_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, userId, today, now, photoPath, latitude, longitude, validLocation.id, status]
      );
    }

    // Pesan khusus Sabtu
    const isSaturday = dayOfWeek === 6;
    const [satEndRow] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'saturday_end_time'");
    const satEnd = satEndRow[0]?.setting_value || '15:00';

    const baseMsg = status === 'late' ? '⚠️ Absen masuk berhasil (Terlambat)' : '✅ Absen masuk berhasil!';
    const satMsg = isSaturday ? ` Hari Sabtu, jam pulang ${satEnd} WIB.` : '';

    const { broadcastEvent } = require('../utils/realtimeManager');
    broadcastEvent('attendance_update', { event: 'attendance_update', type: 'check_in', userId, date: today });

    const [attResult] = await pool.query(
      `SELECT a.*, l.name as location_name FROM attendances a
       LEFT JOIN attendance_locations l ON a.location_id = l.id
       WHERE a.user_id = ? AND a.date = ?`,
      [userId, today]
    );

    res.json({
      success: true,
      message: baseMsg + satMsg,
      status,
      location: validLocation.name,
      is_saturday: isSaturday,
      saturday_end_time: isSaturday ? satEnd : null,
      attendance: attResult[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Check out
const checkOut = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id;
    const today = todayWIB();

    const [existing] = await pool.query('SELECT * FROM attendances WHERE user_id = ? AND date = ?', [userId, today]);
    if (!existing.length || !existing[0].check_in) return res.status(400).json({ success: false, message: 'Kamu belum absen masuk hari ini' });
    if (existing[0].check_out) return res.status(400).json({ success: false, message: 'Kamu sudah absen pulang hari ini' });

    // ── Cek izin yang tidak memblokir absensi (non-blocking permits) ──────────
    const [permits] = await pool.query(`
      SELECT lr.*, lt.blocks_attendance, lt.code as leave_type_code
      FROM leave_requests lr
      JOIN leave_types lt ON lr.type = lt.code
      WHERE lr.user_id = ? AND lr.start_date <= ? AND lr.end_date >= ?
        AND lr.status = 'approved' AND lt.blocks_attendance = FALSE
    `, [userId, today, today]);

    const hasNonBlockingPermit = permits.length > 0;
    const earlyLeavePermit = permits.find(p => p.leave_type_code === 'early_leave');

    // Jika early_leave, validasi batas waktu minimal
    if (earlyLeavePermit) {
      const [setting] = await pool.query(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'early_leave_min_time'"
      );
      const minTime = setting[0]?.setting_value || '13:00';
      const now = nowWIB();
      const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (nowHHMM < minTime) {
        return res.status(400).json({
          success: false,
          message: `Izin pulang cepat minimal pukul ${minTime} WIB`
        });
      }
    }

    // ── Cek izin yang memblokir absensi (blocking leave) ─────────────────────
    if (!hasNonBlockingPermit) {
      const [blockingLeave] = await pool.query(`
        SELECT lr.id
        FROM leave_requests lr
        JOIN leave_types lt ON lr.type = lt.code
        WHERE lr.user_id = ? AND lr.start_date <= ? AND lr.end_date >= ?
          AND lr.status = 'approved' AND lt.blocks_attendance = TRUE
      `, [userId, today, today]);

      if (blockingLeave.length) {
        return res.status(400).json({
          success: false,
          message: 'Kamu sedang dalam masa cuti/izin yang memblokir absensi'
        });
      }
    }

    // Validate location
    // Ambil data lokasi penempatan user
    const [locationUserRowsOut] = await pool.query('SELECT location_id FROM users WHERE id = ?', [userId]);
    const assignedLocationId = locationUserRowsOut[0]?.location_id;

    let queryLocationsOut = 'SELECT * FROM attendance_locations WHERE is_active = TRUE';
    const queryParamsOut = [];
    if (assignedLocationId) {
      queryLocationsOut += ' AND id = ?';
      queryParamsOut.push(assignedLocationId);
    }

    const [locations] = await pool.query(queryLocationsOut, queryParamsOut);

    if (!locations.length) {
      if (assignedLocationId) {
        return res.status(400).json({ success: false, message: 'Lokasi penempatan Anda tidak aktif atau tidak ditemukan' });
      } else {
        return res.status(400).json({ success: false, message: 'Anda belum memiliki lokasi penempatan. Silakan hubungi HRD.' });
      }
    }

    let validLocation = null;
    for (const loc of locations) {
      const distance = calculateDistance(parseFloat(latitude), parseFloat(longitude), parseFloat(loc.latitude), parseFloat(loc.longitude));
      if (distance <= loc.radius) { validLocation = loc; break; }
    }

    if (!validLocation) {
      if (assignedLocationId) {
        return res.status(400).json({ success: false, message: `Kamu berada di luar area lokasi penempatan (${locations[0].name}).` });
      } else {
        return res.status(400).json({ success: false, message: 'Kamu berada di luar area absensi yang ditentukan' });
      }
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Foto selfie wajib diupload' });

    const photoPath = req.file.filename;

    // ── Face Verification ─────────────────────────────────────────────────────
    const [userRowsOut] = await pool.query('SELECT face_photo, avatar FROM users WHERE id = ?', [userId]);
    const facePhotoFilenameOut = userRowsOut[0]?.face_photo;
    const localVerifiedOut = req.body.local_verified === 'true';
    if (facePhotoFilenameOut && facePhotoFilenameOut.trim() !== '' && !localVerifiedOut) {
      let selfieBbox = null;
      try { selfieBbox = req.body.face_bbox ? JSON.parse(req.body.face_bbox) : null; } catch (_) {}
      const faceResult = await verifyFace(photoPath, facePhotoFilenameOut, selfieBbox);
      console.log(`[Attendance CheckOut] Face verification for user ${userId}: match=${faceResult.match}, similarity=${faceResult.similarity}, message=${faceResult.message}`);
      if (!faceResult.match && !faceResult.message.startsWith('skip')) {
        const fs = require('fs');
        const path = require('path');
        fs.unlink(path.join(__dirname, '../../uploads/selfie', photoPath), () => {});
        return res.status(400).json({
          success: false,
          message: faceResult.message,
          face_similarity: faceResult.similarity,
        });
      }
    } else {
      console.log(`[Attendance CheckOut] Face verification bypassed for user ${userId}: localVerified=${localVerifiedOut}, hasFacePhoto=${!!facePhotoFilenameOut}`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const now = nowWIB();

    await pool.query(
      'UPDATE attendances SET check_out = ?, check_out_photo = ?, check_out_lat = ?, check_out_lng = ? WHERE user_id = ? AND date = ?',
      [now, photoPath, latitude, longitude, userId, today]
    );

    const { broadcastEvent } = require('../utils/realtimeManager');
    broadcastEvent('attendance_update', { event: 'attendance_update', type: 'check_out', userId, date: today });

    const [checkOutAttResult] = await pool.query(
      `SELECT a.*, l.name as location_name FROM attendances a
       LEFT JOIN attendance_locations l ON a.location_id = l.id
       WHERE a.user_id = ? AND a.date = ?`,
      [userId, today]
    );

    res.json({
      success: true,
      message: '✅ Absen pulang berhasil!',
      attendance: checkOutAttResult[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Get today attendance
const getTodayAttendance = async (req, res) => {
  try {
    const today = todayWIB();
    const [rows] = await pool.query(
      `SELECT a.*, l.name as location_name FROM attendances a
       LEFT JOIN attendance_locations l ON a.location_id = l.id
       WHERE a.user_id = ? AND a.date = ?`,
      [req.user.id, today]
    );

    // ── Cek izin yang tidak memblokir absensi (non-blocking permits) ──────────
    const [permits] = await pool.query(`
      SELECT lr.*, lt.code as leave_type_code, lt.blocks_attendance
      FROM leave_requests lr
      JOIN leave_types lt ON lr.type = lt.code
      WHERE lr.user_id = ? AND lr.start_date <= ? AND lr.end_date >= ?
        AND lr.status = 'approved' AND lt.blocks_attendance = FALSE
    `, [req.user.id, today, today]);

    // ── Ambil pengaturan permission times ─────────────────────────────────────
    const [permissionSettings] = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('late_permission_max_time','early_leave_min_time')"
    );
    const ps = Object.fromEntries(permissionSettings.map(r => [r.setting_key, r.setting_value]));

    // Kirim info jam kerja hari ini (termasuk Sabtu)
    const dayOfWeek = new Date().getDay();
    const [workSettings] = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('work_start_time','work_end_time','saturday_work_enabled','saturday_end_time')"
    );
    const ws = Object.fromEntries(workSettings.map(r => [r.setting_key, r.setting_value]));

    const isSaturday = dayOfWeek === 6;
    const isSunday   = dayOfWeek === 0;
    const satEnabled = ws.saturday_work_enabled !== 'false';
    const endTime    = isSaturday && satEnabled ? (ws.saturday_end_time || '15:00') : (ws.work_end_time || '17:00');

    res.json({
      success: true,
      attendance: rows[0] || null,
      active_permits: permits,
      permission_settings: {
        late_permission_max_time: ps.late_permission_max_time || '11:00',
        early_leave_min_time: ps.early_leave_min_time || '13:00',
      },
      work_info: {
        start_time:       ws.work_start_time || '08:00',
        end_time:         endTime,
        is_saturday:      isSaturday,
        is_sunday:        isSunday,
        saturday_enabled: satEnabled,
        saturday_end_time: ws.saturday_end_time || '15:00',
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Get my attendance history
const getMyAttendance = async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT a.*, l.name as location_name FROM attendances a 
       LEFT JOIN attendance_locations l ON a.location_id = l.id 
       WHERE a.user_id = ? AND MONTH(a.date) = ? AND YEAR(a.date) = ?
       ORDER BY a.date DESC`,
      [req.user.id, m, y]
    );
    res.json({ success: true, attendances: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get all attendances
const getAllAttendances = async (req, res) => {
  try {
    const { month, year, userId, page = 1, limit = 20 } = req.query;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();
    const offset = (page - 1) * limit;

    let query = `SELECT a.*, u.name as user_name, u.employee_id, u.department, u.position, u.avatar as user_avatar, l.name as location_name 
                 FROM attendances a 
                 JOIN users u ON a.user_id = u.id 
                 LEFT JOIN attendance_locations l ON a.location_id = l.id 
                 WHERE MONTH(a.date) = ? AND YEAR(a.date) = ?`;
    const params = [m, y];

    if (userId) { query += ' AND a.user_id = ?'; params.push(userId); }
    query += ' ORDER BY a.date DESC, u.name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM attendances a WHERE MONTH(a.date) = ? AND YEAR(a.date) = ?${userId ? ' AND a.user_id = ?' : ''}`,
      userId ? [m, y, userId] : [m, y]
    );

    res.json({ success: true, attendances: rows, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get attendance report (support range tanggal atau bulan/tahun)
const getAttendanceReport = async (req, res) => {
  try {
    const { month, year, start_date, end_date, department, employee_id } = req.query;

    let dateFilter, params, periodLabel;

    if (start_date && end_date) {
      dateFilter = 'AND a.date >= ? AND a.date <= ?';
      params = [start_date, end_date, start_date, end_date];
      periodLabel = `${start_date} s/d ${end_date}`;
    } else {
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year)  || new Date().getFullYear();
      dateFilter = 'AND MONTH(a.date) = ? AND YEAR(a.date) = ?';
      params = [m, y, m, y];
      periodLabel = `${m}/${y}`;
    }

    let userFilter = '';
    if (department) { userFilter += ' AND u.department = ?'; params.push(department); }
    if (employee_id) { userFilter += ' AND u.employee_id = ?'; params.push(employee_id); }

    const [summary] = await pool.query(
      `SELECT 
        u.id, u.name, u.employee_id, u.department, u.position, u.avatar,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'late'    THEN 1 END) as late_count,
        COUNT(CASE WHEN a.status = 'absent'  THEN 1 END) as absent_count,
        COUNT(CASE WHEN a.status = 'leave'   THEN 1 END) as leave_count,
        COUNT(CASE WHEN a.status = 'sick'    THEN 1 END) as sick_count,
        COUNT(a.id) as total_days
       FROM users u
       LEFT JOIN attendances a ON u.id = a.user_id ${dateFilter}
       WHERE u.role = 'employee' AND u.is_active = TRUE ${userFilter}
       GROUP BY u.id ORDER BY u.name`,
      params
    );

    res.json({ success: true, report: summary, period: periodLabel, start_date, end_date, month, year });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Locations CRUD
const getLocations = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM attendance_locations ORDER BY created_at DESC');
    res.json({ success: true, locations: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const createLocation = async (req, res) => {
  try {
    const { name, latitude, longitude, radius } = req.body;

    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Nama, latitude, dan longitude wajib diisi' });
    }

    const id = generateId();
    await pool.query(
      'INSERT INTO attendance_locations (id, name, latitude, longitude, radius, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, parseFloat(latitude), parseFloat(longitude), parseInt(radius) || 100, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Lokasi berhasil ditambahkan' });
  } catch (err) {
    console.error('createLocation error:', err);
    res.status(500).json({ success: false, message: err.sqlMessage || 'Terjadi kesalahan server' });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, latitude, longitude, radius, is_active } = req.body;
    await pool.query(
      'UPDATE attendance_locations SET name = ?, latitude = ?, longitude = ?, radius = ?, is_active = ? WHERE id = ?',
      [name, latitude, longitude, radius, is_active, id]
    );
    res.json({ success: true, message: 'Lokasi berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

const deleteLocation = async (req, res) => {
  try {
    await pool.query('DELETE FROM attendance_locations WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Lokasi berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Delete attendance record
const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id FROM attendances WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    await pool.query('DELETE FROM attendances WHERE id = ?', [id]);
    await auditLog(req, 'DELETE_ATTENDANCE', 'attendance', id, `Menghapus data absensi`);

    const { broadcastEvent } = require('../utils/realtimeManager');
    broadcastEvent('attendance_update', { event: 'attendance_update', type: 'delete', id });

    res.json({ success: true, message: 'Data absensi berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Update attendance record (admin manual edit)
const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { check_in, check_out, status, notes } = req.body;

    const [rows] = await pool.query('SELECT * FROM attendances WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });

    const att = rows[0];
    const dateStr = att.date instanceof Date
      ? att.date.toISOString().split('T')[0]
      : String(att.date).split('T')[0];

    // Validasi format waktu jika diisi
    const checkInVal  = check_in  ? `${dateStr} ${check_in}`  : att.check_in;
    const checkOutVal = check_out ? `${dateStr} ${check_out}` : att.check_out;

    // Validasi check_out > check_in
    if (checkInVal && checkOutVal && new Date(checkOutVal) <= new Date(checkInVal)) {
      return res.status(400).json({ success: false, message: 'Jam pulang harus lebih dari jam masuk' });
    }

    // Hitung ulang status jika check_in berubah
    let newStatus = status || att.status;
    if (check_in && ['present', 'late'].includes(newStatus)) {
      const [settings] = await pool.query(
        "SELECT setting_value FROM app_settings WHERE setting_key IN ('work_start_time','late_tolerance')"
      );
      const ws = Object.fromEntries(settings.map(r => [r.setting_key, r.setting_value]));
      const [wh, wm] = (ws.work_start_time || '08:00').split(':').map(Number);
      const tolerance = parseInt(ws.late_tolerance || '10');
      const [ih, im] = check_in.split(':').map(Number);
      const workMins = wh * 60 + wm + tolerance;
      const inMins   = ih * 60 + im;
      newStatus = inMins > workMins ? 'late' : 'present';
    }

    await pool.query(
      'UPDATE attendances SET check_in = ?, check_out = ?, status = ?, notes = ? WHERE id = ?',
      [checkInVal, checkOutVal, newStatus, notes ?? att.notes, id]
    );

    await auditLog(req, 'EDIT_ATTENDANCE', 'attendance', id,
      `Edit absensi ${dateStr}: masuk=${check_in||'-'} pulang=${check_out||'-'} status=${newStatus}`);

    const { broadcastEvent } = require('../utils/realtimeManager');
    broadcastEvent('attendance_update', { event: 'attendance_update', type: 'edit', id });

    res.json({ success: true, message: 'Data absensi berhasil diperbarui' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = { checkIn, checkOut, getTodayAttendance, getMyAttendance, getAllAttendances, getAttendanceReport, getLocations, createLocation, updateLocation, deleteLocation, deleteAttendance, updateAttendance };
