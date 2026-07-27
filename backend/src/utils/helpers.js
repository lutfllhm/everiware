const crypto = require('crypto');
const { pool } = require('../config/database');

// Komponen waktu WIB (UTC+7) untuk LOGIKA perhitungan (cek terlambat, cek hari
// Sabtu/Minggu, dll), tidak tergantung timezone server/container. Baca field
// dengan getUTC*() pada hasilnya — nilainya sudah digeser +7 jam secara manual.
// JANGAN pakai untuk nilai yang akan disimpan ke kolom DATETIME (lihat
// attendanceController.js untuk penjelasan kenapa).
const nowWIBParts = () => new Date(Date.now() + 7 * 60 * 60 * 1000);

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateId = () => {
  return crypto.randomUUID();
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
};

// Hitung hari kerja: skip Minggu dan hari libur nasional (Sabtu tetap masuk)
const getWorkingDays = async (startDate, endDate) => {
  const start = new Date(startDate);
  const end   = new Date(endDate);

  // Ambil semua hari libur dalam range dari DB
  let holidaySet = new Set();
  try {
    const [rows] = await pool.query(
      'SELECT date FROM public_holidays WHERE date >= ? AND date <= ?',
      [startDate, endDate]
    );
    rows.forEach(r => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      holidaySet.add(key);
    });
  } catch {
    // Jika tabel belum ada, lanjut tanpa holiday check
  }

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    // Skip Minggu (0) dan hari libur nasional — Sabtu (6) tetap masuk
    if (day !== 0 && !holidaySet.has(key)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

// Versi sync (tanpa DB) — untuk backward compat di tempat yang tidak bisa async
const getWorkingDaysSync = (startDate, endDate) => {
  let count = 0;
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const cur   = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

// Deteksi "impossible travel": jarak antar dua titik GPS berturut-turut yang
// mustahil ditempuh manusia/kendaraan dalam rentang waktu tsb (indikasi GPS
// spoofing/fake GPS yang lolos dari deteksi isMocked). Ambang batas 150 km/jam
// memberi ruang untuk perjalanan pesawat pendek/kereta cepat tanpa false-positive
// berlebihan pada kasus commuting normal.
const MAX_PLAUSIBLE_SPEED_KMH = 150;

const detectImpossibleTravel = (lat1, lon1, lat2, lon2, fromTime, toTime) => {
  const elapsedMs = new Date(toTime) - new Date(fromTime);
  if (elapsedMs <= 0) return null;

  const distanceMeters = calculateDistance(lat1, lon1, lat2, lon2);
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const impliedSpeedKmh = (distanceMeters / 1000) / elapsedHours;

  if (impliedSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH) {
    return {
      distanceKm: distanceMeters / 1000,
      impliedSpeedKmh,
    };
  }
  return null;
};

module.exports = { generateOTP, generateId, calculateDistance, formatDate, getWorkingDays, getWorkingDaysSync, nowWIBParts, detectImpossibleTravel };
