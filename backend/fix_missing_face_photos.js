// Memulihkan verifikasi wajah setelah restore backup yang tidak menyertakan folder uploads.
//
// Baris di tabel users masih menyimpan nama file face_photo, tetapi file gambarnya hilang
// bersama volume uploads. Akibatnya verifyFace() selalu menolak dengan pesan
// "Foto referensi wajah tidak ditemukan" dan karyawan tidak bisa absen sama sekali.
// Skrip ini mencocokkan isi DB dengan file yang benar-benar ada di disk, lalu mengosongkan
// referensi yang menggantung supaya user diarahkan registrasi wajah ulang lewat aplikasi.
//
// Jalankan di VPS:
//   docker cp backend/fix_missing_face_photos.js everiware_backend:/app/
//   docker exec everiware_backend node fix_missing_face_photos.js          # audit saja
//   docker exec everiware_backend node fix_missing_face_photos.js --apply  # sekaligus reset

const fs = require('fs');
const path = require('path');
const { pool } = require('./src/config/database');

const AVATAR_DIR = path.join(__dirname, 'uploads', 'avatar');
const APPLY = process.argv.includes('--apply');

// Kolom referensi wajah: frontal wajib, kiri/kanan opsional (dipakai sebagai referensi tambahan)
const REF_COLUMNS = ['face_photo', 'face_photo_left', 'face_photo_right'];

const exists = (filename) => !!filename && fs.existsSync(path.join(AVATAR_DIR, filename));

async function run() {
  try {
    if (!fs.existsSync(AVATAR_DIR)) {
      console.error(`❌ Folder ${AVATAR_DIR} tidak ada. Pastikan skrip dijalankan di dalam container backend.`);
      process.exit(1);
    }
    console.log(`📁 ${AVATAR_DIR}: ${fs.readdirSync(AVATAR_DIR).length} file`);
    console.log(APPLY ? '⚙️  Mode: APPLY (database akan diubah)\n' : '🔍 Mode: AUDIT (tidak ada perubahan)\n');

    const [users] = await pool.query(
      `SELECT id, name, email, employee_id, face_registered, ${REF_COLUMNS.join(', ')}
       FROM users WHERE face_registered = TRUE OR face_photo IS NOT NULL`
    );

    const broken = [];  // frontal hilang -> tidak bisa absen sama sekali
    const partial = []; // frontal ada, tapi referensi kiri/kanan hilang
    let ok = 0;

    for (const u of users) {
      const missing = REF_COLUMNS.filter((c) => u[c] && !exists(u[c]));
      if (missing.length === 0) { ok++; continue; }
      (missing.includes('face_photo') ? broken : partial).push({ user: u, missing });
    }

    console.log(`✅ Utuh                      : ${ok}`);
    console.log(`⚠️  Referensi tambahan hilang : ${partial.length}`);
    console.log(`❌ Foto frontal hilang        : ${broken.length}\n`);

    if (broken.length) {
      console.log('--- Perlu registrasi wajah ulang ---');
      broken.forEach(({ user: u }) => console.log(`  [${u.employee_id || u.id}] ${u.name} <${u.email}> -> ${u.face_photo}`));
      console.log();
    }
    if (partial.length) {
      console.log('--- Masih bisa absen, hanya referensi sudut yang hilang ---');
      partial.forEach(({ user: u, missing }) => console.log(`  [${u.employee_id || u.id}] ${u.name}: ${missing.join(', ')}`));
      console.log();
    }

    if (!APPLY) {
      console.log('Tidak ada yang diubah. Jalankan ulang dengan --apply untuk menerapkan reset.');
      return;
    }

    // Frontal hilang: kosongkan seluruh referensi dan cabut face_registered agar aplikasi
    // menampilkan alur registrasi wajah, bukan menolak absensi dengan pesan error.
    for (const { user: u } of broken) {
      await pool.query(
        'UPDATE users SET face_photo = NULL, face_photo_left = NULL, face_photo_right = NULL, face_registered = FALSE WHERE id = ?',
        [u.id]
      );
      console.log(`🔄 Reset: ${u.name}`);
    }

    // Frontal masih ada: cukup buang referensi sudut yang menggantung, absensi tetap jalan.
    for (const { user: u, missing } of partial) {
      await pool.query(
        `UPDATE users SET ${missing.map((c) => `${c} = NULL`).join(', ')} WHERE id = ?`,
        [u.id]
      );
      console.log(`🧹 Bersihkan ${missing.join(', ')}: ${u.name}`);
    }

    console.log(`\n✅ Selesai. ${broken.length} user perlu registrasi wajah ulang, ${partial.length} user dibersihkan.`);
  } catch (err) {
    console.error('❌ Gagal:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
run();
