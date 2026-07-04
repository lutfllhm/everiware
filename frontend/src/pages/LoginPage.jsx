import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import useAuthStore from '../store/authStore';

const imgVariants = {
  initial: (dir) => ({ x: dir === 'left' ? '6%' : '-6%', scale: 1.1, opacity: 0, filter: 'blur(12px) brightness(0.8)' }),
  animate: { x: 0, scale: 1, opacity: 1, filter: 'blur(0px) brightness(1)', transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir) => ({ x: dir === 'left' ? '-5%' : '5%', scale: 0.95, opacity: 0, filter: 'blur(8px) brightness(0.7)', transition: { duration: 0.4, ease: [0.55, 0, 1, 0.45] } }),
};

const textVariants = {
  initial: (dir) => ({ y: dir === 'left' ? 28 : -28, opacity: 0 }),
  animate: { y: 0, opacity: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.18 } },
  exit: (dir) => ({ y: dir === 'left' ? -20 : 20, opacity: 0, transition: { duration: 0.25, ease: [0.55, 0, 1, 0.45] } }),
};

const formVariants = {
  initial: (dir) => ({ x: dir === 'left' ? 56 : -56, opacity: 0, scale: 0.96 }),
  animate: { x: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 } },
  exit: (dir) => ({ x: dir === 'left' ? -36 : 36, opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: [0.55, 0, 1, 0.45] } }),
};

export default function LoginPage() {
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState('login');
  const [direction, setDirection] = useState('right');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);
  const [resetToken, setResetToken] = useState(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [form, setForm] = useState({ email: '', password: '', newPassword: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleForgotPassword = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: form.email });
      if (data.userId) { setPendingUserId(data.userId); setDirection('left'); setMode('reset-otp'); }
      toast.success(data.message);
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal mengirim kode'); }
    finally { setLoading(false); }
  };

  const handleVerifyResetOTP = async () => {
    const code = otp.join('');
    if (code.length !== 6) return toast.error('Masukkan 6 digit kode OTP');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-reset-otp', { userId: pendingUserId, otp: code });
      setResetToken(data.resetToken);
      setOtp(['','','','','','']);
      setDirection('left');
      setMode('new-password');
    } catch (err) { toast.error(err.response?.data?.message || 'Kode OTP salah'); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 6) return toast.error('Password minimal 6 karakter');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { userId: pendingUserId, resetToken, newPassword: form.newPassword });
      toast.success(data.message);
      setForm({ ...form, newPassword: '', password: '' });
      setDirection('right');
      setMode('login');
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal reset password'); }
    finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password });
      if (data.needVerify) { setPendingUserId(data.userId); setDirection('left'); setMode('otp'); return; }
      localStorage.setItem('token', data.token);
      localStorage.setItem('iware-auth', JSON.stringify({ user: data.user, token: data.token, isAuthenticated: true }));
      setAuth(data.user, data.token);
      toast.success('Berhasil masuk!');
      setTimeout(() => { window.location.href = ['superadmin','admin','hrd'].includes(data.user.role) ? '/admin' : '/dashboard'; }, 300);
    } catch (err) { toast.error(err.response?.data?.message || 'Email atau password salah'); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (val, idx) => {
    const n = [...otp]; n[idx] = val.slice(-1); setOtp(n);
    if (val && idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
  };
  const handleOtpKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) document.getElementById(`otp-${idx - 1}`)?.focus();
  };

  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length !== 6) return toast.error('Masukkan 6 digit kode OTP');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { userId: pendingUserId, otp: code });
      localStorage.setItem('token', data.token); setAuth(data.user, data.token);
      toast.success('Verifikasi berhasil!');
      window.location.href = ['superadmin','admin','hrd'].includes(data.user.role) ? '/admin' : '/dashboard';
    } catch (err) { toast.error(err.response?.data?.message || 'Kode OTP salah atau sudah kadaluarsa'); }
    finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    try { await api.post('/auth/resend-otp', { userId: pendingUserId }); toast.success('Kode baru sudah dikirim'); setOtp(['','','','','','']); }
    catch { toast.error('Gagal mengirim ulang kode'); }
  };

  const inputCls = 'w-full h-12 rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-white/35 outline-none transition-all duration-200 hover:bg-white/10 hover:border-white/15 focus:bg-white/10 focus:border-[#EF5350] focus:ring-2 focus:ring-[#EF5350]/20';
  const btnCls = 'w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-white/95 active:scale-[0.98] text-[#5C0A0B] text-base font-extrabold tracking-wide transition-all duration-200 disabled:opacity-40 shadow-md';

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#6B0E11] via-[#380507] to-[#160102] flex items-center justify-center relative overflow-x-hidden overflow-y-auto py-12 px-6">
      {/* Background waves/curves pattern matching BackgroundCurvesPainter */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg className="absolute w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Wave 1: Soft broad fill shape at bottom-left */}
          <path d="M 0 45 Q 45 52 32 82 Q 22 95 0 92 Z" fill="rgba(255, 255, 255, 0.025)" />
          
          {/* Wave 2: Sweeping curved border stroke across screen */}
          <path d="M 100 25 C 45 42 15 68 85 92" fill="none" stroke="rgba(255, 255, 255, 0.015)" strokeWidth="3.5" />
          
          {/* Wave 3: Small outline arc bottom right */}
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
          <AnimatePresence mode="wait" custom={direction}>

          {mode === 'login' && (
            <motion.div key="login" custom={direction} variants={formVariants} initial="initial" animate="animate" exit="exit">
              <div className="mb-7 text-left">
                <h1 className="text-white text-[22px] font-extrabold tracking-tight">Masuk ke Akun</h1>
                <p className="text-white/50 text-xs mt-1">jangan bagikan info login kamu ke siapapun.</p>
              </div>
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
                  <input
                    name="email"
                    type="email"
                    placeholder="Username atau Email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputCls}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                    className={`${inputCls} pr-12`}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setDirection('left'); setMode('forgot'); }}
                    className="text-white/80 text-xs font-semibold hover:underline"
                  >
                    Lupa password?
                  </button>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={loading} className={btnCls}>
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-[#5C0A0B]/30 border-t-[#5C0A0B] rounded-full animate-spin" />
                    ) : (
                      'Masuk'
                    )}
                  </button>
                </div>
              </form>

              <div className="text-center mt-6">
                <span className="text-white/50 text-xs">Belum punya akun? Silakan hubungi HRD. Terima kasih.</span>
              </div>

            </motion.div>
          )}

          {mode === 'otp' && (
            <motion.div key="otp" custom={direction} variants={formVariants} initial="initial" animate="animate" exit="exit">
              <div className="mb-7 text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <Mail size={22} className="text-white" />
                </div>
                <h1 className="text-white text-[22px] font-extrabold tracking-tight">Cek email kamu</h1>
                <p className="text-white/50 text-xs mt-1 leading-relaxed">
                  Kode 6 digit sudah dikirim ke email kamu.<br />
                  <span className="text-white/40">Berlaku selama 10 menit.</span>
                </p>
              </div>

              <div className="flex justify-center gap-2 mb-6">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                    className="w-12 h-12 text-center text-xl font-bold rounded-2xl border border-white/10 bg-white/5 text-white outline-none transition-all focus:border-[#EF5350] focus:bg-white/10 focus:ring-2 focus:ring-[#EF5350]/20"
                  />
                ))}
              </div>

              <button onClick={handleVerifyOTP} disabled={loading} className={`${btnCls} mb-4`}>
                {loading ? (
                  <span className="w-5 h-5 border-2 border-[#5C0A0B]/30 border-t-[#5C0A0B] rounded-full animate-spin" />
                ) : (
                  'Verifikasi Kode'
                )}
              </button>

              <button
                type="button"
                onClick={handleResendOTP}
                className="flex items-center justify-center gap-2 text-white/50 hover:text-white text-xs font-semibold transition-colors w-full"
              >
                <RefreshCw size={13} /> Kirim ulang kode
              </button>
            </motion.div>
          )}

          {mode === 'forgot' && (
            <motion.div key="forgot" custom={direction} variants={formVariants} initial="initial" animate="animate" exit="exit">
              <div className="mb-7 text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <Lock size={22} className="text-white" />
                </div>
                <h1 className="text-white text-[22px] font-extrabold tracking-tight">Lupa Password?</h1>
                <p className="text-white/50 text-xs mt-1 leading-relaxed">
                  Masukkan email kamu dan kami akan mengirimkan kode reset password.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
                  <input
                    name="email"
                    type="email"
                    placeholder="Alamat email terdaftar"
                    value={form.email}
                    onChange={handleChange}
                    className={inputCls}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={loading} className={btnCls}>
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-[#5C0A0B]/30 border-t-[#5C0A0B] rounded-full animate-spin" />
                    ) : (
                      'Kirim Kode Reset'
                    )}
                  </button>
                </div>
              </form>

              <button
                type="button"
                onClick={() => { setDirection('right'); setMode('login'); }}
                className="flex items-center justify-center gap-2 text-white/50 hover:text-white text-xs font-semibold transition-colors w-full mt-5"
              >
                ← Kembali ke Login
              </button>
            </motion.div>
          )}

          {mode === 'reset-otp' && (
            <motion.div key="reset-otp" custom={direction} variants={formVariants} initial="initial" animate="animate" exit="exit">
              <div className="mb-7 text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <Mail size={22} className="text-white" />
                </div>
                <h1 className="text-white text-[22px] font-extrabold tracking-tight">Cek email kamu</h1>
                <p className="text-white/50 text-xs mt-1 leading-relaxed">
                  Kode reset password sudah dikirim ke email kamu.<br />
                  <span className="text-white/40">Berlaku selama 10 menit.</span>
                </p>
              </div>

              <div className="flex justify-center gap-2 mb-6">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                    className="w-12 h-12 text-center text-xl font-bold rounded-2xl border border-white/10 bg-white/5 text-white outline-none transition-all focus:border-[#EF5350] focus:bg-white/10 focus:ring-2 focus:ring-[#EF5350]/20"
                  />
                ))}
              </div>

              <button onClick={handleVerifyResetOTP} disabled={loading} className={`${btnCls} mb-4`}>
                {loading ? (
                  <span className="w-5 h-5 border-2 border-[#5C0A0B]/30 border-t-[#5C0A0B] rounded-full animate-spin" />
                ) : (
                  'Verifikasi Kode'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setDirection('right'); setMode('forgot'); }}
                className="flex items-center justify-center gap-2 text-white/50 hover:text-white text-xs font-semibold transition-colors w-full"
              >
                ← Kirim ulang kode
              </button>
            </motion.div>
          )}

          {mode === 'new-password' && (
            <motion.div key="new-password" custom={direction} variants={formVariants} initial="initial" animate="animate" exit="exit">
              <div className="mb-7 text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <Lock size={22} className="text-white" />
                </div>
                <h1 className="text-white text-[22px] font-extrabold tracking-tight">Buat Password Baru</h1>
                <p className="text-white/50 text-xs mt-1">Masukkan password baru kamu. Minimal 6 karakter.</p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
                  <input
                    name="newPassword"
                    type={showNewPass ? 'text' : 'password'}
                    placeholder="Password baru (min. 6 karakter)"
                    value={form.newPassword}
                    onChange={handleChange}
                    className={`${inputCls} pr-12`}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={loading} className={btnCls}>
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-[#5C0A0B]/30 border-t-[#5C0A0B] rounded-full animate-spin" />
                    ) : (
                      'Simpan Password Baru'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-white/30 text-xs">© 2026 Everiware · CV. Rajawali Bina Maju</p>
        </div>
      </div>
    </div>
  );
}




