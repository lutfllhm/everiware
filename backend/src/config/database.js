const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'iware_presence',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00',
  dateStrings: true,  // Kembalikan DATETIME sebagai string, bukan Date object
});

const testConnection = async () => {
  try {
    // 1. Hubungkan ke MySQL tanpa menentukan DB terlebih dahulu untuk memastikan DB ada
    const tempConn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    const dbName = process.env.DB_NAME || 'iware_presence';
    const [databases] = await tempConn.query('SHOW DATABASES LIKE ?', [dbName]);
    
    let isNewDb = false;
    if (databases.length === 0) {
      console.log(`⚠️ Database ${dbName} tidak ditemukan. Membuat database baru...`);
      await tempConn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      isNewDb = true;
      console.log(`✅ Database ${dbName} berhasil dibuat.`);
    }
    await tempConn.end();

    // 2. Hubungkan menggunakan pool utama
    const conn = await pool.getConnection();
    console.log('✅ Database connected successfully');

    // 3. Jika DB baru dibuat, jalankan schema.sql
    if (isNewDb) {
      console.log('⏳ Menginisialisasi skema tabel...');
      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.join(__dirname, '../../../database/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        // Pisahkan statements berdasarkan ';'
        const statements = schemaSql
          .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        for (const sql of statements) {
          await conn.query(sql);
        }
        console.log('✅ Skema tabel berhasil diinisialisasi.');
      } else {
        console.warn('⚠️ File schema.sql tidak ditemukan di: ' + schemaPath);
      }
    }
    
    // Create company_announcements table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS company_announcements (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        type ENUM('info', 'warning', 'success', 'holiday') DEFAULT 'info',
        is_holiday BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Seed initial announcements if empty
    const [rows] = await conn.query('SELECT COUNT(*) as count FROM company_announcements');
    if (rows[0].count === 0) {
      const { generateId } = require('../utils/helpers');
      await conn.query(`
        INSERT INTO company_announcements (id, title, content, type, is_holiday, created_at) VALUES 
        (?, 'Kebijakan Kehadiran Baru', 'Mulai bulan depan, toleransi keterlambatan kehadiran disesuaikan menjadi 10 menit. Harap persiapkan kehadiran Anda.', 'info', FALSE, '2026-05-20 08:00:00'),
        (?, 'Cuti Bersama Hari Raya Nyepi', 'Sesuai keputusan bersama, libur nasional Cuti Bersama jatuh pada Senin depan. Seluruh kantor akan non-aktif.', 'holiday', TRUE, '2026-05-18 08:00:00'),
        (?, 'Sosialisasi SOP Kehadiran', 'Harap lakukan verifikasi wajah dengan pencahayaan yang cukup saat melakukan check-in agar sistem mengenali wajah Anda secara akurat.', 'success', FALSE, '2026-05-15 08:00:00')
      `, [generateId(), generateId(), generateId()]);
      console.log('✅ Seeded default company announcements');
    }
    
    conn.release();
  } catch (err) {
    console.error('❌ Database connection/migration failed:', err);
    process.exit(1);
  }
};

module.exports = { pool, testConnection };
