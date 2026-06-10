const { pool } = require('../config/database');

// ── Tren kehadiran N bulan terakhir ──────────────────────────────────────────
const getAttendanceTrend = async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const [rows] = await pool.query(
        `SELECT
          COUNT(CASE WHEN status='present' THEN 1 END) as present,
          COUNT(CASE WHEN status='late'    THEN 1 END) as late,
          COUNT(CASE WHEN status='absent'  THEN 1 END) as absent,
          COUNT(CASE WHEN status='leave'   THEN 1 END) as \`leave\`,
          COUNT(CASE WHEN status='sick'    THEN 1 END) as sick,
          COUNT(*) as total
         FROM attendances
         WHERE MONTH(date)=? AND YEAR(date)=?`,
        [m, y]
      );

      const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      result.push({
        month: `${monthNames[m - 1]} ${y}`,
        monthShort: monthNames[m - 1],
        year: y,
        ...rows[0],
      });
    }

    res.json({ success: true, trend: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── Distribusi jam masuk (heatmap per jam) ───────────────────────────────────
const getCheckInHeatmap = async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT HOUR(check_in) as hour, COUNT(*) as count
       FROM attendances
       WHERE check_in IS NOT NULL AND MONTH(date)=? AND YEAR(date)=?
       GROUP BY HOUR(check_in)
       ORDER BY hour`,
      [m, y]
    );

    // Fill semua jam 6-20
    const heatmap = Array.from({ length: 15 }, (_, i) => {
      const h = i + 6;
      const found = rows.find(r => r.hour === h);
      return { hour: `${String(h).padStart(2,'0')}:00`, count: found ? found.count : 0 };
    });

    res.json({ success: true, heatmap });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── Kehadiran per departemen ─────────────────────────────────────────────────
const getDepartmentStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT
        u.department,
        COUNT(DISTINCT u.id) as total_emp,
        COUNT(CASE WHEN a.status='present' THEN 1 END) as present,
        COUNT(CASE WHEN a.status='late'    THEN 1 END) as late,
        COUNT(CASE WHEN a.status='absent'  THEN 1 END) as absent,
        ROUND(
          COUNT(CASE WHEN a.status IN ('present','late') THEN 1 END) * 100.0 /
          NULLIF(COUNT(a.id), 0), 1
        ) as attendance_rate
       FROM users u
       LEFT JOIN attendances a ON u.id = a.user_id AND MONTH(a.date)=? AND YEAR(a.date)=?
       WHERE u.role='employee' AND u.is_active=TRUE AND u.department IS NOT NULL AND u.department != ''
       GROUP BY u.department
       ORDER BY attendance_rate DESC`,
      [m, y]
    );

    res.json({ success: true, departments: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── Top karyawan terlambat ───────────────────────────────────────────────────
const getTopLate = async (req, res) => {
  try {
    const { month, year, limit = 10 } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.employee_id, u.department, u.avatar,
              COUNT(*) as late_count,
              AVG(TIME_TO_SEC(TIMEDIFF(a.check_in, CONCAT(a.date,' ',
                (SELECT setting_value FROM app_settings WHERE setting_key='work_start_time')
              ))) / 60) as avg_late_minutes
       FROM attendances a
       JOIN users u ON a.user_id = u.id
       WHERE a.status='late' AND MONTH(a.date)=? AND YEAR(a.date)=?
       GROUP BY u.id
       ORDER BY late_count DESC
       LIMIT ?`,
      [m, y, parseInt(limit)]
    );

    res.json({ success: true, topLate: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ── Ringkasan dashboard lengkap ──────────────────────────────────────────────
const getFullDashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const month = new Date().getMonth() + 1;
    const year  = new Date().getFullYear();

    const [
      [totalEmp], [presentToday], [lateToday], [pendingLeaves],
      [monthlyAtt], [monthlyLate], [monthlyAbsent],
      [totalLeaveThisMonth], [newEmployees]
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) as c FROM users WHERE role='employee' AND is_active=TRUE"),
      pool.query("SELECT COUNT(*) as c FROM attendances WHERE date=? AND status='present'", [today]),
      pool.query("SELECT COUNT(*) as c FROM attendances WHERE date=? AND status='late'", [today]),
      pool.query("SELECT COUNT(*) as c FROM leave_requests WHERE status='pending'"),
      pool.query("SELECT COUNT(*) as c FROM attendances WHERE MONTH(date)=? AND YEAR(date)=? AND status IN ('present','late')", [month, year]),
      pool.query("SELECT COUNT(*) as c FROM attendances WHERE MONTH(date)=? AND YEAR(date)=? AND status='late'", [month, year]),
      pool.query("SELECT COUNT(*) as c FROM attendances WHERE MONTH(date)=? AND YEAR(date)=? AND status='absent'", [month, year]),
      pool.query("SELECT COUNT(*) as c FROM leave_requests WHERE MONTH(start_date)=? AND YEAR(start_date)=? AND status='approved'", [month, year]),
      pool.query("SELECT COUNT(*) as c FROM users WHERE role='employee' AND MONTH(created_at)=? AND YEAR(created_at)=?", [month, year]),
    ]);

    // Attendance rate bulan ini
    const workingDays = await getWorkingDaysInMonth(month, year);
    const totalPossible = totalEmp[0].c * workingDays;
    const attendanceRate = totalPossible > 0
      ? Math.round((monthlyAtt[0].c / totalPossible) * 100)
      : 0;

    res.json({
      success: true,
      stats: {
        total_employees:    totalEmp[0].c,
        present_today:      presentToday[0].c,
        late_today:         lateToday[0].c,
        absent_today:       totalEmp[0].c - presentToday[0].c - lateToday[0].c,
        pending_leaves:     pendingLeaves[0].c,
        monthly_attendance: monthlyAtt[0].c,
        monthly_late:       monthlyLate[0].c,
        monthly_absent:     monthlyAbsent[0].c,
        total_leave_month:  totalLeaveThisMonth[0].c,
        new_employees:      newEmployees[0].c,
        attendance_rate:    attendanceRate,
        working_days:       workingDays,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// Helper: hitung hari kerja dalam bulan
async function getWorkingDaysInMonth(month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

module.exports = { getAttendanceTrend, getCheckInHeatmap, getDepartmentStats, getTopLate, getFullDashboard };
