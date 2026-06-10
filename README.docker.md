# Panduan Deploy Everiware ke VPS Hostinger dengan Docker

Panduan ini menjelaskan cara mendeploy aplikasi Everiware (Frontend React, Backend Node.js, dan Database MySQL) ke VPS Hostinger menggunakan Docker.

Ada dua metode deploy yang bisa Anda gunakan:
1. **Metode Otomatis (Sangat Direkomendasikan)**: Menggunakan script `deploy.sh` yang secara otomatis menginstal Docker, menanyakan konfigurasi dasar, membuat password aman secara acak, dan menyalakan SSL (HTTPS).
2. **Metode Manual**: Menjalankan langkah demi langkah instalasi secara mandiri.

---

## ⚡ METODE OTOMATIS (Sangat Direkomendasikan)

Jika Anda ingin deploy secara cepat dan otomatis, setelah menyalin berkas project ke VPS Anda (lihat langkah [Mengupload Project ke VPS](#3-mengupload-project-ke-vps)), cukup jalankan perintah berikut:

```bash
# Berikan akses eksekusi ke script
chmod +x deploy.sh

# Jalankan script deploy sebagai root
sudo ./deploy.sh
```

Script akan memandu Anda dalam melakukan setup:
*   Mengecek dan menginstal Docker & Docker Compose secara otomatis jika belum ada.
*   Membuat berkas `.env` dari template dengan password acak yang aman untuk MySQL & JWT.
*   Memasukkan domain/IP Anda secara langsung.
*   Mengonfigurasi Nginx VPS dan memasang SSL (HTTPS) Let's Encrypt secara otomatis jika menggunakan domain.

---

## 📋 Daftar Isi (Metode Manual)
1. [Persiapan Awal VPS](#1-persiapan-awal-vps)
2. [Instalasi Docker & Docker Compose](#2-instalasi-docker--docker-compose)
3. [Mengupload Project ke VPS](#3-mengupload-project-ke-vps)
4. [Konfigurasi Environment (.env)](#4-konfigurasi-environment-env)
5. [Menjalankan Aplikasi dengan Docker](#5-menjalankan-aplikasi-dengan-docker)
6. [Konfigurasi SSL (HTTPS) dengan Certbot / Let's Encrypt](#6-konfigurasi-ssl-https-dengan-certbot--lets-encrypt)
7. [Operasi & Perawatan (Backup & Log)](#7-operasi--perawatan-backup--log)

---

## 1. Persiapan Awal VPS

1. Pastikan VPS Hostinger Anda menggunakan OS **Ubuntu 22.04 LTS** atau **Ubuntu 24.04 LTS**.
2. Hubungkan ke VPS menggunakan SSH melalui Terminal (macOS/Linux) atau PowerShell/PuTTY (Windows):
   ```bash
   ssh root@ip_address_vps_anda
   ```
3. Update sistem Anda terlebih dahulu:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

---

## 2. Instalasi Docker & Docker Compose

Jalankan perintah berikut di dalam VPS untuk menginstal Docker secara resmi:

```bash
# Hapus paket-paket lama jika ada
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove $pkg; done

# Install dependensi pendukung
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg -y

# Tambahkan GPG key resmi Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Tambahkan repositori Docker ke sistem
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine dan Docker Compose
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y

# Verifikasi instalasi (pastikan statusnya active/running)
sudo systemctl status docker
docker compose version
```

---

## 3. Mengupload Project ke VPS

Ada dua cara utama untuk menaruh source code aplikasi ke VPS:

### Cara A: Clone dari Git (Sangat Direkomendasikan)
1. Push project Anda ke repositori private (GitHub/GitLab).
2. Install git di VPS: `sudo apt install git -y`
3. Generate SSH Key di VPS dan tambahkan ke akun GitHub Anda:
   ```bash
   ssh-keygen -t ed25519 -C "vps-hostinger@email.com"
   cat ~/.ssh/id_ed25519.pub
   ```
4. Clone repositori ke VPS:
   ```bash
   git clone git@github.com:username/Everiware.git /var/www/everiware
   cd /var/www/everiware
   ```

### Cara B: Upload Manual via SFTP / SCP (Alternatif)
Jika Anda ingin mengupload file langsung dari komputer lokal Anda tanpa Git:
```bash
# Jalankan di komputer lokal Anda (sesuaikan path)
scp -r d:/project/Everiware root@ip_address_vps_anda:/var/www/everiware
```

---

## 4. Konfigurasi Environment (.env)

1. Masuk ke folder project di VPS:
   ```bash
   cd /var/www/everiware
   ```
2. Copy file `.env.production` menjadi file `.env`:
   ```bash
   cp .env.production .env
   ```
3. Edit file `.env` menggunakan text editor `nano`:
   ```bash
   nano .env
   ```
4. **Wajib Diubah**:
   - Ganti `DB_ROOT_PASSWORD` dan `DB_PASSWORD` dengan password yang kuat dan aman.
   - Ganti `JWT_SECRET` dengan string acak yang panjang.
   - Ganti `FRONTEND_URL` dan `WEB_URL` dengan domain atau alamat IP VPS Anda (misalnya `http://103.190.24.123` atau `http://absenku.id`).
   - Lengkapi konfigurasi `EMAIL_USER` dan `EMAIL_PASS` (App Password Gmail) agar sistem dapat mengirimkan email notifikasi.
5. Simpan file dengan menekan tombol `CTRL + O`, lalu `Enter`, dan keluar dengan `CTRL + X`.

---

## 5. Menjalankan Aplikasi dengan Docker

1. **Inisialisasi Database**:
   File database schema (`database/schema.sql`) sudah dikonfigurasikan di `docker-compose.yml` untuk otomatis diimport ke database `iware_presence` saat kontainer MySQL pertama kali dijalankan.

2. **Build dan Jalankan Container**:
   Jalankan perintah ini di root folder project untuk membuild image dan menjalankan aplikasi di background:
   ```bash
   docker compose up -d --build
   ```

3. **Memantau Status**:
   - Untuk memeriksa apakah semua container sedang berjalan dengan baik:
     ```bash
     docker compose ps
     ```
   - Untuk melihat log aktivitas sistem secara realtime:
     ```bash
     docker compose logs -f
     ```
   - Untuk melihat log backend saja:
     ```bash
     docker compose logs -f backend
     ```

4. **Menguji Akses**:
   Buka browser dan akses alamat IP VPS Anda (misalnya `http://ip_address_vps_anda`). Halaman Dashboard Frontend Everiware harusnya sudah bisa diakses dan terhubung dengan API backend.

---

## 6. Konfigurasi SSL (HTTPS) dengan Certbot / Let's Encrypt

Untuk mengamankan aplikasi dengan HTTPS (sangat penting untuk akses GPS pada mobile/web), ikuti langkah berikut:

### Langkah 1: Hubungkan Domain ke VPS Anda
Pastikan domain Anda (contoh: `absen.everiware.id`) telah diarahkan (A Record) ke IP VPS Anda melalui panel DNS Hostinger.

### Langkah 2: Edit `nginx.conf` di VPS untuk SSL
Kita akan menggunakan certbot untuk mengambil sertifikat SSL dan mengonfigurasi Nginx di port 443 secara otomatis. 
Namun karena Nginx kita berjalan di dalam Docker, cara paling mudah dan bersih adalah menginstal **Nginx + Certbot** langsung di host VPS sebagai *Reverse Proxy eksternal* yang meneruskan traffic HTTPS ke port 80 Docker.

Mari kita install Nginx di VPS luar Docker:
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Langkah 3: Konfigurasi Nginx di Host VPS
Buat file konfigurasi baru di host VPS:
```bash
sudo nano /etc/nginx/sites-available/everiware
```

Tempel konfigurasi berikut (ganti `domain_anda.com` dengan domain asli):
```nginx
server {
    listen 80;
    server_name domain_anda.com www.domain_anda.com;

    location / {
        proxy_pass http://127.0.0.1:80; # Meneruskan traffic ke container Nginx Docker
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
```

> [!WARNING]
> Sebelum mengaktifkan konfigurasi ini, ubah port mapping container frontend di `docker-compose.yml` agar tidak bentrok dengan Nginx host.
> Edit `docker-compose.yml`:
> ```yaml
>   frontend:
>     ...
>     ports:
>       - "127.0.0.1:8080:80" # Diubah dari 80:80 menjadi 127.0.0.1:8080:80
> ```
> Lalu sesuaikan `proxy_pass http://127.0.0.1:80;` di config Nginx VPS host menjadi `proxy_pass http://127.0.0.1:8080;`.

Aktifkan konfigurasi Nginx VPS:
```bash
sudo ln -s /etc/nginx/sites-available/everiware /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default # Hapus default config bawaan
sudo nginx -t # Tes konfigurasi
sudo systemctl restart nginx
```

Lalu jalankan Docker Compose ulang:
```bash
docker compose down
docker compose up -d --build
```

### Langkah 4: Ambil Sertifikat SSL Let's Encrypt
Jalankan Certbot untuk membuat SSL dan mengonfigurasinya otomatis ke HTTPS:
```bash
sudo certbot --nginx -d domain_anda.com -d www.domain_anda.com
```
Ikuti instruksi di layar, masukkan email Anda, dan pilih opsi **Redirect** agar semua traffic HTTP dialihkan secara otomatis ke HTTPS.

---

## 7. Operasi & Perawatan (Backup & Log)

### A. Melihat Log Aplikasi
Jika ada kendala (misalnya gagal koneksi database atau error backend), periksa log dengan:
```bash
docker compose logs --tail=100 -f backend
```

### B. Backup Database MySQL
Untuk membackup database `iware_presence` langsung dari container ke host VPS:
```bash
docker exec -t iware_db mysqldump -u iware_user -p'password_user_anda' iware_presence > backup_db_$(date +%F).sql
```

### C. Masuk Ke CLI MySQL di Dalam Container
Jika ingin query langsung ke database:
```bash
docker exec -it iware_db mysql -u iware_user -p iware_presence
```

### D. Mengupdate Aplikasi
Jika ada pembaruan kode (misal Anda push perubahan baru ke GitHub):
```bash
git pull origin main
docker compose up -d --build
```
*Docker hanya akan membuild ulang image yang kodenya berubah.*
