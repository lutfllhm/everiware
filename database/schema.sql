-- ============================================================
-- iWare Presence - Complete Database Schema
-- Includes all tables, migrations, seed data
-- ============================================================

CREATE DATABASE IF NOT EXISTS iware_presence CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE iware_presence;

-- ============================================================
-- TABLES
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255),
  phone VARCHAR(20),
  google_id VARCHAR(100),
  avatar VARCHAR(255),
  face_photo VARCHAR(255),
  role ENUM('superadmin','admin','hrd','employee') DEFAULT 'employee',
  department VARCHAR(100),
  position VARCHAR(100),
  department_id VARCHAR(36) DEFAULT NULL,
  position_id VARCHAR(36) DEFAULT NULL,
  manager_id VARCHAR(36) DEFAULT NULL,
  location_id VARCHAR(36) DEFAULT NULL,
  employee_id VARCHAR(20) UNIQUE,
  join_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  face_registered BOOLEAN DEFAULT FALSE,
  otp_code VARCHAR(255),
  otp_expires DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Positions (jabatan per departemen)
CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(36) PRIMARY KEY,
  department_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE KEY unique_dept_position (department_id, name)
);

-- FK dari users ke departments, positions, dan manager (ditambah setelah tabel dibuat)
ALTER TABLE users
  ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_users_position   FOREIGN KEY (position_id)   REFERENCES positions(id)   ON DELETE SET NULL,
  ADD CONSTRAINT fk_users_manager    FOREIGN KEY (manager_id)    REFERENCES users(id)        ON DELETE SET NULL;

-- Attendance locations
CREATE TABLE IF NOT EXISTS attendance_locations (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius INT DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- FK dari users ke lokasi penempatan (ditambah setelah tabel attendance_locations dibuat)
ALTER TABLE users
  ADD CONSTRAINT fk_users_location FOREIGN KEY (location_id) REFERENCES attendance_locations(id) ON DELETE SET NULL;

-- Attendance records
CREATE TABLE IF NOT EXISTS attendances (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  check_in DATETIME,
  check_out DATETIME,
  check_in_photo VARCHAR(255),
  check_out_photo VARCHAR(255),
  check_in_lat DECIMAL(10, 8),
  check_in_lng DECIMAL(11, 8),
  check_out_lat DECIMAL(10, 8),
  check_out_lng DECIMAL(11, 8),
  location_id VARCHAR(36),
  status ENUM('present','late','absent','leave','sick') DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES attendance_locations(id) ON DELETE SET NULL,
  UNIQUE KEY unique_attendance (user_id, date)
);

-- Work shifts
CREATE TABLE IF NOT EXISTS work_shifts (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  late_tolerance INT DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User shift assignments
CREATE TABLE IF NOT EXISTS user_shifts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  shift_id VARCHAR(36) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES work_shifts(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_shift (user_id, effective_date)
);

-- Leave quota
CREATE TABLE IF NOT EXISTS leave_quotas (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  year INT NOT NULL,
  total_days INT DEFAULT 12,
  used_days INT DEFAULT 0,
  remaining_days INT DEFAULT 12,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_quota (user_id, year)
);

-- Custom leave types
CREATE TABLE IF NOT EXISTS leave_types (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  requires_attachment BOOLEAN DEFAULT FALSE,
  deducts_quota BOOLEAN DEFAULT FALSE,
  blocks_attendance BOOLEAN DEFAULT TRUE,
  max_duration_minutes INT DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave requests
-- Kolom `type` menggunakan VARCHAR(50) yang merujuk ke leave_types.code
-- agar tipe cuti baru yang ditambahkan admin bisa langsung digunakan
CREATE TABLE IF NOT EXISTS leave_requests (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  time_start TIME DEFAULT NULL,
  time_end TIME DEFAULT NULL,
  total_days INT NOT NULL,
  reason TEXT NOT NULL,
  attachment VARCHAR(255),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by VARCHAR(36),
  reviewed_at DATETIME,
  review_notes TEXT,
  -- Multi-level approval
  approval_level TINYINT DEFAULT 1,
  spv_id VARCHAR(36) DEFAULT NULL,
  spv_status ENUM('pending','approved','rejected') DEFAULT NULL,
  spv_notes TEXT DEFAULT NULL,
  spv_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (spv_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (type) REFERENCES leave_types(code) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_leave_type (type),
  INDEX idx_leave_status (status),
  INDEX idx_leave_user (user_id)
);

-- Overtime requests
CREATE TABLE IF NOT EXISTS overtime_requests (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INT NOT NULL,
  reason TEXT NOT NULL,
  attachment VARCHAR(255) DEFAULT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by VARCHAR(36),
  reviewed_at DATETIME,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Public holidays
CREATE TABLE IF NOT EXISTS public_holidays (
  id VARCHAR(36) PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info','success','warning','error') DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- FCM tokens for push notifications
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token TEXT NOT NULL,
  platform VARCHAR(20) DEFAULT 'android',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_platform (user_id, platform(20))
);

-- App settings
CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  user_name VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(36),
  description TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default leave types (harus diinsert sebelum leave_requests karena ada FK)
INSERT INTO leave_types (id, code, name, requires_attachment, deducts_quota, blocks_attendance, max_duration_minutes) VALUES
('lt-001', 'annual',          'Cuti Tahunan',       FALSE, TRUE,  TRUE,  NULL),
('lt-002', 'sick',            'Izin Sakit',         TRUE,  FALSE, TRUE,  NULL),
('lt-003', 'permission',      'Izin',               FALSE, FALSE, TRUE,  NULL),
('lt-004', 'wfh',             'Work From Home',     FALSE, FALSE, TRUE,  NULL),
('lt-005', 'dinas',           'Dinas Luar',         FALSE, FALSE, TRUE,  NULL),
('lt-006', 'late_permission', 'Izin Terlambat',     FALSE, FALSE, FALSE, NULL),
('lt-007', 'early_leave',     'Izin Pulang Cepat',  FALSE, FALSE, FALSE, NULL),
('lt-008', 'leave_office',    'Izin Keluar Kantor', FALSE, FALSE, FALSE, 120)
ON DUPLICATE KEY UPDATE id = id;

-- Default shift
INSERT INTO work_shifts (id, name, start_time, end_time, late_tolerance) VALUES
('shift-001', 'Shift Reguler', '08:00:00', '17:00:00', 10)
ON DUPLICATE KEY UPDATE id = id;

-- Default app settings
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
('app_name',                    'IWA',                    'Nama aplikasi'),
('work_start_time',             '08:00',                  'Jam masuk kerja'),
('work_end_time',               '17:00',                  'Jam pulang kerja'),
('late_tolerance',              '10',                     'Toleransi keterlambatan (menit)'),
('annual_leave_days',           '12',                     'Jatah cuti tahunan default'),
('leave_increment_per_year',    '1',                      'Tambahan cuti per tahun'),
('company_name',                'CV. Rajawali Bina Maju', 'Nama perusahaan'),
('company_address',             'Jakarta, Indonesia',     'Alamat perusahaan'),
('leave_carryover_enabled',     'true',                   'Aktifkan carry-over sisa cuti'),
('leave_carryover_max_days',    '5',                      'Maksimal hari carry-over per tahun'),
('leave_approval_mode',         'single',                 'Mode approval: single atau multi'),
('max_leave_requests_per_month','0',                      'Maksimal pengajuan cuti per bulan (0 = tidak dibatasi)'),
('saturday_work_enabled',       'true',                   'Hari Sabtu masuk kerja'),
('saturday_end_time',           '15:00',                  'Jam pulang hari Sabtu'),
('overtime_rate_per_hour',      '0',                      'Tarif lembur per jam (Rp, 0 = tidak dihitung)'),
('late_permission_max_time',    '11:00',                  'Batas maksimal jam masuk untuk izin terlambat'),
('early_leave_min_time',        '13:00',                  'Batas minimal jam pulang untuk izin pulang cepat')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Default departments
INSERT IGNORE INTO departments (id, name, description) VALUES
('dept-001', 'IT',         'Divisi Teknologi Informasi'),
('dept-002', 'HR',         'Human Resources'),
('dept-003', 'Finance',    'Keuangan & Akuntansi'),
('dept-004', 'Operations', 'Operasional');

-- Default positions
INSERT IGNORE INTO positions (id, department_id, name) VALUES
('pos-001', 'dept-001', 'Staff IT'),
('pos-002', 'dept-001', 'Senior Staff IT'),
('pos-003', 'dept-001', 'Manager IT'),
('pos-004', 'dept-002', 'Staff HR'),
('pos-005', 'dept-002', 'HRD Manager'),
('pos-006', 'dept-003', 'Staff Finance'),
('pos-007', 'dept-003', 'Finance Manager'),
('pos-008', 'dept-004', 'Staff Operasional'),
('pos-009', 'dept-004', 'Supervisor Operasional');

-- Default users
INSERT INTO users (id, name, email, password, role, is_active, is_verified) VALUES
('superadmin-001', 'Super Admin', 'admin@iware.id',   '$2b$10$7vccRFEqGOvuN1cJ6i0VbevU3FokVoBIveMuzkmkcH1URObj3ksP.', 'superadmin', TRUE, TRUE),
('hrd-001',        'HRD',        'hrdrbm@iware.id',  '$2b$10$ABgAjLvIOPjVkI.ZBVUXuOVycT/VKFC.bzuA61aOWIW56Pwd6.re2', 'hrd',        TRUE, TRUE)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO users (id, name, email, password, phone, role, employee_id, is_active, is_verified) VALUES
('employee-001', 'Lutfillah', 'lutfillahm12@gmail.com', '$2b$10$B5rQoZZ9PahJZLgyjSdD0.8j6bN5OJA.WxX.yXt6UN7V9lvb6BW2G', '08000000000', 'employee', 'EMP001', TRUE, TRUE)
ON DUPLICATE KEY UPDATE id = id;

-- ============================================================
-- PUBLIC HOLIDAYS
-- ============================================================

-- Hari libur nasional Indonesia 2025
-- Catatan: setiap tanggal harus unik. Jika ada dua event di tanggal sama,
-- digabung dalam satu nama (misal Nyepi & Cuti Bersama Idul Fitri sama-sama 31 Maret).
INSERT IGNORE INTO public_holidays (id, date, name) VALUES
('ph-2025-01', '2025-01-01', 'Tahun Baru Masehi'),
('ph-2025-02', '2025-01-27', 'Isra Miraj Nabi Muhammad SAW'),
('ph-2025-03', '2025-01-28', 'Cuti Bersama Isra Miraj'),
('ph-2025-04', '2025-01-29', 'Tahun Baru Imlek'),
('ph-2025-05', '2025-03-28', 'Hari Raya Idul Fitri 1446 H'),
('ph-2025-06', '2025-03-29', 'Hari Suci Nyepi / Hari Raya Idul Fitri 1446 H (Hari Kedua)'),
('ph-2025-07', '2025-03-31', 'Cuti Bersama Idul Fitri'),
('ph-2025-08', '2025-04-01', 'Cuti Bersama Idul Fitri'),
('ph-2025-09', '2025-04-02', 'Cuti Bersama Idul Fitri'),
('ph-2025-10', '2025-04-03', 'Cuti Bersama Idul Fitri'),
('ph-2025-11', '2025-04-04', 'Cuti Bersama Idul Fitri'),
('ph-2025-12', '2025-04-07', 'Cuti Bersama Idul Fitri'),
('ph-2025-13', '2025-04-18', 'Wafat Isa Al Masih'),
('ph-2025-14', '2025-04-20', 'Paskah'),
('ph-2025-15', '2025-05-01', 'Hari Buruh Internasional'),
('ph-2025-16', '2025-05-12', 'Hari Raya Waisak'),
('ph-2025-17', '2025-05-13', 'Cuti Bersama Waisak'),
('ph-2025-18', '2025-05-29', 'Kenaikan Isa Al Masih'),
('ph-2025-19', '2025-06-01', 'Hari Lahir Pancasila'),
('ph-2025-20', '2025-06-06', 'Hari Raya Idul Adha 1446 H'),
('ph-2025-21', '2025-06-09', 'Cuti Bersama Idul Adha'),
('ph-2025-22', '2025-06-27', 'Tahun Baru Islam 1447 H'),
('ph-2025-23', '2025-08-17', 'Hari Kemerdekaan Republik Indonesia'),
('ph-2025-24', '2025-09-05', 'Maulid Nabi Muhammad SAW'),
('ph-2025-25', '2025-12-25', 'Hari Raya Natal'),
('ph-2025-26', '2025-12-26', 'Cuti Bersama Natal');

-- Hari libur nasional Indonesia 2026
INSERT IGNORE INTO public_holidays (id, date, name) VALUES
('ph-2026-01', '2026-01-01', 'Tahun Baru Masehi'),
('ph-2026-02', '2026-01-16', 'Isra Miraj Nabi Muhammad SAW'),
('ph-2026-03', '2026-01-28', 'Tahun Baru Imlek'),
('ph-2026-04', '2026-03-17', 'Hari Raya Idul Fitri 1447 H'),
('ph-2026-05', '2026-03-18', 'Hari Raya Idul Fitri 1447 H (Hari Kedua)'),
('ph-2026-06', '2026-03-16', 'Cuti Bersama Idul Fitri'),
('ph-2026-07', '2026-03-19', 'Hari Suci Nyepi / Cuti Bersama Idul Fitri'),
('ph-2026-08', '2026-03-20', 'Wafat Isa Al Masih / Cuti Bersama Idul Fitri'),
('ph-2026-09', '2026-04-05', 'Paskah'),
('ph-2026-10', '2026-05-01', 'Hari Buruh Internasional'),
('ph-2026-11', '2026-05-14', 'Kenaikan Isa Al Masih'),
('ph-2026-12', '2026-05-27', 'Hari Raya Idul Adha 1447 H'),
('ph-2026-13', '2026-05-31', 'Hari Raya Waisak'),
('ph-2026-14', '2026-06-01', 'Hari Lahir Pancasila'),
('ph-2026-15', '2026-06-17', 'Tahun Baru Islam 1448 H'),
('ph-2026-16', '2026-08-17', 'Hari Kemerdekaan Republik Indonesia'),
('ph-2026-17', '2026-08-25', 'Maulid Nabi Muhammad SAW'),
('ph-2026-18', '2026-12-25', 'Hari Raya Natal');
