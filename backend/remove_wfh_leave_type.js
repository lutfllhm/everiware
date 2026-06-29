const { pool } = require('./src/config/database');

async function run() {
  try {
    const [used] = await pool.query("SELECT COUNT(*) as c FROM leave_requests WHERE type = 'wfh'");
    if (used[0].c > 0) {
      console.log(`Tidak dihapus: jenis izin 'wfh' masih dipakai di ${used[0].c} pengajuan izin.`);
      return;
    }
    const [result] = await pool.query("DELETE FROM leave_types WHERE code = 'wfh'");
    console.log(`Jenis izin 'wfh' dihapus (${result.affectedRows} baris).`);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
