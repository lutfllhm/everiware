# iWare Presence - Sistem Absensi Digital

Aplikasi absensi digital berbasis PWA untuk kebutuhan internal perusahaan.

## Tech Stack
- **Frontend**: React 19 + Vite 5 + TailwindCSS 3 + PWA (vite-plugin-pwa)
- **Backend**: Node.js + Express
- **Database**: MySQL / phpMyAdmin

---

## Cara Setup & Menjalankan

### 1. Setup Database
1. Buka **phpMyAdmin** di browser
2. Klik tab **Import**
3. Pilih file `database/schema.sql`
4. Klik **Go** / Import
5. Database `iware_presence` otomatis dibuat beserta tabel dan akun admin default

### 2. Setup Backend
```bash
cd backend
```

Edit file `.env` sesuai konfigurasi kamu:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=         # isi password MySQL kamu
DB_NAME=iware_presence

JWT_SECRET=iware_presence_super_secret_key_2024

# Google OAuth (opsional, untuk login Google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email untuk kirim OTP (gunakan Gmail App Password)
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM=iWare Presence <your_gmail@gmail.com>

FRONTEND_URL=http://localhost:3000
```

Jalankan backend:
```bash
npm run dev
# Backend berjalan di http://localhost:5000
```

### 3. Setup Frontend
```bash
cd frontend
npm run dev
# Frontend berjalan di http://localhost:3000
```

Atau klik file `start-backend.bat` dan `start-frontend.bat` untuk menjalankan langsung.

---

## Akun Default (Superadmin)
- **Email**: `admin@iware.id`
- **Password**: `password`

---

## Fitur Lengkap

### Karyawan (Employee)
- ✅ Absensi masuk & pulang dengan **selfie + validasi GPS**
- ✅ Hanya bisa absen di area yang ditentukan admin
- ✅ Pengajuan cuti tahunan (dengan jatah hari)
- ✅ Pengajuan izin sakit (wajib upload bukti foto)
- ✅ Riwayat absensi & perizinan
- ✅ Profil & ganti password

### Admin / HRD
- ✅ Dashboard statistik real-time
- ✅ Daftar & detail absensi semua karyawan
- ✅ Approve / Tolak pengajuan cuti & izin sakit
- ✅ Manajemen karyawan (tambah, edit, nonaktifkan)
- ✅ Edit jatah cuti per karyawan
- ✅ Laporan absensi bulanan (export CSV)
- ✅ Laporan perizinan bulanan (export CSV)
- ✅ Manajemen lokasi absensi (tambah titik GPS + radius)
- ✅ Pengaturan jam kerja, toleransi terlambat, jatah cuti
- ✅ Backup database

### PWA
- ✅ Bisa diinstall di HP Android & iOS
- ✅ Tampilan mobile-first yang responsif
- ✅ Tampilan desktop yang berbeda (sidebar navigation)

---

## Cara Setup Google OAuth (Opsional)
1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru
3. Aktifkan **Google+ API** / **Google Identity**
4. Buat **OAuth 2.0 Client ID** (Web Application)
5. Tambahkan `http://localhost:3000` ke Authorized Origins
6. Copy Client ID ke `.env` backend

## Cara Setup Gmail App Password (untuk OTP)
1. Buka akun Google → Security → 2-Step Verification (aktifkan)
2. Buka Security → App Passwords
3. Buat app password baru
4. Copy ke `EMAIL_PASS` di `.env`
