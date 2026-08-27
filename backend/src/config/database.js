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
  enableKeepAlive: true,   // cegah koneksi idle diputus diam-diam oleh firewall/proxy VPS
  keepAliveInitialDelay: 10000,
});

// Log koneksi pool yang mati (mis. MySQL restart, network blip) alih-alih diam-diam menyumbat antrian
pool.on('error', (err) => {
  console.error('❌ MySQL pool error:', err.code || err.message);
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
    
    // Migrasi additive: kolom deteksi anomali lokasi GPS pada tabel attendances
    // (untuk DB yang sudah ada sebelum fitur ini ditambahkan)
    const [anomalyCols] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendances' AND COLUMN_NAME = 'is_location_anomaly'
    `);
    if (anomalyCols.length === 0) {
      await conn.query(`
        ALTER TABLE attendances
        ADD COLUMN is_location_anomaly BOOLEAN DEFAULT FALSE,
        ADD COLUMN location_anomaly_note VARCHAR(255)
      `);
      console.log('✅ Migrasi kolom is_location_anomaly berhasil ditambahkan ke attendances.');
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
    
    // Create user_feature_permissions table (akses granular per-user, mis. kelola shift divisi)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_feature_permissions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        feature_key VARCHAR(50) NOT NULL,
        granted_by VARCHAR(36) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_feature (user_id, feature_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_ufp_user (user_id)
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
