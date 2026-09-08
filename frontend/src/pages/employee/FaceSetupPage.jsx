import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanFace, Camera, Check, RotateCcw, ShieldCheck, Sun, Glasses,
  UserRound, ArrowRight, CameraOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

/**
 * Pendaftaran wajah untuk karyawan baru — padanan web dari IntroScreen di app
 * mobile (lib/screens/auth/intro_screen.dart).
 *
 * Mobile memakai ML Kit untuk mendeteksi pose wajah on-device. Browser tidak
 * punya padanannya, jadi di sini pengguna memotret tiap sudut secara manual dan
 * server yang memvalidasi wajahnya (validateRegistrationFace di backend).
 */

const STEPS = [
  {
    key: 'face_photo',
    title: 'Hadap Depan',
    hint: 'Posisikan wajah tegak menghadap kamera, di dalam lingkaran.',
    required: true,
  },
  {
    key: 'face_photo_left',
    title: 'Menoleh ke Kiri',
    hint: 'Perlahan menoleh ke KIRI, tetap di dalam lingkaran.',
    required: false,
  },
  {
    key: 'face_photo_right',
    title: 'Menoleh ke Kanan',
    hint: 'Perlahan menoleh ke KANAN, tetap di dalam lingkaran.',
    required: false,
  },
];

const TIPS = [
  { icon: Sun, text: 'Pastikan wajah terkena cahaya cukup, hindari backlight' },
  { icon: Glasses, text: 'Lepas masker, topi, dan kacamata hitam' },
  { icon: UserRound, text: 'Hanya wajah Anda yang terlihat di kamera' },
];

const VIDEO_CONSTRAINTS = { facingMode: 'user', width: 720, height: 720 };

const dataUrlToFile = async (dataUrl, filename) => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/jpeg' });
};

export default function FaceSetupPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const webcamRef = useRef(null);

  const [stage, setStage] = useState('intro'); // intro | capture | done
  const [stepIndex, setStepIndex] = useState(0);
  const [shots, setShots] = useState({});      // { [key]: dataUrl }
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const step = STEPS[stepIndex];
  const currentShot = shots[step?.key];

  // Kalau wajah sudah terdaftar, halaman ini tidak ada gunanya lagi. Aturannya
  // sama dengan gerbang di App.jsx: flag menyala DAN file fotonya ada.
  const alreadyRegistered =
    (user?.face_registered === true || user?.face_registered === 1) &&
    typeof user?.face_photo === 'string' && user.face_photo.trim() !== '';

  useEffect(() => {
    if (alreadyRegistered && stage !== 'done') navigate('/dashboard', { replace: true });
  }, [alreadyRegistered, stage, navigate]);

  const handleCapture = useCallback(() => {
    const shot = webcamRef.current?.getScreenshot();
    if (!shot) return toast.error('Gagal mengambil foto, coba lagi');
    setShots((s) => ({ ...s, [step.key]: shot }));
  }, [step]);

  const handleRetake = () => setShots((s) => ({ ...s, [step.key]: null }));

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    if (!shots.face_photo) {
      setStepIndex(0);
      return toast.error('Foto hadap depan wajib diambil');
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      const ts = Date.now();

      for (const { key } of STEPS) {
        if (!shots[key]) continue;
        formData.append(key, await dataUrlToFile(shots[key], `${key}_${ts}.jpg`));
      }

      const { data } = await api.put('/users/register-face', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.success) {
        // Backend mengembalikan user terbaru; simpan agar gerbang langsung lepas.
        updateUser({ ...(data.user || {}), face_registered: true });
        setStage('done');
      } else {
        toast.error(data.message || 'Gagal mendaftarkan wajah');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal mendaftarkan wajah';
      toast.error(msg);
      // Server menolak foto (mis. wajah tidak terdeteksi) — minta ulang sudut ini.
      setShots((s) => ({ ...s, [step.key]: null }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#6B0E11] via-[#380507] to-[#160102] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <IntroStage key="intro" name={user?.name} onStart={() => setStage('capture')} />
          )}

          {stage === 'capture' && (
            <motion.div key="capture"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>

              {/* Indikator langkah */}
              <div className="flex items-center gap-2 mb-5">
                {STEPS.map((s, i) => {
                  const done = !!shots[s.key];
                  const active = i === stepIndex;
                  return (
                    <div key={s.key} className="flex-1">
                      <div className={`h-1.5 rounded-full transition-colors ${
                        done ? 'bg-[#EF5350]' : active ? 'bg-white/60' : 'bg-white/15'
                      }`} />
                      <p className={`text-[10.5px] mt-1.5 font-semibold ${
                        active ? 'text-white' : 'text-white/45'
                      }`}>
                        {s.title}
                      </p>
                    </div>
                  );
                })}
              </div>

              <h2 className="text-white text-xl font-extrabold tracking-tight">
                {stepIndex + 1}. {step.title}
              </h2>
              <p className="text-white/60 text-[13px] mt-1 leading-relaxed">{step.hint}</p>

              {/* Bingkai kamera */}
              <div className="relative mt-5 aspect-square rounded-[28px] overflow-hidden bg-black/40 border border-white/10">
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                    <CameraOff size={40} className="text-white/40" />
                    <p className="text-white/80 text-sm font-semibold mt-3">Kamera tidak dapat diakses</p>
                    <p className="text-white/50 text-xs mt-1.5 leading-relaxed">{cameraError}</p>
                  </div>
                ) : currentShot ? (
                  <img src={currentShot} alt={step.title} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      mirrored
                      screenshotFormat="image/jpeg"
                      screenshotQuality={0.92}
                      videoConstraints={VIDEO_CONSTRAINTS}
                      onUserMedia={() => { setCameraReady(true); setCameraError(null); }}
                      onUserMediaError={(e) => setCameraError(
                        e?.name === 'NotAllowedError'
                          ? 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini, lalu muat ulang halaman.'
                          : 'Pastikan perangkat punya kamera dan tidak sedang dipakai aplikasi lain.',
                      )}
                      className="w-full h-full object-cover"
                    />

                    {/* Panduan lingkaran */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-[68%] aspect-square rounded-full border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    </div>

                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Aksi */}
              <div className="mt-5 space-y-2.5">
                {currentShot ? (
                  <>
                    <button
                      onClick={handleNext}
                      disabled={submitting}
                      className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-white/95 active:scale-[0.98] text-[#5C0A0B] text-base font-extrabold tracking-wide transition-all disabled:opacity-40 shadow-md"
                    >
                      {submitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-[#5C0A0B]/40 border-t-[#5C0A0B] rounded-full animate-spin" />
                          Mendaftarkan wajah...
                        </>
                      ) : stepIndex < STEPS.length - 1 ? (
                        <>Lanjut <ArrowRight size={18} /></>
                      ) : (
                        <>Selesai & Daftarkan <Check size={18} /></>
                      )}
                    </button>

                    <button
                      onClick={handleRetake}
                      disabled={submitting}
                      className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/85 text-sm font-semibold transition-all disabled:opacity-40"
                    >
                      <RotateCcw size={16} /> Ambil Ulang
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCapture}
                      disabled={!cameraReady || !!cameraError}
                      className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-white/95 active:scale-[0.98] text-[#5C0A0B] text-base font-extrabold tracking-wide transition-all disabled:opacity-40 shadow-md"
                    >
                      <Camera size={18} /> Ambil Foto
                    </button>

                    {/* Sudut kiri & kanan opsional di backend, jadi boleh dilewati. */}
                    {!step.required && (
                      <button
                        onClick={handleNext}
                        className="w-full h-12 rounded-2xl text-white/60 hover:text-white/85 text-sm font-semibold transition-colors"
                      >
                        Lewati sudut ini
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}

          {stage === 'done' && <DoneStage key="done" onContinue={() => navigate('/dashboard', { replace: true })} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

function IntroStage({ name, onStart }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      className="text-center"
    >
      <div className="w-24 h-24 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mx-auto">
        <ScanFace size={48} className="text-white" />
      </div>

      <h1 className="text-white text-2xl font-extrabold tracking-tight mt-6">
        Daftarkan Wajah Anda
      </h1>
      <p className="text-white/65 text-sm mt-2 leading-relaxed px-2">
        {name ? `Halo, ${name.split(' ')[0]}! ` : ''}
        Sebelum mulai absensi, kami perlu merekam wajah Anda sebagai data verifikasi.
        Wajah ini yang akan dicocokkan setiap kali Anda absen.
      </p>

      <div className="mt-7 space-y-2.5 text-left">
        {TIPS.map((tip) => (
          <div key={tip.text} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <tip.icon size={17} className="text-white" />
            </span>
            <span className="text-white/80 text-[12.5px] leading-snug">{tip.text}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-white/95 active:scale-[0.98] text-[#5C0A0B] text-base font-extrabold tracking-wide transition-all mt-7 shadow-md"
      >
        Mulai Pindai Wajah <ArrowRight size={18} />
      </button>

      <p className="text-white/40 text-[11px] mt-4 leading-relaxed">
        Foto wajah hanya dipakai untuk verifikasi absensi dan disimpan di server perusahaan.
      </p>
    </motion.div>
  );
}

function DoneStage({ onContinue }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="w-24 h-24 rounded-full bg-white flex items-center justify-center mx-auto"
      >
        <ShieldCheck size={48} className="text-[#5C0A0B]" />
      </motion.div>

      <h1 className="text-white text-2xl font-extrabold tracking-tight mt-6">
        Verifikasi Wajah Aktif
      </h1>
      <p className="text-white/65 text-sm mt-2 leading-relaxed px-2">
        Wajah Anda berhasil didaftarkan. Sekarang Anda sudah bisa melakukan absensi.
      </p>

      <button
        onClick={onContinue}
        className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-white/95 active:scale-[0.98] text-[#5C0A0B] text-base font-extrabold tracking-wide transition-all mt-8 shadow-md"
      >
        Masuk ke Beranda <ArrowRight size={18} />
      </button>
    </motion.div>
  );
}
