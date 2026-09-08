const cron = require('node-cron');
const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');
const { sendPushNotification } = require('../utils/fcm');
const { REMINDER_DAYS_BEFORE, daysUntil } = require('../utils/contractHelper');

// Reminder kontrak berakhir untuk HR. Berjalan sekali sehari pagi hari;
// kontrak yang sudah masuk H-14 dikirimi notifikasi satu kali (ditandai
// reminder_sent_at) supaya HR tidak dibanjiri notifikasi tiap hari.
// Kalau tanggal berakhir berubah (kontrak dikoreksi), penanda ini di-reset
// oleh updateContract sehingga reminder periode baru tetap terkirim.

const notifyHR = async (title, message, data) => {
  // Semua pemegang peran HR — HRD, admin, superadmin.
  const [hrUsers] = await pool.query(
    "SELECT id FROM users WHERE is_active = TRUE AND role IN ('hrd', 'admin', 'superadmin')"
  );
  if (!hrUsers.length) return 0;

  const values = hrUsers.map(u => [generateId(), u.id, title, message, 'warning']);
  await pool.query(
    'INSERT INTO notifications (id, user_id, title, message, type) VALUES ?',
    [values]
  );

  await Promise.allSettled(
    hrUsers.map(u => sendPushNotification(u.id, title, message, data).catch(() => {}))
  );
  return hrUsers.length;
};

const runContractReminderCheck = async () => {
  try {
    // Kontrak aktif yang berakhir dalam <= 14 hari ke depan dan belum diingatkan.
    const [rows] = await pool.query(
      `SELECT c.id, c.end_date, c.contract_type, c.duration_months, c.pkwt_year,
              u.id AS user_id, u.name, u.employee_id, u.penempatan
       FROM employment_contracts c
       JOIN users u ON u.id = c.user_id
       WHERE c.status = 'active'
         AND u.is_active = TRUE
         AND c.end_date IS NOT NULL
         AND c.end_date >= CURDATE()
         AND c.end_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         AND c.reminder_sent_at IS NULL
       ORDER BY c.end_date ASC`,
      [REMINDER_DAYS_BEFORE]
    );

    if (!rows.length) return;

    for (const c of rows) {
      const sisa = daysUntil(c.end_date);
      const tanggal = new Date(`${String(c.end_date).slice(0, 10)}T00:00:00Z`)
        .toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

      const title = 'Kontrak akan berakhir';
      const message =
        `${c.name}${c.employee_id ? ` (${c.employee_id})` : ''} — kontrak ${c.contract_type}` +
        `${c.pkwt_year ? ` tahun ke-${c.pkwt_year}` : ''} berakhir ${tanggal}` +
        ` (${sisa === 0 ? 'hari ini' : `${sisa} hari lagi`}).`;

      await notifyHR(title, message, {
        category: 'contract_expiring',
        contract_id: String(c.id),
        user_id: String(c.user_id),
      });

      await pool.query('UPDATE employment_contracts SET reminder_sent_at = NOW() WHERE id = ?', [c.id]);
    }

    console.log(`📄 Contract reminder: ${rows.length} kontrak masuk H-${REMINDER_DAYS_BEFORE}, HR sudah dinotifikasi.`);
  } catch (err) {
    console.error('[ContractReminder]', err.message);
  }
};

// Tandai kontrak yang tanggal berakhirnya sudah lewat sebagai 'expired',
// supaya daftar & rekap tidak menampilkannya sebagai kontrak berjalan.
const markExpiredContracts = async () => {
  try {
    const [result] = await pool.query(
      "UPDATE employment_contracts SET status = 'expired' WHERE status = 'active' AND end_date IS NOT NULL AND end_date < CURDATE()"
    );
    if (result.affectedRows > 0) {
      console.log(`📄 ${result.affectedRows} kontrak ditandai expired.`);
    }
  } catch (err) {
    console.error('[MarkExpiredContracts]', err.message);
  }
};

const startContractReminderJob = () => {
  // Setiap hari 08:00 WIB
  cron.schedule('0 8 * * *', async () => {
    await markExpiredContracts();
    await runContractReminderCheck();
  }, { timezone: 'Asia/Jakarta' });

  console.log(`✅ Contract reminder job started (H-${REMINDER_DAYS_BEFORE}, setiap hari 08:00 WIB)`);
};

module.exports = { startContractReminderJob, runContractReminderCheck, markExpiredContracts };
