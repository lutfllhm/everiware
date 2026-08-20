const { pool } = require('../config/database');
const { generateId, calculateDistance, nowWIBParts, detectImpossibleTravel } = require('../utils/helpers');
const { auditLog } = require('../utils/auditLog');
const { verifyFace } = require('../utils/faceVerification');

// Helper: waktu sekarang untuk DISIMPAN ke kolom DATETIME (check_in/check_out).
// Harus tetap instant UTC asli — koneksi mysql2 (lihat config/database.js) sudah
// diset `timezone: '+07:00'` dan akan mengonversinya ke WIB sendiri saat serialisasi.
// JANGAN geser manual di sini, atau nilai yang tersimpan akan dobel +7 jam.
const nowWIB = () => new Date();

const todayWIB = () => {
  const now = nowWIBParts();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Resolve shift kerja efektif seorang user pada tanggal tertentu.
// Prioritas: assignment di user_shifts (effective_date <= date terbaru) →
// fallback ke app_settings global (dianggap "Shift Reguler").
const resolveUserShift = async (userId, date) => {
  const [rows] = await pool.query(
    `SELECT ws.name, ws.start_time, ws.end_time, ws.late_tolerance
     FROM user_shifts us
     JOIN work_shifts ws ON us.shift_id = ws.id
     WHERE us.user_id = ? AND us.effective_date <= ? AND ws.is_active = TRUE
     ORDER BY us.effective_date DESC LIMIT 1`,
    [userId, date]
  );
  if (rows.length) {
    return {
      name: rows[0].name,
      start_time: rows[0].start_time,
      end_time: rows[0].end_time,
      late_tolerance: rows[0].late_tolerance,
    };
  }

  const [settings] = await pool.query(
    "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('work_start_time','work_end_time','late_tolerance')"
  );
  const s = Object.fromEntries(settings.map(r => [r.setting_key, r.setting_value]));
  return {
    name: 'Shift Reguler',
    start_time: s.work_start_time || '08:00',
    end_time: s.work_end_time || '17:00',
    late_tolerance: parseInt(s.late_tolerance || '10'),
  };
};

// Hitung apakah jam check-in (checkInMinutes, 0-1439) sudah melewati batas telat
// shift (workStartMinutes + tolerance), dengan menangani shift overnight (mis.
// shift 3: 00:00-08:00) di mana karyawan lazim check-in di malam sebelumnya
// (mis. jam 23:00) untuk shift yang baru dimulai jam 00:00 esoknya.
// Aturan: check-in yang terjadi dalam jendela "kedatangan lebih awal" (paling
// banyak EARLY_WINDOW_HOURS sebelum jam mulai, wrap 24 jam) dianggap tidak
// telat. Selain itu dihitung normal: telat jika melewati jam mulai + toleransi.
const EARLY_WINDOW_MINUTES = 4 * 60; // maksimal 4 jam lebih awal dianggap wajar
const isLateCheckIn = (checkInMinutes, workStartMinutes, toleranceMinutes) => {
  const DAY = 24 * 60;
  const diff = (((checkInMinutes - workStartMinutes) % DAY) + DAY) % DAY; // 0..DAY-1, arah maju dari jam mulai
  const early = DAY - diff; // seberapa jauh SEBELUM jam mulai (wrap)
  if (early > 0 && early <= EARLY_WINDOW_MINUTES) return false;
  return diff > toleranceMinutes;
};

const addDaysToDateStr = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};

// Cari baris attendance "aktif" (hari kerja shift) untuk user pada saat request
// terjadi. Shift bisa membentang lintas tengah malam dalam dua pola:
//  - shift SORE (mis. 16:00-00:00, end_time <= start_time): check-in
//    tersimpan tanggal H, tapi check-out terjadi setelah tengah malam
//    (tanggal H+1 sudah berjalan).
//  - shift MALAM (mis. 00:00-08:00, start_time dini hari): karyawan lazim
//    check-in di malam sebelumnya (mis. 23:00, dalam EARLY_WINDOW_MINUTES),
//    sehingga baris tersimpan tanggal H, lalu check-out terjadi paginya di
//    tanggal H+1.
// Kedua pola dideteksi dari BENTUK shift itu sendiri (bukan jam sekarang),
// supaya shift reguler (mis. 08:00-17:00) yang lupa check-out kemarin TIDAK
// ikut "menyambung" — baris bolongnya tetap dianggap lupa check-out, dan
// check-in baru hari ini tetap diperbolehkan sebagai baris baru.
const findActiveAttendanceRow = async (userId, todayStr) => {
  const [todayRows] = await pool.query('SELECT * FROM attendances WHERE user_id = ? AND date = ?', [userId, todayStr]);
  const todayRow = todayRows[0] || null;

  // Baris hari ini sudah cukup menjelaskan (sudah check-in) — tidak perlu
  // menengok kemarin lagi.
  if (todayRow && todayRow.check_in) return { row: todayRow, date: todayStr };

  const myShift = await resolveUserShift(userId, todayStr);
  const [startH, startM] = myShift.start_time.split(':').map(Number);
  const [endH, endM] = myShift.end_time.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  // Shift sore-lintas-malam: jam selesai "lebih kecil/sama" dari jam mulai
  // karena wrap tengah malam (mis. 16:00-00:00 → 0 <= 960).
  const isEveningOvernight = endMinutes <= startMinutes;
  // Shift malam: mulai dini hari, sehingga jendela "kedatangan lebih awal"
  // (EARLY_WINDOW_MINUTES sebelum start_time) menjangkau ke hari sebelumnya.
  const isNightShift = startMinutes < EARLY_WINDOW_MINUTES;

  if (isEveningOvernight || isNightShift) {
    const yesterdayStr = addDaysToDateStr(todayStr, -1);
    const [yRows] = await pool.query('SELECT * FROM attendances WHERE user_id = ? AND date = ?', [userId, yesterdayStr]);
    const yRow = yRows[0];
    if (yRow && yRow.check_in && !yRow.check_out) {
      return { row: yRow, date: yesterdayStr };
    }
  }

  return { row: todayRow, date: todayStr };
};

// Tentukan tanggal kerja (work-day) untuk CHECK-IN BARU (belum ada baris
// tersimpan sama sekali). Aturan shift malam (mis. 00:00-08:00): shift ini
// adalah SAMBUNGAN dari hari sebelumnya (mis. "shift malam Senin" berjalan
// dini hari Senin/Selasa, melanjutkan shift sore Senin) — jadi "hari kerja"
// selalu tanggal SEBELUM tengah malam, terlepas apakah karyawan check-in
// sebelum tengah malam (mis. 23:50, masih dalam jendela "boleh datang lebih
// awal") atau sesudahnya dalam toleransi keterlambatan (mis. 00:05). Jadi:
//  - checkin 23:50 Senin (night shift) → tanggal kerja = SENIN (hari ini)
//  - checkin 00:05 Selasa (night shift, masih dini hari) → tanggal kerja = SENIN (kemarin)
// Shift lain (reguler, atau shift sore yang wrap ke tengah malam saat
// PULANG) tidak terpengaruh — tanggal kerja tetap tanggal hari ini seperti
// biasa, karena check-in-nya sendiri terjadi sebelum tengah malam berjalan.
const resolveCheckInWorkDate = async (userId, todayStr) => {
  const myShift = await resolveUserShift(userId, todayStr);
  const [startH, startM] = myShift.start_time.split(':').map(Number);
  const [endH, endM] = myShift.end_time.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const isNightShift = startMinutes < EARLY_WINDOW_MINUTES;
  if (!isNightShift) return todayStr;

  const nowParts = nowWIBParts();
  const nowMinutes = nowParts.getUTCHours() * 60 + nowParts.getUTCMinutes();
  // Masih dini hari (sudah lewat tengah malam) dan belum melewati jam pulang
  // shift (mis. 08:00) — check-in ini melanjutkan shift yang SECARA JADWAL
  // dimulai kemarin, terlepas seberapa telat (mis. 00:05 maupun 03:00
  // sama-sama dianggap masih bagian shift kemarin; hanya statusnya yang
  // dihitung telat oleh isLateCheckIn).
  if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
    return addDaysToDateStr(todayStr, -1);
  }
  return todayStr;
};

// Check in
const checkIn = async (req, res) => {
  try {
    const { latitude, longitude, is_mocked } = req.body;
    const userId = req.user.id;
    const today = todayWIB();

    // ── Tolak jika device terdeteksi memakai mock/fake GPS ────────────────────
    if (is_mocked === 'true' || is_mocked === true) {
      return res.status(400).json({
        success: false,
        message: 'Lokasi palsu (fake GPS) terdeteksi. Nonaktifkan aplikasi mock location sebelum melakukan absensi.',
      });
    }

    const [satSettings] = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('saturday_work_enabled')"
    );
    const satEnabled = satSettings.find(s => s.setting_key === 'saturday_work_enabled')?.setting_value !== 'false';

    // Check if already checked in today (atau masih dalam shift semalam yang
    // belum check-out, untuk shift overnight seperti 00:00-08:00)
    const { row: openRow } = await findActiveAttendanceRow(userId, today);
    if (openRow && openRow.check_in && !openRow.check_out) {
      return res.status(400).json({ success: false, message: 'Kamu sudah absen masuk hari ini' });
    }

    // Tanggal kerja efektif untuk baris absensi ini. Untuk shift malam,
    // "hari kerja" selalu tanggal SEBELUM tengah malam (mis. checkin 23:50
    // Senin → tanggal kerja Senin; checkin 00:05 Selasa, masih dalam
    // toleransi → tanggal kerja tetap Senin/kemarin).
    const workDate = openRow ? today : await resolveCheckInWorkDate(userId, today);

    // Cek hari libur berdasarkan tanggal kerja efektif (dihitung ulang dari
    // string workDate, bukan offset dari `today` — workDate bisa jadi
    // kemarin ATAU hari ini tergantung jenis shift).
    const [wY, wM, wD] = workDate.split('-').map(Number);
    const workDateDow = new Date(Date.UTC(wY, wM - 1, wD)).getUTCDay();
    if (workDateDow === 0) {
      return res.status(400).json({ success: false, message: 'Hari Minggu libur, tidak ada absensi' });
    }
    if (workDateDow === 6 && !satEnabled) {
      return res.status(400).json({ success: false, message: 'Hari Sabtu libur sesuai pengaturan perusahaan' });
    }

    const [existing] = await pool.query('SELECT * FROM attendances WHERE user_id = ? AND date = ?', [userId, workDate]);

    // ── Cek izin yang tidak memblokir absensi (non-blocking permits) ──────────
    const [permits] = await pool.query(`
      SELECT lr.*, lt.blocks_attendance, lt.code as leave_type_code
      FROM leave_requests lr
      JOIN leave_types lt ON lr.type = lt.code
      WHERE lr.user_id = ? AND lr.start_date <= ? AND lr.end_date >= ?
        AND lr.status = 'approved' AND lt.blocks_attendance = FALSE
    `, [userId, workDate, workDate]);

    const hasNonBlockingPermit = permits.length > 0;
    const latePermit = permits.find(p => p.leave_type_code === 'late_permission');

    // Jika late_permission, validasi batas waktu maksimal
    if (latePermit) {
      const [setting] = await pool.query(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'late_permission_max_time'"
      );
      const maxTime = setting[0]?.setting_value || '11:00';
      const nowParts = nowWIBParts();
      const nowHHMM = `${String(nowParts.getUTCHours()).padStart(2, '0')}:${String(nowParts.getUTCMinutes()).padStart(2, '0')}`;
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
      `, [userId, workDate, workDate]);

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
    const [userRows] = await pool.query('SELECT face_photo, face_photo_left, face_photo_right, avatar FROM users WHERE id = ?', [userId]);
    const facePhotoFilename = userRows[0]?.face_photo;
    if (facePhotoFilename && facePhotoFilename.trim() !== '') {
      // face_bbox dikirim dari Flutter sebagai JSON string: {"x":..,"y":..,"width":..,"height":..}
      // Catatan: verifikasi WAJIB dijalankan di server terlepas dari klaim `local_verified`
      // dari client — flag itu mudah dipalsukan (mis. lewat proxy/APK yang dimodifikasi).
      let selfieBbox = null;
      try { selfieBbox = req.body.face_bbox ? JSON.parse(req.body.face_bbox) : null; } catch (_) {}
      const extraReferences = [userRows[0]?.face_photo_left, userRows[0]?.face_photo_right].filter(Boolean);
      const faceResult = await verifyFace(photoPath, facePhotoFilename, selfieBbox, extraReferences);
      console.log(`[Attendance CheckIn] Face verification for user ${userId}: match=${faceResult.match}, similarity=${faceResult.similarity}, message=${faceResult.message}`);
      if (!faceResult.match) {
        const fs = require('fs');
        const path = require('path');
        fs.unlink(path.join(__dirname, '../../uploads/selfie', photoPath), () => {});
        return res.status(400).json({
          success: false,
          message: faceResult.message,
          face_similarity: faceResult.similarity,
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const now = nowWIB();
    const id = generateId();

    // Determine status (late check) — berdasarkan shift yang ditetapkan untuk karyawan ini
    const myShift = await resolveUserShift(userId, workDate);
    const workStart = myShift.start_time;
    const tolerance = myShift.late_tolerance;

    const [startH, startM] = workStart.split(':').map(Number);
    const workStartMinutes = startH * 60 + startM;
    const nowParts = nowWIBParts();
    const nowMinutes = nowParts.getUTCHours() * 60 + nowParts.getUTCMinutes();

    // Jika memiliki non-blocking permit, set status 'present' walaupun terlambat
    let status;
    if (hasNonBlockingPermit) {
      status = 'present';
    } else {
      status = isLateCheckIn(nowMinutes, workStartMinutes, tolerance) ? 'late' : 'present';
    }

    // ── Impossible-travel check: bandingkan dengan titik absensi terakhir ─────
    // Tidak memblokir (GPS drift wajar bisa memicu false-positive), hanya
    // ditandai untuk direview HRD di panel admin.
    let anomalyNote = null;
    const [lastAtt] = await pool.query(
      `SELECT check_out_lat, check_out_lng, check_out, check_in_lat, check_in_lng, check_in
       FROM attendances WHERE user_id = ? AND date < ? ORDER BY date DESC LIMIT 1`,
      [userId, workDate]
    );
    if (lastAtt.length) {
      const prevLat = lastAtt[0].check_out_lat ?? lastAtt[0].check_in_lat;
      const prevLng = lastAtt[0].check_out_lng ?? lastAtt[0].check_in_lng;
      const prevTime = lastAtt[0].check_out ?? lastAtt[0].check_in;
      if (prevLat != null && prevLng != null && prevTime) {
        const travel = detectImpossibleTravel(
          parseFloat(prevLat), parseFloat(prevLng),
          parseFloat(latitude), parseFloat(longitude),
          prevTime, now
        );
        if (travel) {
          anomalyNote = `Jarak ${travel.distanceKm.toFixed(1)}km dari absensi sebelumnya, ` +
            `implikasi kecepatan ${travel.impliedSpeedKmh.toFixed(0)} km/jam`;
        }
      }
    }

    if (existing.length) {
      await pool.query(
        'UPDATE attendances SET check_in = ?, check_in_photo = ?, check_in_lat = ?, check_in_lng = ?, location_id = ?, status = ?, is_location_anomaly = ?, location_anomaly_note = ? WHERE id = ?',
        [now, photoPath, latitude, longitude, validLocation.id, status, !!anomalyNote, anomalyNote, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO attendances (id, user_id, date, check_in, check_in_photo, check_in_lat, check_in_lng, location_id, status, is_location_anomaly, location_anomaly_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, userId, workDate, now, photoPath, latitude, longitude, validLocation.id, status, !!anomalyNote, anomalyNote]
      );
    }

    // Pesan khusus Sabtu — berdasarkan hari kerja efektif (workDate), bukan
    // tanggal kalender saat request (bisa beda utk shift malam dini hari).
    const isSaturday = workDateDow === 6;
    const [satEndRow] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'saturday_end_time'");
    const satEnd = satEndRow[0]?.setting_value || '15:00';

    const baseMsg = status === 'late' ? '⚠️ Absen masuk berhasil (Terlambat)' : '✅ Absen masuk berhasil!';
    const satMsg = isSaturday ? ` Hari Sabtu, jam pulang ${satEnd} WIB.` : '';

    const { broadcastEvent } = require('../utils/realtimeManager');
    broadcastEvent('attendance_update', { event: 'attendance_update', type: 'check_in', userId, date: workDate });

    const [attResult] = await pool.query(
      `SELECT a.*, l.name as location_name FROM attendances a
       LEFT JOIN attendance_locations l ON a.location_id = l.id
       WHERE a.user_id = ? AND a.date = ?`,
      [userId, workDate]
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
    const { latitude, longitude, is_mocked } = req.body;
    const userId = req.user.id;
    const today = todayWIB();

    // ── Tolak jika device terdeteksi memakai mock/fake GPS ────────────────────
    if (is_mocked === 'true' || is_mocked === true) {
      return res.status(400).json({
        success: false,
        message: 'Lokasi palsu (fake GPS) terdeteksi. Nonaktifkan aplikasi mock location sebelum melakukan absensi.',
      });
    }

    const { row: activeRow, date: attendanceDate } = await findActiveAttendanceRow(userId, today);
    if (!activeRow || !activeRow.check_in) return res.status(400).json({ success: false, message: 'Kamu belum absen masuk hari ini' });
    if (activeRow.check_out) return res.status(400).json({ success: false, message: 'Kamu sudah absen pulang hari ini' });
    const existing = [activeRow];

    // ── Cek izin yang tidak memblokir absensi (non-blocking permits) ──────────
    const [permits] = await pool.query(`
      SELECT lr.*, lt.blocks_attendance, lt.code as leave_type_code
      FROM leave_requests lr
      JOIN leave_types lt ON lr.type = lt.code
      WHERE lr.user_id = ? AND lr.start_date <= ? AND lr.end_date >= ?
        AND lr.status = 'approved' AND lt.blocks_attendance = FALSE
    `, [userId, attendanceDate, attendanceDate]);

    const hasNonBlockingPermit = permits.length > 0;
    const earlyLeavePermit = permits.find(p => p.leave_type_code === 'early_leave');

    // Jika early_leave, validasi batas waktu minimal
    if (earlyLeavePermit) {
      const [setting] = await pool.query(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'early_leave_min_time'"
      );
      const minTime = setting[0]?.setting_value || '13:00';
      const nowParts = nowWIBParts();
      const nowHHMM = `${String(nowParts.getUTCHours()).padStart(2, '0')}:${String(nowParts.getUTCMinutes()).padStart(2, '0')}`;
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
      `, [userId, attendanceDate, attendanceDate]);

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
    const [userRowsOut] = await pool.query('SELECT face_photo, face_photo_left, face_photo_right, avatar FROM users WHERE id = ?', [userId]);
    const facePhotoFilenameOut = userRowsOut[0]?.face_photo;
    if (facePhotoFilenameOut && facePhotoFilenameOut.trim() !== '') {
      // Verifikasi WAJIB dijalankan di server terlepas dari klaim `local_verified` client.
      let selfieBbox = null;
      try { selfieBbox = req.body.face_bbox ? JSON.parse(req.body.face_bbox) : null; } catch (_) {}
      const extraReferencesOut = [userRowsOut[0]?.face_photo_left, userRowsOut[0]?.face_photo_right].filter(Boolean);
      const faceResult = await verifyFace(photoPath, facePhotoFilenameOut, selfieBbox, extraReferencesOut);
      console.log(`[Attendance CheckOut] Face verification for user ${userId}: match=${faceResult.match}, similarity=${faceResult.similarity}, message=${faceResult.message}`);
      if (!faceResult.match) {
        const fs = require('fs');
        const path = require('path');
        fs.unlink(path.join(__dirname, '../../uploads/selfie', photoPath), () => {});
        return res.status(400).json({
          success: false,
          message: faceResult.message,
          face_similarity: faceResult.similarity,
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const now = nowWIB();

    // ── Impossible-travel check: bandingkan dengan titik check-in hari ini ────
    let anomalyNote = null;
    const prevLat = existing[0].check_in_lat;
    const prevLng = existing[0].check_in_lng;
    const prevTime = existing[0].check_in;
    if (prevLat != null && prevLng != null && prevTime) {
      const travel = detectImpossibleTravel(
        parseFloat(prevLat), parseFloat(prevLng),
        parseFloat(latitude), parseFloat(longitude),
        prevTime, now
      );
      if (travel) {
        anomalyNote = `Jarak ${travel.distanceKm.toFixed(1)}km dari absen masuk, ` +
          `implikasi kecepatan ${travel.impliedSpeedKmh.toFixed(0)} km/jam`;
      }
    }
    // Anomali check-in yang sudah ada (jika ada) tetap dipertahankan jika check-out normal
    const finalAnomalyNote = anomalyNote || (existing[0].is_location_anomaly ? existing[0].location_anomaly_note : null);

    await pool.query(
      'UPDATE attendances SET check_out = ?, check_out_photo = ?, check_out_lat = ?, check_out_lng = ?, is_location_anomaly = ?, location_anomaly_note = ? WHERE user_id = ? AND date = ?',
      [now, photoPath, latitude, longitude, !!finalAnomalyNote, finalAnomalyNote, userId, attendanceDate]
    );

    const { broadcastEvent } = require('../utils/realtimeManager');
    broadcastEvent('attendance_update', { event: 'attendance_update', type: 'check_out', userId, date: attendanceDate });

    const [checkOutAttResult] = await pool.query(
      `SELECT a.*, l.name as location_name FROM attendances a
       LEFT JOIN attendance_locations l ON a.location_id = l.id
       WHERE a.user_id = ? AND a.date = ?`,
      [userId, attendanceDate]
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
    // Ambil baris "aktif" — untuk shift overnight yang belum check-out, ini
    // bisa jadi baris KEMARIN, bukan hari ini (mis. shift 00:00-08:00 yang
    // check-in-nya jam 23:00 malam sebelumnya).
    const { row: activeRow } = await findActiveAttendanceRow(req.user.id, today);
    const isCarriedOver = !!(activeRow && activeRow.check_in && !activeRow.check_out);
    // Tanggal acuan utk permit/shift info: tanggal baris aktif jika sedang
    // "menyambung" dari kemarin (shift malam belum check-out), else hari ini.
    const infoDate = isCarriedOver ? activeRow.date : today;
    let rows;
    if (isCarriedOver) {
      const [r] = await pool.query(
        `SELECT a.*, l.name as location_name FROM attendances a
         LEFT JOIN attendance_locations l ON a.location_id = l.id
         WHERE a.id = ?`,
        [activeRow.id]
      );
      rows = r;
    } else {
      const [r] = await pool.query(
        `SELECT a.*, l.name as location_name FROM attendances a
         LEFT JOIN attendance_locations l ON a.location_id = l.id
         WHERE a.user_id = ? AND a.date = ?`,
        [req.user.id, today]
      );
      rows = r;
    }

    // ── Cek izin yang tidak memblokir absensi (non-blocking permits) ──────────
    const [permits] = await pool.query(`
      SELECT lr.*, lt.code as leave_type_code, lt.blocks_attendance
      FROM leave_requests lr
      JOIN leave_types lt ON lr.type = lt.code
      WHERE lr.user_id = ? AND lr.start_date <= ? AND lr.end_date >= ?
        AND lr.status = 'approved' AND lt.blocks_attendance = FALSE
    `, [req.user.id, infoDate, infoDate]);

    // ── Ambil pengaturan permission times ─────────────────────────────────────
    const [permissionSettings] = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('late_permission_max_time','early_leave_min_time')"
    );
    const ps = Object.fromEntries(permissionSettings.map(r => [r.setting_key, r.setting_value]));

    // Kirim info jam kerja hari ini (termasuk Sabtu), berdasarkan shift karyawan
    const infoDateDow = isCarriedOver ? (nowWIBParts().getUTCDay() + 6) % 7 : nowWIBParts().getUTCDay();
    const [satSettings2] = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('saturday_work_enabled','saturday_end_time')"
    );
    const ss = Object.fromEntries(satSettings2.map(r => [r.setting_key, r.setting_value]));
    const myShift = await resolveUserShift(req.user.id, infoDate);

    const isSaturday = infoDateDow === 6;
    const isSunday   = infoDateDow === 0;
    const satEnabled = ss.saturday_work_enabled !== 'false';
    const endTime    = isSaturday && satEnabled ? (ss.saturday_end_time || '15:00') : myShift.end_time;

    res.json({
      success: true,
      attendance: rows[0] || null,
      active_permits: permits,
      permission_settings: {
        late_permission_max_time: ps.late_permission_max_time || '11:00',
        early_leave_min_time: ps.early_leave_min_time || '13:00',
      },
      work_info: {
        shift_name:       myShift.name,
        start_time:       myShift.start_time,
        end_time:         endTime,
        is_saturday:      isSaturday,
        is_sunday:        isSunday,
        saturday_enabled: satEnabled,
        saturday_end_time: ss.saturday_end_time || '15:00',
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
    const m = month || nowWIBParts().getUTCMonth() + 1;
    const y = year || nowWIBParts().getUTCFullYear();

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

// Admin: Get "kehadiran hari ini" — baris attendance yang secara efektif
// termasuk hari kerja aktif sekarang. Berbeda dari filter `date = today`
// polos: shift malam (mis. 00:00-08:00) yang check-in-nya terjadi SEBELUM
// tengah malam (mis. 23:50) dicatat dengan `date` = BESOK (lihat
// resolveCheckInWorkDate), sehingga baris itu tidak akan muncul di filter
// tanggal biasa sampai tanggal kalender ikut berganti — padahal karyawan
// tersebut sudah check-in secara fisik. Endpoint ini menutup celah itu
// dengan turut menyertakan baris besok yang sudah check-in tapi belum
// check-out.
const getActiveTodayAttendances = async (req, res) => {
  try {
    const today = todayWIB();
    const tomorrow = addDaysToDateStr(today, 1);

    const [rows] = await pool.query(
      `SELECT a.*, u.name as user_name, u.employee_id, u.department, u.position, u.avatar as user_avatar, l.name as location_name
       FROM attendances a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN attendance_locations l ON a.location_id = l.id
       WHERE a.date = ?
          OR (a.date = ? AND a.check_in IS NOT NULL AND a.check_out IS NULL)
       ORDER BY a.date DESC, u.name ASC`,
      [today, tomorrow]
    );

    res.json({ success: true, attendances: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get all attendances
const getAllAttendances = async (req, res) => {
  try {
    const { month, year, userId, page = 1, limit = 20 } = req.query;
    const m = month || nowWIBParts().getUTCMonth() + 1;
    const y = year || nowWIBParts().getUTCFullYear();
    const offset = (page - 1) * limit;

    let query = `SELECT a.*, u.name as user_name, u.employee_id, u.department, u.position, u.avatar as user_avatar, l.name as location_name,
                 (SELECT ws.name FROM user_shifts us
                   JOIN work_shifts ws ON us.shift_id = ws.id
                   WHERE us.user_id = a.user_id AND us.effective_date <= a.date AND ws.is_active = TRUE
                   ORDER BY us.effective_date DESC LIMIT 1) as shift_name
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
      const m = parseInt(month) || nowWIBParts().getUTCMonth() + 1;
      const y = parseInt(year)  || nowWIBParts().getUTCFullYear();
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
      const myShift = await resolveUserShift(att.user_id, dateStr);
      const [wh, wm] = myShift.start_time.split(':').map(Number);
      const tolerance = myShift.late_tolerance;
      const [ih, im] = check_in.split(':').map(Number);
      const workMins = wh * 60 + wm;
      const inMins   = ih * 60 + im;
      newStatus = isLateCheckIn(inMins, workMins, tolerance) ? 'late' : 'present';
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

module.exports = { checkIn, checkOut, getTodayAttendance, getMyAttendance, getAllAttendances, getActiveTodayAttendances, getAttendanceReport, getLocations, createLocation, updateLocation, deleteLocation, deleteAttendance, updateAttendance, resolveUserShift };
