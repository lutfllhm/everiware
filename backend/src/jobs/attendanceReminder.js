const cron = require('node-cron');
const { pool } = require('../config/database');
const { generateId, nowWIBParts } = require('../utils/helpers');
const { sendPushNotification } = require('../utils/fcm');
const { resolveUserShift } = require('../controllers/attendanceController');

const REMINDER_MINUTES_BEFORE = 5;

const todayWIB = () => {
  const now = nowWIBParts();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Cek apakah hari ini hari kerja (Minggu selalu libur, Sabtu tergantung setting)
const isWorkingDay = async () => {
  const dayOfWeek = nowWIBParts().getUTCDay(); // 0 = Minggu, 6 = Sabtu
  if (dayOfWeek === 0) return false;
  if (dayOfWeek === 6) {
    const [rows] = await pool.query(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'saturday_work_enabled'"
    );
    return rows[0]?.setting_value !== 'false';
  }
  return true;
};

const notifyReminder = async (userId, shiftName, startTime) => {
  const id = generateId();
  const title = 'Jangan lupa absen!';
  const message = `${shiftName} kamu mulai jam ${startTime.slice(0, 5)} WIB. Yuk absen masuk sekarang.`;
  await pool.query(
    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
    [id, userId, title, message, 'info']
  );
  await sendPushNotification(userId, title, message, { category: 'attendance_reminder' }).catch(() => {});
};

const runReminderCheck = async () => {
  if (!(await isWorkingDay())) return;

  const today = todayWIB();
  const nowParts = nowWIBParts();
  const nowMinutes = nowParts.getUTCHours() * 60 + nowParts.getUTCMinutes();

  const [users] = await pool.query(
    "SELECT id FROM users WHERE is_active = TRUE AND role = 'employee'"
  );
  if (!users.length) return;

  const [checkedIn] = await pool.query(
    'SELECT user_id FROM attendances WHERE date = ? AND check_in IS NOT NULL',
    [today]
  );
  const checkedInIds = new Set(checkedIn.map(r => r.user_id));

  await Promise.allSettled(users.map(async ({ id: userId }) => {
    if (checkedInIds.has(userId)) return;

    const shift = await resolveUserShift(userId, today);
    const [startH, startM] = shift.start_time.split(':').map(Number);
    const DAY = 24 * 60;
    const startMinutes = startH * 60 + startM;
    // Jarak dari "sekarang" ke jam mulai shift, wrap 24 jam (shift bisa mulai
    // 00:00 seperti shift malam, dan reminder tetap perlu terkirim jam 23:55).
    const minutesUntilStart = ((startMinutes - nowMinutes) % DAY + DAY) % DAY;

    if (minutesUntilStart === REMINDER_MINUTES_BEFORE) {
      await notifyReminder(userId, shift.name, shift.start_time);
    }
  }));
};

const startAttendanceReminderJob = () => {
  // Jalan tiap menit WIB
  cron.schedule('* * * * *', () => {
    runReminderCheck().catch(err => console.error('[AttendanceReminder] error:', err));
  });
  console.log('⏰ Attendance reminder job aktif (cek tiap menit)');
};

module.exports = { startAttendanceReminderJob };
