# 🚀 Panduan Lengkap Deploy Manual Everiware ke VPS Hostinger dengan Docker

Panduan ini berisi langkah-langkah lengkap dan detail untuk mendeploy aplikasi **Everiware** (Frontend React, Backend Node.js Express, dan Database MySQL) ke **Hostinger VPS** Anda secara **manual** (tanpa script otomatis).

Panduan ini telah disesuaikan agar **tidak terjadi bentrok nama kontainer maupun port** dengan aplikasi lain yang sudah berjalan di VPS Anda (seperti `iware`, `tesiware`, `algoo`, `rbmschedule`, dll.).

### 🔒 Detail Penyesuaian Port & Nama Kontainer (Anti-Bentrok):
*   **Database MySQL Host Port**: Menggunakan port **`3309`** (karena port `3306`, `3307`, `3308`, dan `4080` sudah terpakai di VPS).
*   **Frontend Host Port**: Menggunakan port **`8088`** (karena port `8080`, `8082`, `8085`, `8090`, dan `9090` sudah terpakai di VPS).
*   **Nama Kontainer**: Menggunakan awalan **`everiware_`** (`everiware_db`, `everiware_backend`, `everiware_frontend`).
*   **Domain**: **`everiware.iwareid.com`**

---

## 📋 Daftar Isi
1. [Prasyarat Awal (Prerequisites)](#1-prasyarat-awal-prerequisites)
2. [Persiapan Domain & DNS](#2-persiapan-domain--dns)
3. [Langkah 1: Koneksi VPS & Update Sistem](#langkah-1-koneksi-vps--update-sistem)
4. [Langkah 2: Instalasi Docker & Docker Compose](#langkah-2-instalasi-docker--docker-compose)
5. [Langkah 3: Mengunggah Source Code ke VPS](#langkah-3-mengunggah-source-code-ke-vps)
6. [Langkah 4: Konfigurasi Environment (`.env`)](#langkah-4-konfigurasi-environment-env)
7. [Langkah 5: Penyesuaian Port Docker Compose](#langkah-5-penyesuaian-port-docker-compose)
8. [Langkah 6: Build dan Jalankan Container Docker](#langkah-6-build-dan-jalankan-container-docker)
9. [Langkah 7: Konfigurasi SSL (HTTPS) via Nginx Host & Certbot](#langkah-7-konfigurasi-ssl-https-via-nginx-host--certbot)
10. [🛠️ Troubleshooting (Penyelesaian Masalah Umum)](#️-troubleshooting-penyelesaian-masalah-umum)
11. [💾 Operasi Harian & Perawatan (Maintenance)](#-operasi-harian--perawatan-maintenance)

---

## 1. Prasyarat Awal (Prerequisites)
Sebelum memulai, pastikan Anda telah menyiapkan hal-hal berikut:
*   **VPS Hostinger** dengan OS **Ubuntu 22.04 LTS** atau **Ubuntu 24.04 LTS**.
*   Hak akses **root** atau user dengan wewenang **sudo**.
*   Domain aktif yang Anda miliki: **`everiware.iwareid.com`**.
    > [!IMPORTANT]
    > **Kenapa wajib menggunakan HTTPS/SSL?**
    > Fitur absensi digital Everiware menggunakan kamera (selfie) dan lokasi (GPS). Browser modern (seperti Chrome & Safari di handphone) secara ketat memblokir izin akses Kamera dan GPS jika situs web diakses lewat koneksi HTTP biasa tanpa SSL.

---

## 2. Persiapan Domain & DNS
Agar domain Anda dapat mengarah ke aplikasi yang berada di VPS, lakukan konfigurasi DNS terlebih dahulu di panel domain Anda:

1. Masuk ke **DNS Zone Editor** dari domain **`iwareid.com`**.
2. Tambahkan record baru dengan tipe **A Record**:
   *   **Host/Name**: `everiware` (untuk subdomain `everiware.iwareid.com`).
   *   **Points to (IP Address)**: Isi dengan **IP Publik VPS** Anda (misalnya `103.190.24.123`).
   *   **TTL**: Biarkan default (biasanya 3600 atau Auto).
3. Simpan record DNS tersebut.
    > [!NOTE]
    > Propagasi DNS biasanya membutuhkan waktu mulai dari 5 menit hingga maksimal 24 jam. Anda dapat memverifikasi apakah domain sudah mengarah ke IP VPS dengan menjalankan perintah `ping everiware.iwareid.com` di terminal komputer lokal Anda.

---

## Langkah 1: Koneksi VPS & Update Sistem
Hubungkan komputer lokal Anda ke VPS menggunakan protokol SSH melalui Terminal (macOS/Linux) atau PowerShell/Command Prompt (Windows):

1. Masuk sebagai root:
   ```bash
   ssh root@ip_address_vps_anda
   ```
2. Lakukan pembaruan paket sistem operasi agar VPS dalam kondisi prima dan aman:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

---

## Langkah 2: Instalasi Docker & Docker Compose
*(Jika VPS Anda sudah memiliki Docker dan Docker Compose yang berjalan seperti pada gambar, Anda dapat langsung lanjut ke **Langkah 3**).*

Namun, jika ingin memastikan instalasi versi terbaru:
```bash
# Install paket Docker CE jika belum lengkap
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y

# Pastikan service Docker berjalan
sudo systemctl start docker
sudo systemctl enable docker
```

---

## Langkah 3: Mengunggah Source Code ke VPS
Ada dua metode yang dapat digunakan untuk mengirim file project dari komputer lokal Anda ke dalam direktori `/var/www/everiware` di VPS.

### Opsi A: Menggunakan Git Clone (Sangat Direkomendasikan)
Cara ini paling bersih, cepat, dan mempermudah update kode di masa mendatang.
1. Pasang Git di VPS:
   ```bash
   sudo apt install git -y
   ```
2. Buat folder penyimpanan di VPS dan masuk ke dalamnya:
   ```bash
   sudo mkdir -p /var/www/everiware
   cd /var/www/everiware
   ```
3. Clone repositori Git Anda (ganti URL di bawah dengan alamat repositori Anda):
   ```bash
   # Jika menggunakan HTTPS
   git clone https://github.com/username/everiware.git .
   ```
   *Catatan: Titik `.` di akhir perintah bertujuan agar file ter-clone langsung ke direktori saat ini tanpa membuat subfolder baru.*

### Opsi B: Mengunggah Manual via SFTP / SCP (Alternatif)
Jika Anda tidak menggunakan Git, Anda bisa menggunakan SCP via Terminal atau aplikasi GUI seperti **FileZilla** atau **WinSCP**:
*   **Melalui Terminal Lokal (SCP):**
    Jalankan perintah ini di terminal komputer lokal Anda (bukan di dalam VPS):
    ```bash
    scp -r d:/project/Everiware root@ip_address_vps_anda:/var/www/everiware
    ```
*   **Melalui FileZilla:**
    1. Buat koneksi baru dengan protokol **SFTP** (Port `22`).
    2. Masukkan Host (IP VPS), Username (`root`), dan password VPS Anda.
    3. Unggah seluruh file proyek dari lokal ke direktori `/var/www/everiware` di VPS.

---

## Langkah 4: Konfigurasi Environment (`.env`)
1. Masuk ke folder project di VPS Anda:
   ```bash
   cd /var/www/everiware
   ```
2. Salin template production environment menjadi file `.env` aktif:
   ```bash
   cp .env.production .env
   ```
3. Buka editor `nano` untuk mengonfigurasi nilai-nilai rahasia:
   ```bash
   nano .env
   ```
4. **Konfigurasikan variabel wajib berikut:**
   *   `DB_ROOT_PASSWORD`: Ganti dengan password root database MySQL Anda yang kuat.
   *   `DB_PASSWORD`: Ganti dengan password user MySQL Anda.
   *   `JWT_SECRET`: Buat string acak yang panjang untuk mengamankan enkripsi token autentikasi login.
   *   `FRONTEND_URL` & `WEB_URL`: Masukkan URL domain lengkap Anda menggunakan awalan `https://` yaitu **`https://everiware.iwareid.com`**.
   *   `GOOGLE_CALLBACK_URL`: Masukkan URL callback Google OAuth Anda yaitu **`https://everiware.iwareid.com/api/auth/google/callback`**.
   *   `EMAIL_USER` & `EMAIL_PASS`: Masukkan akun Gmail dan **App Password** Gmail Anda (bukan password akun biasa) agar fitur verifikasi OTP email dapat berjalan lancar.
5. Simpan perubahan dengan menekan kombinasi tombol `Ctrl + O` lalu `Enter`, kemudian keluar dengan `Ctrl + X`.

---

## Langkah 5: Penyesuaian Port Docker Compose
Berkas `docker-compose.yml` di server Anda sudah disesuaikan agar **tidak terjadi tabrakan port**. Port MySQL diatur ke `3309` pada localhost dan port frontend diatur ke `8088` pada localhost.

Berikut adalah isi dari file [docker-compose.yml](file:///d:/project/Everiware/docker-compose.yml) yang sudah dimodifikasi:
```yaml
# Bagian Database (MySQL)
    ports:
      # Menggunakan port 3309 di host (localhost) agar tidak bentrok dengan database lain
      - "127.0.0.1:3309:3306"
      
# Bagian Frontend (React + Nginx)
    ports:
      # Menggunakan port 8088 di host (localhost) agar tidak bentrok dengan frontend iware/tesiware lain
      - "127.0.0.1:8088:80"
```
Dengan konfigurasi ini, aplikasi Everiware akan berjalan secara independen tanpa mengganggu kontainer lain yang sedang berjalan di VPS Anda.

---

## Langkah 6: Build dan Jalankan Container Docker
Jalankan perintah berikut di root folder proyek di VPS untuk mengunduh base image, melakukan kompilasi file React/Node.js, dan menjalankan container di background:
```bash
docker compose up -d --build
```
> [!NOTE]
> Database MySQL otomatis diinisialisasi pada pertama kali kontainer dijalankan dengan mengimpor berkas skema awal dari `database/schema.sql`.

Untuk memverifikasi status container yang berjalan:
```bash
docker compose ps
```
Pastikan kontainer **`everiware_db`**, **`everiware_backend`**, dan **`everiware_frontend`** berstatus `Up` (Running).

---

## Langkah 7: Konfigurasi SSL (HTTPS) via Nginx Host & Certbot
Langkah ini berfungsi untuk mengonfigurasi web server Nginx yang sudah ada di host VPS Anda sebagai reverse proxy yang meneruskan lalu lintas HTTPS (port 443) ke kontainer `everiware_frontend` Docker (yang berjalan di port `8088`).

### 1. Instalasi Nginx dan Certbot
Jika Nginx dan Certbot belum terpasang di host VPS Anda, jalankan perintah ini:
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

### 2. Membuat Blok Konfigurasi Server Nginx (Reverse Proxy)
1. Buat file konfigurasi virtual host baru untuk Everiware:
   ```bash
   sudo nano /etc/nginx/sites-available/everiware
   ```
2. Tempelkan konfigurasi reverse proxy berikut (menggunakan port internal **`8088`**):
   ```nginx
   server {
       listen 80;
       server_name everiware.iwareid.com;

       location / {
           proxy_pass http://127.0.0.1:8088; # Meneruskan request ke frontend docker compose port 8088
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           client_max_body_size 50M; # Mengizinkan upload foto selfie hingga 50MB
       }
   }
   ```
3. Simpan dan keluar (`Ctrl + O`, `Enter`, `Ctrl + X`).
4. Aktifkan konfigurasi dengan membuat *symbolic link* ke folder `sites-enabled`:
   ```bash
   sudo ln -s /etc/nginx/sites-available/everiware /etc/nginx/sites-enabled/
   ```
5. Lakukan pengujian apakah konfigurasi Nginx sudah benar tanpa error sintaks:
   ```bash
   sudo nginx -t
   ```
6. Muat ulang (restart) service Nginx untuk menerapkan perubahan:
   ```bash
   sudo systemctl restart nginx
   ```

### 3. Generate Sertifikat SSL Let's Encrypt
Jalankan Certbot untuk mendapatkan sertifikat SSL gratis secara otomatis pada domain **`everiware.iwareid.com`**:
```bash
sudo certbot --nginx -d everiware.iwareid.com
```
*   **Proses Certbot:**
    1. Masukkan alamat email Anda untuk pemberitahuan pembaruan SSL.
    2. Setujui syarat penggunaan (*Terms of Service*) dengan mengetik **`A`**.
    3. Pilih opsi redirect otomatis agar semua lalu lintas HTTP dialihkan ke HTTPS.
4. Muat ulang Nginx setelah sertifikat SSL terpasang dengan sukses:
   ```bash
   sudo systemctl restart nginx
   ```

Aplikasi Anda kini sudah dapat diakses dengan aman di **`https://everiware.iwareid.com`**!

---

## 🛠️ Troubleshooting (Penyelesaian Masalah Umum)

### 1. Pesan "Access denied for user" pada Database MySQL
**Penyebab:** Password yang dikonfigurasikan di `.env` untuk `DB_PASSWORD` berbeda dengan password yang saat ini aktif di database Docker.
**Solusi:**
Jika Anda baru pertama kali menjalankan database, Anda bisa menghapus volume data lama agar inisialisasi ulang dijalankan dengan password baru:
```bash
docker compose down -v # Menghapus container dan volume database lama (PERINGATAN: Menghapus seluruh data DB!)
docker compose up -d --build
```

### 2. Kamera atau GPS Tidak Berfungsi di Handphone Karyawan
**Penyebab:** Aplikasi diakses menggunakan protokol HTTP biasa (`http://...`) atau alamat IP mentah. Browser menolak memberikan izin lokasi dan kamera pada situs yang dinilai tidak aman.
**Solusi:**
Pastikan Anda mengakses menggunakan domain HTTPS (**`https://everiware.iwareid.com`**). Periksa apakah konfigurasi SSL Let's Encrypt telah sukses dan alamat URL di `.env` sudah menggunakan awalan `https://`.

### 3. Email OTP Tidak Terkirim
**Penyebab:** Konfigurasi email tidak valid atau akun Google memblokir akses login biasa.
**Solusi:**
1. Masuk ke Akun Google Anda -> Keamanan (Security) -> Aktifkan Verifikasi 2 Langkah.
2. Cari menu **Sandi Aplikasi (App Passwords)**.
3. Buat sandi baru untuk aplikasi "Lainnya" dan beri nama "Everiware".
4. Salin kode 16 digit yang dihasilkan ke variabel `EMAIL_PASS` di file `.env` (tanpa spasi).

### 4. Upload Foto Selfie Error "413 Request Entity Too Large"
**Penyebab:** Ukuran file foto dari kamera HP terlalu besar dan dibatasi oleh Nginx VPS.
**Solusi:**
Pastikan di file `/etc/nginx/sites-available/everiware` pada bagian `location /` terdapat baris `client_max_body_size 50M;`. Jangan lupa jalankan `sudo systemctl restart nginx` setelah mengedit.

---

## 💾 Operasi Harian & Perawatan (Maintenance)

### A. Memantau Log Aktivitas Server (Real-time Logs)
Jika Anda ingin melihat aktivitas backend, proses debug, atau melihat mengapa terjadi error pada backend:
```bash
# Pantau log backend secara real-time
docker compose logs -f backend

# Pantau seluruh log service (db, backend, frontend)
docker compose logs -f --tail=50
```

### B. Membuat Cadangan Database (Backup MySQL)
Sangat penting untuk mencadangkan database secara berkala untuk menghindari kehilangan data penting absensi karyawan.
Jalankan perintah ini untuk melakukan ekspor database dari kontainer `everiware_db` langsung ke file `.sql` di luar VPS Host:
```bash
# Backup database (ganti PASSWORD_DB_ANDA dengan password user yang ada di file .env)
docker exec -t everiware_db mysqldump -u iware_user -p'PASSWORD_DB_ANDA' iware_presence > /var/www/everiware/backup_everiware_$(date +%F).sql
```

### C. Melakukan Update Aplikasi (Deploy Kode Baru)
Jika Anda telah memperbarui source code di repositori Git lokal dan ingin memperbarui aplikasi di VPS:
1. Tarik kode terbaru dari repositori Git di VPS:
   ```bash
   cd /var/www/everiware
   git pull origin main
   ```
2. Rebuild image Docker yang mengalami perubahan kode:
   ```bash
   docker compose up -d --build
   ```

### D. Akses Konsol Database MySQL Langsung
Jika Anda butuh masuk ke CLI MySQL kontainer `everiware_db` untuk melihat tabel atau melakukan modifikasi manual:
```bash
docker exec -it everiware_db mysql -u iware_user -p iware_presence
```
*(Lalu masukkan password database Anda saat diminta).*
