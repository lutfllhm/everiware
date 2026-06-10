const { pool } = require('./src/config/database');

async function run() {
  try {
    console.log('Starting migration...');
    // 1. Add face_photo column if it doesn't exist
    const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'face_photo'");
    if (columns.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN face_photo VARCHAR(255) DEFAULT NULL AFTER avatar");
      console.log('✅ Column face_photo added successfully.');
    } else {
      console.log('ℹ️ Column face_photo already exists.');
    }

    // 2. Migrate existing registered faces: copy avatar to face_photo for users who have face_registered = TRUE
    const [result] = await pool.query(
      "UPDATE users SET face_photo = avatar WHERE face_registered = TRUE AND face_photo IS NULL"
    );
    console.log(`✅ Migrated ${result.affectedRows} existing user face references.`);

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}
run();
