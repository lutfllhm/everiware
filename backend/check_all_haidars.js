const { pool } = require('./src/config/database');

async function run() {
  try {
    const [users] = await pool.query('SELECT id, name, email, avatar, face_registered FROM users');
    console.log('--- All Users ---');
    console.log(users);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
