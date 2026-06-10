import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, ShieldAlert, CheckCircle } from 'lucide-react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

export default function ActivateAccountPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [userData, setUserData] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    checkToken();
  }, [token]);

  const checkToken = async () => {
    try {
      const { data } = await axios.get(`/auth/activation/${token}`);
      if (data.success) {
        setValidToken(true);
        setUserData(data.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Token aktivasi tidak valid atau sudah kadaluarsa');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      toast.error('Password minimal 6 karakter');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok');
      toast.error('Password dan konfirmasi password tidak cocok');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axios.post('/auth/activate', { token, password });
      if (data.success) {
        toast.success('Akun berhasil diaktifkan!');
        setActivated(true);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Gagal mengaktifkan akun';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenApp = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    if (/android/i.test(userAgent)) {
      // Android Intent URL (Membuka aplikasi terpasang via package name)
      window.location.href = "intent://open#Intent;scheme=everiware;package=com.iware.iware_presence_app;end";
    } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      // iOS Custom Scheme
      window.location.href = "everiware://";
      // Fallback ke login web jika aplikasi tidak merespon dalam 2 detik
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } else {
      // Desktop
      navigate('/login');
    }
  };

  const inputCls = 'w-full h-12 rounded-2xl border border-white/10 bg-white/5 pl-11 pr-12 text-sm text-white placeholder:text-white/35 outline-none transition-all duration-200 hover:bg-white/10 hover:border-white/15 focus:bg-white/10 focus:border-[#EF5350] focus:ring-2 focus:ring-[#EF5350]/20';
  const btnCls = 'w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-white/95 active:scale-[0.98] text-[#5C0A0B] text-base font-extrabold tracking-wide transition-all duration-200 disabled:opacity-40 shadow-md';

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#6B0E11] via-[#380507] to-[#160102] flex items-center justify-center relative overflow-x-hidden overflow-y-auto py-12 px-6">
      {/* Background waves/curves pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg className="absolute w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 0 45 Q 45 52 32 82 Q 22 95 0 92 Z" fill="rgba(255, 255, 255, 0.025)" />
          <path d="M 100 25 C 45 42 15 68 85 92" fill="none" stroke="rgba(255, 255, 255, 0.015)" strokeWidth="3.5" />
          <path d="M 40 100 Q 70 85 100 90" fill="none" stroke="rgba(255, 255, 255, 0.01)" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="w-full max-w-[400px] z-10 relative flex flex-col items-center">
        {/* Circular Logo */}
        <div className="w-[90px] h-[90px] rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.2)] overflow-hidden bg-transparent flex items-center justify-center mb-3">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>

        {/* Brand Text */}
        <h2 className="text-white text-[25px] font-black italic tracking-[0.12em] text-center mb-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.38)]" style={{ fontFamily: 'Usuzi, sans-serif' }}>
          EVERIWARE
        </h2>

        {/* Form Content */}
        <div className="w-full">
          {loading && (
            <div className="flex flex-col items-center py-8">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              <p className="mt-4 text-white/60 text-xs">Memverifikasi token...</p>
            </div>
          )}

          {!loading && !validToken && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <ShieldAlert className="h-6 w-6 text-[#EF5350]" />
              </div>
              <h1 className="text-white text-[22px] font-extrabold tracking-tight mb-2">Token Tidak Valid</h1>
              <p className="text-white/50 text-xs mb-8 px-2 leading-relaxed">{error || 'Token aktivasi tidak valid atau sudah kadaluarsa'}</p>
              <button
                onClick={() => navigate('/login')}
                className={btnCls}
              >
                Kembali ke Login
              </button>
            </motion.div>
          )}

          {!loading && validToken && !activated && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="mb-7 text-left">
                <h1 className="text-white text-[22px] font-extrabold tracking-tight">Aktifkan Akun</h1>
                <p className="text-white/50 text-xs mt-1.5 leading-relaxed">
                  Selamat datang, <span className="font-bold text-white/90">{userData?.name}</span>!<br />
                  Silakan atur kata sandi baru untuk akun Anda.
                </p>
                <p className="text-white/30 text-[11px] mt-1">{userData?.email}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-[#EF5350] px-4 py-3 rounded-2xl text-xs flex gap-2">
                    <span className="text-sm mt-0.5">⚠️</span>
                    <p className="leading-relaxed">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-2 pl-1">
                    Password Baru
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls}
                      placeholder="Minimal 6 karakter"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-2 pl-1">
                    Konfirmasi Password
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputCls}
                      placeholder="Ketik ulang password baru"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className={btnCls}
                  >
                    {submitting ? (
                      <span className="w-5 h-5 border-2 border-[#5C0A0B]/30 border-t-[#5C0A0B] rounded-full animate-spin" />
                    ) : (
                      'Aktifkan Akun & Login'
                    )}
                  </button>
                </div>
              </form>

              <div className="text-center mt-6">
                <span className="text-white/60 text-xs">Sudah punya akun? </span>
                <button
                  onClick={() => navigate('/login')}
                  className="text-white text-xs font-bold hover:underline"
                >
                  Login di sini
                </button>
              </div>
            </motion.div>
          )}

          {!loading && validToken && activated && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <h1 className="text-white text-[22px] font-extrabold tracking-tight mb-2">Akun Berhasil Aktif!</h1>
              <p className="text-white/50 text-xs mb-8 px-2 leading-relaxed">
                Kata sandi Anda telah berhasil disimpan. Silakan buka aplikasi Everiware untuk mulai melakukan absensi.
              </p>
              
              <button
                onClick={handleOpenApp}
                className={btnCls}
              >
                Buka Aplikasi Everiware
              </button>

              <div className="text-center mt-6">
                <button
                  onClick={() => navigate('/login')}
                  className="text-white/60 hover:text-white text-xs font-semibold"
                >
                  Masuk via Web Browser
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="w-full mt-12 text-center">
          <p className="text-white/30 text-xs">© 2026 Everiware · CV. Rajawali Bina Maju</p>
        </div>
      </div>
    </div>
  );
}
