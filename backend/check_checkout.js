const { pool } = require('./src/config/database');

async function run() {
  try {
    const [atts] = await pool.query('SELECT * FROM attendances ORDER BY updated_at DESC LIMIT 1');
    console.log('Latest Attendance Record:');
    console.log(atts[0]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
