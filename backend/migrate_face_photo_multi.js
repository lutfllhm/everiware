const { pool } = require('./src/config/database');

async function run() {
  try {
    console.log('Starting migration...');

    for (const col of ['face_photo_left', 'face_photo_right']) {
      const [columns] = await pool.query(`SHOW COLUMNS FROM users LIKE '${col}'`);
      if (columns.length === 0) {
        await pool.query(`ALTER TABLE users ADD COLUMN ${col} VARCHAR(255) DEFAULT NULL AFTER face_photo`);
        console.log(`✅ Column ${col} added successfully.`);
      } else {
        console.log(`ℹ️ Column ${col} already exists.`);
      }
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}
run();
