const { pool } = require('../config/database');
const { generateId, getWorkingDays } = require('../utils/helpers');
const { sendLeaveNotification } = require('../utils/email');
const { sendPushNotification } = require('../utils/fcm');
const { auditLog } = require('../utils/auditLog');

// ── Helper: kirim notif DB + push sekaligus ───────────────────────────────────
const notify = async (userId, title, message, type = 'info') => {
  const id = generateId();
  await pool.query(
    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
    [id, userId, title, message, type]
  );
  await sendPushNotification(userId, title, message).catch(() => {});
};

// ── Helper: finalize approved leave (quota + attendance) ──────────────────────
const finalizeApproval = async (leave) => {
  const [ltRows] = await pool.query('SELECT deducts_quota, blocks_attendance FROM leave_types WHERE code = ?', [leave.type]);
  const leaveType = ltRows[0];
  if (leaveType?.deducts_quota) {
    const year = new Date(leave.start_date).getFullYear();
    await pool.query(
      'UPDATE leave_quotas SET used_days = used_days + ?, remaining_days = remaining_days - ? WHERE user_id = ? AND year = ?',
      [leave.total_days, leave.total_days, leave.user_id, year]
    );
  }
  if (leaveType?.blocks_attendance) {
    const attStatus = leave.type === 'sick' ? 'sick' : 'leave';
    const start = new Date(leave.start_date);
    const end   = new Date(leave.end_date);

    // Ambil hari libur dalam range
    const [holidayRows] = await pool.query(
      'SELECT date FROM public_holidays WHERE date >= ? AND date <= ?',
      [leave.start_date, leave.end_date]
    ).catch(() => [[]]);
    const holidaySet = new Set(holidayRows.map(r => {
      const d = new Date(r.date);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }));

    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      const dateStr = cur.toISOString().split('T')[0];
      // Skip Minggu (0) dan hari libur — Sabtu (6) tetap masuk
      if (day !== 0 && !holidaySet.has(dateStr)) {
        const attId = generateId();
        await pool.query(
          'INSERT INTO attendances (id, user_id, date, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = ?',
          [attId, leave.user_id, dateStr, attStatus, attStatus]
        );
      }
      cur.setDate(cur.getDate() + 1);
    }
  }
};

// ── FITUR 4: Carry-over sisa cuti ─────────────────────────────────────────────
const carryOverQuota = async (userId, fromYear, toYear) => {
  try {
    const [settings] = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('leave_carryover_enabled','leave_carryover_max_days','annual_leave_days','leave_increment_per_year')"
    );
    const s = Object.fromEntries(settings.map(r => [r.setting_key, r.setting_value]));
    if (s.leave_carryover_enabled !== 'true') return 0;

    const maxCarry = parseInt(s.leave_carryover_max_days || '5');
    const [prevQuota] = await pool.query('SELECT * FROM leave_quotas WHERE user_id = ? AND year = ?', [userId, fromYear]);
    const carryDays = prevQuota.length ? Math.min(prevQuota[0].remaining_days, maxCarry) : 0;

    const [userRows] = await pool.query('SELECT join_date FROM users WHERE id = ?', [userId]);
    const joinYear = userRows[0]?.join_date ? new Date(userRows[0].join_date).getFullYear() : toYear;
    const yearsWorked = toYear - joinYear;
    const baseDays = parseInt(s.annual_leave_days || '12');
    const increment = parseInt(s.leave_increment_per_year || '1');
    const newTotal = baseDays + (yearsWorked * increment) + carryDays;

    const id = generateId();
    await pool.query(
      'INSERT INTO leave_quotas (id, user_id, year, total_days, remaining_days) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
      [id, userId, toYear, newTotal, newTotal]
    );
    return carryDays;
  } catch { return 0; }
};

// ── GET MY QUOTA (dengan carry-over otomatis) ─────────────────────────────────
const getMyQuota = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const [rows] = await pool.query('SELECT * FROM leave_quotas WHERE user_id = ? AND year = ?', [req.user.id, year]);

    if (!rows.length) {
      const carried = await carryOverQuota(req.user.id, year - 1, year);
      const [newRows] = await pool.query('SELECT * FROM leave_quotas WHERE user_id = ? AND year = ?', [req.user.id, year]);
      if (newRows.length) {
        return res.json({ success: true, quota: { ...newRows[0], carried_days: carried } });
      }
      // Fallback jika carry-over tidak membuat row
      const [userRows] = await pool.query('SELECT join_date FROM users WHERE id = ?', [req.user.id]);
      const joinYear = userRows[0]?.join_date ? new Date(userRows[0].join_date).getFullYear() : year;
      const yearsWorked = year - joinYear;
      const [settingRows] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key IN ('annual_leave_days','leave_increment_per_year')");
      const baseDays = parseInt(settingRows.find(s => s.setting_key === 'annual_leave_days')?.setting_value || 12);
      const increment = parseInt(settingRows.find(s => s.setting_key === 'leave_increment_per_year')?.setting_value || 1);
      const totalDays = baseDays + (yearsWorked * increment);
      const id = generateId();
      await pool.query('INSERT INTO leave_quotas (id, user_id, year, total_days, remaining_days) VALUES (?, ?, ?, ?, ?)', [id, req.user.id, year, totalDays, totalDays]);
      return res.json({ success: true, quota: { total_days: totalDays, used_days: 0, remaining_days: totalDays, year } });
    }
    res.json({ success: true, quota: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── SUBMIT LEAVE (dengan multi-level routing) ─────────────────────────────────
const submitLeave = async (req, res) => {
  try {
    const { type, start_date, end_date, time_start, time_end, reason } = req.body;
    const userId = req.user.id;

    if (!type || !start_date || !end_date || !reason)
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });

    const [leaveTypeRows] = await pool.query('SELECT * FROM leave_types WHERE code = ? AND is_active = TRUE', [type]);
    const leaveType = leaveTypeRows[0];
    if (!leaveType) return res.status(400).json({ success: false, message: 'Jenis izin tidak valid' });
    if (leaveType.requires_attachment && !req.file)
      return res.status(400).json({ success: false, message: `Bukti foto wajib diupload untuk ${leaveType.name}` });

    const totalDays = await getWorkingDays(start_date, end_date);
    if (totalDays <= 0) return res.status(400).json({ success: false, message: 'Tanggal tidak valid atau semua hari dalam rentang ini adalah hari libur/akhir pekan' });

    // Tipe izin khusus: validasi jam
    const [settingsRows] = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('late_permission_max_time','early_leave_min_time')"
    );
    const settingsMap = Object.fromEntries(settingsRows.map(r => [r.setting_key, r.setting_value]));

    if (type === 'late_permission') {
      if (!time_start) {
        return res.status(400).json({ success: false, message: 'Rencana jam masuk wajib diisi untuk izin terlambat' });
      }
      const maxLate = settingsMap.late_permission_max_time || '11:00';
      if (time_start > maxLate) {
        return res.status(400).json({ success: false, message: `Izin terlambat maksimal pukul ${maxLate} WIB` });
      }
    }

    if (type === 'early_leave') {
      if (!time_end) {
        return res.status(400).json({ success: false, message: 'Rencana jam pulang wajib diisi untuk izin pulang cepat' });
      }
      const minEarly = settingsMap.early_leave_min_time || '13:00';
      if (time_end < minEarly) {
        return res.status(400).json({ success: false, message: `Izin pulang cepat minimal pukul ${minEarly} WIB` });
      }
    }

    if (type === 'leave_office') {
      if (!time_start || !time_end) {
        return res.status(400).json({ success: false, message: 'Jam izin keluar dan jam kembali wajib diisi untuk izin keluar kantor' });
      }
      const [startH, startM] = time_start.split(':').map(Number);
      const [endH, endM] = time_end.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (endMinutes <= startMinutes) {
        return res.status(400).json({ success: false, message: 'Jam kembali harus lebih besar dari jam keluar kantor' });
      }
      const maxDurationMinutes = leaveType.max_duration_minutes ? parseInt(leaveType.max_duration_minutes, 10) : 120;
      if (endMinutes - startMinutes > maxDurationMinutes) {
        return res.status(400).json({ success: false, message: `Izin keluar kantor maksimal ${maxDurationMinutes} menit` });
      }
    }

    if (leaveType.deducts_quota) {
      const year = new Date(start_date).getFullYear();
      const [quotaRows] = await pool.query('SELECT * FROM leave_quotas WHERE user_id = ? AND year = ?', [userId, year]);
      if (!quotaRows.length || quotaRows[0].remaining_days < totalDays)
        return res.status(400).json({ success: false, message: `Jatah cuti tidak mencukupi. Sisa: ${quotaRows[0]?.remaining_days || 0} hari` });
    }

    // Cek overlap dengan pengajuan yang sudah ada (pending/approved)
    const [overlapping] = await pool.query(
      `SELECT id FROM leave_requests
       WHERE user_id = ? AND status != 'rejected'
         AND start_date <= ? AND end_date >= ?`,
      [userId, end_date, start_date]
    );
    if (overlapping.length) {
      return res.status(400).json({
        success: false,
        message: 'Kamu sudah memiliki pengajuan izin/cuti yang tumpang tindih pada tanggal tersebut'
      });
    }

    // Cek batas maksimal pengajuan per bulan
    const [maxReqSetting] = await pool.query(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'max_leave_requests_per_month'"
    );
    const maxPerMonth = parseInt(maxReqSetting[0]?.setting_value || '0');
    if (maxPerMonth > 0) {
      const reqMonth = new Date(start_date).getMonth() + 1;
      const reqYear = new Date(start_date).getFullYear();
      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM leave_requests
         WHERE user_id = ? AND MONTH(start_date) = ? AND YEAR(start_date) = ?
         AND status != 'rejected'`,
        [userId, reqMonth, reqYear]
      );
      if (countRows[0].total >= maxPerMonth)
        return res.status(400).json({
          success: false,
          message: `Batas pengajuan cuti bulan ini sudah tercapai (maksimal ${maxPerMonth} kali per bulan)`
        });
    }

    // Cek mode approval
    const [modeSetting] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'leave_approval_mode'");
    const approvalMode = modeSetting[0]?.setting_value || 'single';

    // Cek apakah karyawan punya manager
    const [userRows] = await pool.query('SELECT name, manager_id FROM users WHERE id = ?', [userId]);
    const submitterName = userRows[0]?.name || 'Karyawan';
    const managerId = userRows[0]?.manager_id;

    const id = generateId();
    const attachment = req.file ? req.file.filename : null;

    // Jika multi-level dan ada manager → kirim ke SPV dulu
    const needsSpvApproval = approvalMode === 'multi' && managerId;
    const initialStatus = 'pending';

    await pool.query(
      `INSERT INTO leave_requests (id, user_id, type, start_date, end_date, time_start, time_end, total_days, reason, attachment, status, approval_level, spv_id, spv_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, type, start_date, end_date, time_start || null, time_end || null, totalDays, reason, attachment, initialStatus,
       needsSpvApproval ? 2 : 1, needsSpvApproval ? managerId : null, needsSpvApproval ? 'pending' : null]
    );

    const typeLabel = leaveType.name;

    if (needsSpvApproval) {
      // Notif ke SPV/manager
      await notify(managerId, `Pengajuan ${typeLabel} Menunggu Persetujuan 📋`,
        `${submitterName} mengajukan ${typeLabel} selama ${totalDays} hari. Persetujuan Anda diperlukan.`, 'info');
    } else {
      // Notif ke semua HRD & admin
      const [admins] = await pool.query("SELECT id FROM users WHERE role IN ('superadmin','admin','hrd') AND is_active = TRUE");
      if (admins.length) {
        for (const a of admins) {
          await notify(a.id, `Pengajuan ${typeLabel} Baru 📋`,
            `${submitterName} mengajukan ${typeLabel} selama ${totalDays} hari. Menunggu persetujuan.`, 'info');
        }
      }
    }

    // Konfirmasi ke karyawan
    await notify(userId, `Pengajuan ${typeLabel} Terkirim ✅`,
      `Pengajuan ${typeLabel} kamu selama ${totalDays} hari telah dikirim${needsSpvApproval ? ' ke atasan' : ' ke HRD'}.`, 'info');

    const { broadcastEvent, sendEventToUser, sendEventToRoles } = require('../utils/realtimeManager');
    broadcastEvent('leave_update', { event: 'leave_update', type: 'submit', userId });
    sendEventToUser(userId, 'notification_update', { event: 'notification_update', type: 'submit' });
    if (needsSpvApproval) {
      sendEventToUser(managerId, 'notification_update', { event: 'notification_update', type: 'pending' });
    } else {
      sendEventToRoles(['superadmin', 'admin', 'hrd'], 'notification_update', { event: 'notification_update', type: 'pending' });
    }

    res.status(201).json({
      success: true,
      message: needsSpvApproval
        ? 'Pengajuan dikirim ke atasan untuk persetujuan pertama.'
        : 'Pengajuan berhasil dikirim! Menunggu persetujuan HRD.',
      id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── SPV REVIEW (level 1 approval) ────────────────────────────────────────────
const spvReviewLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ success: false, message: 'Status tidak valid' });

    const [rows] = await pool.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });

    const leave = rows[0];
    if (leave.spv_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Anda bukan atasan yang ditunjuk untuk pengajuan ini' });
    if (leave.spv_status !== 'pending')
      return res.status(400).json({ success: false, message: 'Pengajuan sudah diproses oleh atasan' });

    await pool.query(
      'UPDATE leave_requests SET spv_status = ?, spv_notes = ?, spv_at = NOW() WHERE id = ?',
      [status, review_notes, id]
    );

    const [userRows] = await pool.query('SELECT name FROM users WHERE id = ?', [leave.user_id]);
    const empName = userRows[0]?.name || 'Karyawan';
    const [ltRows] = await pool.query('SELECT name FROM leave_types WHERE code = ?', [leave.type]);
    const typeLabel = ltRows[0]?.name || leave.type;

    if (status === 'rejected') {
      // SPV tolak → langsung rejected
      await pool.query('UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ? WHERE id = ?',
        ['rejected', req.user.id, review_notes, id]);
      await notify(leave.user_id, 'Pengajuan Ditolak Atasan ❌',
        `Pengajuan ${typeLabel} kamu ditolak oleh atasan. ${review_notes ? `Catatan: ${review_notes}` : ''}`, 'error');
    } else {
      // SPV setuju → teruskan ke HRD
      const [admins] = await pool.query("SELECT id FROM users WHERE role IN ('superadmin','admin','hrd') AND is_active = TRUE");
      for (const a of admins) {
        await notify(a.id, `Pengajuan ${typeLabel} Disetujui Atasan 📋`,
          `${empName} mengajukan ${typeLabel} selama ${leave.total_days} hari. Sudah disetujui atasan, menunggu persetujuan HRD.`, 'info');
      }
      await notify(leave.user_id, 'Pengajuan Disetujui Atasan ✅',
        `Pengajuan ${typeLabel} kamu disetujui atasan dan diteruskan ke HRD.`, 'success');
    }

    const { broadcastEvent, sendEventToUser, sendEventToRoles } = require('../utils/realtimeManager');
    broadcastEvent('leave_update', { event: 'leave_update', type: 'spv_review', id });
    sendEventToUser(leave.user_id, 'leave_update', { event: 'leave_update', type: 'spv_review', id });
    sendEventToUser(leave.user_id, 'notification_update', { event: 'notification_update', type: 'spv_review' });
    if (status === 'approved') {
      sendEventToRoles(['superadmin', 'admin', 'hrd'], 'notification_update', { event: 'notification_update', type: 'spv_approve' });
    }

    res.json({ success: true, message: `Pengajuan berhasil ${status === 'approved' ? 'diteruskan ke HRD' : 'ditolak'}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── GET PENDING FOR SPV ───────────────────────────────────────────────────────
const getSpvPendingLeaves = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT lr.*, u.name as user_name, u.employee_id, u.department, u.position, u.avatar as user_avatar
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.spv_id = ? AND lr.spv_status = 'pending' AND lr.status = 'pending'
       ORDER BY lr.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, leaves: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── GET MY LEAVES ─────────────────────────────────────────────────────────────
const getMyLeaves = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT lr.*, u.name as reviewer_name, spv.name as spv_name
       FROM leave_requests lr
       LEFT JOIN users u ON lr.reviewed_by = u.id
       LEFT JOIN users spv ON lr.spv_id = spv.id
       WHERE lr.user_id = ? ORDER BY lr.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, leaves: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── GET ALL LEAVES (admin) ────────────────────────────────────────────────────
const getAllLeaves = async (req, res) => {
  try {
    const { status, type, month, year } = req.query;
    let query = `SELECT lr.*, u.name as user_name, u.employee_id, u.department, u.position, u.avatar as user_avatar,
                        rv.name as reviewer_name, spv.name as spv_name
                 FROM leave_requests lr
                 JOIN users u ON lr.user_id = u.id
                 LEFT JOIN users rv ON lr.reviewed_by = rv.id
                 LEFT JOIN users spv ON lr.spv_id = spv.id
                 WHERE 1=1`;
    const params = [];
    if (status) { query += ' AND lr.status = ?'; params.push(status); }
    if (type)   { query += ' AND lr.type = ?';   params.push(type); }
    if (month)  { query += ' AND MONTH(lr.start_date) = ?'; params.push(month); }
    if (year)   { query += ' AND YEAR(lr.start_date) = ?';  params.push(year); }
    query += ' ORDER BY lr.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, leaves: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── HRD REVIEW (final approval) ───────────────────────────────────────────────
const reviewLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ success: false, message: 'Status tidak valid' });

    const [rows] = await pool.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });

    const leave = rows[0];
    if (leave.status !== 'pending') return res.status(400).json({ success: false, message: 'Pengajuan sudah diproses' });

    // Jika multi-level, pastikan SPV sudah approve dulu
    if (leave.approval_level === 2 && leave.spv_status === 'pending')
      return res.status(400).json({ success: false, message: 'Pengajuan belum disetujui atasan. Tunggu persetujuan atasan terlebih dahulu.' });

    await pool.query(
      'UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ? WHERE id = ?',
      [status, req.user.id, review_notes, id]
    );

    if (status === 'approved') await finalizeApproval(leave);

    await auditLog(req,
      status === 'approved' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      'leave_request', id,
      `${status === 'approved' ? 'Menyetujui' : 'Menolak'} pengajuan ${leave.type} ${leave.start_date}–${leave.end_date}${review_notes ? ` — ${review_notes}` : ''}`
    );

    const [userRows] = await pool.query('SELECT email, name FROM users WHERE id = ?', [leave.user_id]);
    const [ltRows] = await pool.query('SELECT name FROM leave_types WHERE code = ?', [leave.type]);
    const typeLabel = ltRows[0]?.name || leave.type;

    if (userRows.length) {
      await sendLeaveNotification(userRows[0].email, userRows[0].name, status, typeLabel).catch(() => {});
    }

    const notifMsg = status === 'approved'
      ? `Pengajuan ${typeLabel} kamu telah disetujui HRD`
      : `Pengajuan ${typeLabel} kamu ditolak HRD${review_notes ? `. Catatan: ${review_notes}` : ''}`;
    await notify(leave.user_id,
      status === 'approved' ? 'Pengajuan Disetujui ✅' : 'Pengajuan Ditolak ❌',
      notifMsg,
      status === 'approved' ? 'success' : 'error'
    );

    const { broadcastEvent, sendEventToUser } = require('../utils/realtimeManager');
    broadcastEvent('leave_update', { event: 'leave_update', type: 'review', id });
    sendEventToUser(leave.user_id, 'leave_update', { event: 'leave_update', type: 'review', id });
    sendEventToUser(leave.user_id, 'notification_update', { event: 'notification_update', type: 'reviewed' });

    res.json({ success: true, message: `Pengajuan berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── FITUR 2: TEAM CALENDAR ────────────────────────────────────────────────────
const getTeamCalendar = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const from = start_date || today;
    // Default: 14 hari ke depan
    const to = end_date || new Date(Date.now() + 13 * 86400000).toISOString().split('T')[0];

    // Karyawan yang sedang cuti/izin dalam rentang tanggal
    const [onLeave] = await pool.query(
      `SELECT u.id as user_id, u.name, u.employee_id, u.department, u.avatar,
              lr.type, lr.start_date, lr.end_date, lr.total_days, lr.reason,
              lt.name as type_label
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN leave_types lt ON lr.type = lt.code
       WHERE lr.status = 'approved'
         AND lr.start_date <= ? AND lr.end_date >= ?
         AND u.is_active = TRUE
       ORDER BY lr.start_date, u.name`,
      [to, from]
    );

    // Absensi hari ini
    const [todayAtt] = await pool.query(
      `SELECT u.id as user_id, u.name, u.employee_id, u.department, u.avatar,
              a.status, a.check_in, a.check_out
       FROM attendances a
       JOIN users u ON a.user_id = u.id
       WHERE a.date = ? AND u.is_active = TRUE
       ORDER BY u.name`,
      [today]
    );

    // Karyawan yang belum absen hari ini (hari kerja)
    const dayOfWeek = new Date().getDay();
    let notYetCheckedIn = [];
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const [allEmp] = await pool.query(
        "SELECT id, name, employee_id, department, avatar FROM users WHERE role = 'employee' AND is_active = TRUE"
      );
      const checkedInIds = new Set(todayAtt.map(a => a.user_id));
      notYetCheckedIn = allEmp.filter(e => !checkedInIds.has(e.id));
    }

    res.json({
      success: true,
      onLeave,
      todayAttendance: todayAtt,
      notYetCheckedIn,
      dateRange: { from, to }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── CARRY-OVER MANUAL (admin trigger) ────────────────────────────────────────
const triggerCarryOver = async (req, res) => {
  try {
    const { from_year, to_year } = req.body;
    const fromYear = parseInt(from_year) || new Date().getFullYear() - 1;
    const toYear = parseInt(to_year) || new Date().getFullYear();

    const [employees] = await pool.query("SELECT id FROM users WHERE role = 'employee' AND is_active = TRUE");
    let processed = 0;
    for (const emp of employees) {
      const carried = await carryOverQuota(emp.id, fromYear, toYear);
      if (carried > 0) processed++;
    }
    res.json({ success: true, message: `Carry-over selesai. ${processed} karyawan mendapat tambahan sisa cuti dari ${fromYear}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── GET LEAVE REPORT ──────────────────────────────────────────────────────────
const getLeaveReport = async (req, res) => {
  try {
    const { month, year, start_date, end_date, department, employee_id } = req.query;

    let dateFilter, params, periodLabel;

    if (start_date && end_date) {
      dateFilter = 'AND lr.start_date >= ? AND lr.start_date <= ?';
      params = [start_date, end_date];
      periodLabel = `${start_date} s/d ${end_date}`;
    } else {
      const m = month || new Date().getMonth() + 1;
      const y = year  || new Date().getFullYear();
      dateFilter = 'AND MONTH(lr.start_date) = ? AND YEAR(lr.start_date) = ?';
      params = [m, y];
      periodLabel = `${m}/${y}`;
    }

    let userFilter = '';
    if (department)  { userFilter += ' AND u.department = ?'; params.push(department); }
    if (employee_id) { userFilter += ' AND u.employee_id = ?'; params.push(employee_id); }

    const [rows] = await pool.query(
      `SELECT lr.*, u.name as user_name, u.employee_id, u.department, u.position, u.avatar as user_avatar
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.status = 'approved' ${dateFilter} ${userFilter}
       ORDER BY lr.start_date`,
      params
    );
    res.json({ success: true, report: rows, period: periodLabel, start_date, end_date, month, year });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── DELETE LEAVE ──────────────────────────────────────────────────────────────
const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    const leave = rows[0];
    if (leave.status === 'approved') {
      const [ltRows] = await pool.query('SELECT deducts_quota FROM leave_types WHERE code = ?', [leave.type]);
      if (ltRows[0]?.deducts_quota) {
        const year = new Date(leave.start_date).getFullYear();
        await pool.query(
          'UPDATE leave_quotas SET used_days = GREATEST(0, used_days - ?), remaining_days = remaining_days + ? WHERE user_id = ? AND year = ?',
          [leave.total_days, leave.total_days, leave.user_id, year]
        );
      }
    }
    await pool.query('DELETE FROM leave_requests WHERE id = ?', [id]);
    await auditLog(req, 'DELETE_LEAVE', 'leave_request', id,
      `Menghapus pengajuan ${leave.type} ${leave.start_date}–${leave.end_date} (${leave.status})`);
    res.json({ success: true, message: 'Pengajuan berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── UPDATE QUOTA ──────────────────────────────────────────────────────────────
const updateQuota = async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, total_days } = req.body;
    const [existing] = await pool.query('SELECT * FROM leave_quotas WHERE user_id = ? AND year = ?', [userId, year]);
    if (existing.length) {
      const used = existing[0].used_days;
      await pool.query('UPDATE leave_quotas SET total_days = ?, remaining_days = ? WHERE user_id = ? AND year = ?',
        [total_days, total_days - used, userId, year]);
    } else {
      const id = generateId();
      await pool.query('INSERT INTO leave_quotas (id, user_id, year, total_days, remaining_days) VALUES (?, ?, ?, ?, ?)',
        [id, userId, year, total_days, total_days]);
    }
    res.json({ success: true, message: 'Jatah cuti berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = {
  getMyQuota, submitLeave, getMyLeaves, getAllLeaves,
  reviewLeave, spvReviewLeave, getSpvPendingLeaves,
  getLeaveReport, updateQuota, deleteLeave,
  getTeamCalendar, triggerCarryOver
};
