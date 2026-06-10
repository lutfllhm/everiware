import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Building, Briefcase, Lock, LogOut, Camera, ChevronRight, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [passMode, setPassMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [passForm, setPassForm] = useState({ old_password: '', new_password: '', confirm: '' });

  const avatarUrl = user?.avatar
    ? (user.avatar.startsWith('http') ? user.avatar : `/uploads/avatar/${user.avatar}`)
    : null;

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Ukuran foto maksimal 5MB');

    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      // Kirim name & phone dari user state, bukan form state
      formData.append('name', user?.name || '');
      formData.append('phone', user?.phone || '');
      const { data } = await api.put('/users/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.success) {
        updateUser(data.user);
        toast.success('Foto profil berhasil diperbarui');
      }
    } catch (err) {
      console.error('Upload avatar error:', err);
      toast.error(err.response?.data?.message || 'Gagal mengupload foto');
    } finally { setAvatarLoading(false); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('phone', form.phone);
      const { data } = await api.put('/users/profile', formData);
      if (data.success) {
        updateUser(data.user || form);
        toast.success('Profil berhasil diperbarui');
        setEditMode(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui profil');
    } finally { setLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passForm.new_password !== passForm.confirm) return toast.error('Konfirmasi password tidak cocok');
    setLoading(true);
    try {
      await api.put('/users/change-password', { old_password: passForm.old_password, new_password: passForm.new_password });
      toast.success('Password berhasil diubah');
      setPassMode(false);
      setPassForm({ old_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengubah password');
    } finally { setLoading(false); }
  };

  const handleLogout = () => {
    logout();
    toast.success('Sampai jumpa! 👋');
    navigate('/login');
  };

  const roleLabel = { superadmin: 'Super Admin', admin: 'Admin', hrd: 'HRD', employee: 'Karyawan' };

  return (
    <div className="p-4 space-y-4">
      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 rounded-2xl p-6 text-white text-center">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-4xl font-bold overflow-hidden mx-auto border-2 border-white/30">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-white">{user?.name?.[0]}</span>
            }
          </div>
          <label className={`absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-slate-100 transition-colors ${avatarLoading ? 'opacity-50' : ''}`}>
            {avatarLoading
              ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              : <Camera size={14} className="text-slate-700" />
            }
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" disabled={avatarLoading} />
          </label>
        </div>
        <h2 className="text-xl font-bold">{user?.name}</h2>
        <p className="text-slate-400 text-sm">{roleLabel[user?.role] || 'Karyawan'}</p>
        {user?.employee_id && <p className="text-slate-400 text-xs mt-1">ID: {user.employee_id}</p>}
      </motion.div>

      {/* Info Cards */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Informasi Akun</h3>
          <button onClick={() => setEditMode(!editMode)} className="text-indigo-600 text-sm font-medium">
            {editMode ? 'Batal' : 'Edit'}
          </button>
        </div>

        {editMode ? (
          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Nama Lengkap</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Nomor WhatsApp</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" type="tel" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            {[
              { icon: User, label: 'Nama', value: user?.name },
              { icon: Mail, label: 'Email', value: user?.email },
              { icon: Phone, label: 'WhatsApp', value: user?.phone || '-' },
              { icon: Building, label: 'Departemen', value: user?.department || '-' },
              { icon: Briefcase, label: 'Jabatan', value: user?.position || '-' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.icon size={16} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className="font-medium text-slate-900 text-sm truncate">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Change Password */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-5">
        <button onClick={() => setPassMode(!passMode)} className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Lock size={16} className="text-indigo-600" />
            </div>
            <span className="font-medium text-slate-900">Ubah Password</span>
          </div>
          <ChevronRight size={16} className={`text-slate-400 transition-transform ${passMode ? 'rotate-90' : ''}`} />
        </button>

        {passMode && (
          <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
            <input type="password" placeholder="Password lama" value={passForm.old_password}
              onChange={(e) => setPassForm({ ...passForm, old_password: e.target.value })} className="input-field" required />
            <input type="password" placeholder="Password baru (min. 6 karakter)" value={passForm.new_password}
              onChange={(e) => setPassForm({ ...passForm, new_password: e.target.value })} className="input-field" required minLength={6} />
            <input type="password" placeholder="Konfirmasi password baru" value={passForm.confirm}
              onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })} className="input-field" required />
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
              {loading ? 'Menyimpan...' : 'Ubah Password'}
            </button>
          </form>
        )}
      </motion.div>

      {/* Logout */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <button onClick={handleLogout} className="w-full card p-4 flex items-center gap-3 text-red-500 hover:bg-red-50 transition-colors">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
            <LogOut size={16} className="text-red-500" />
          </div>
          <span className="font-medium">Keluar dari Akun</span>
        </button>
      </motion.div>

      <div className="text-center text-slate-400 text-xs pb-4">
        Everiware v1.0.0 · © 2026 CV. Rajawali Bina Maju
      </div>
    </div>
  );
}




