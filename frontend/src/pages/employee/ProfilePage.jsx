import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, Building, Briefcase, Lock, LogOut,
  BarChart3, LifeBuoy, ChevronDown, Pencil, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import PageHeader from '../../components/ui/PageHeader';
import { SettingsSection, SettingsRow } from '../../components/ui/SettingsSection';

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

  const infoRows = [
    { icon: User, label: 'Nama', value: user?.name },
    { icon: Mail, label: 'Email', value: user?.email },
    { icon: Phone, label: 'WhatsApp', value: user?.phone || '-' },
    { icon: Building, label: 'Departemen', value: user?.department || '-' },
    { icon: Briefcase, label: 'Jabatan', value: user?.position || '-' },
  ];

  return (
    <div className="bg-[#F8F7F5] min-h-screen">
      <PageHeader
        title="Informasi Akun"
        name={user?.name}
        meta={[user?.department, user?.position || roleLabel[user?.role]].filter(Boolean).join(' · ') || 'Karyawan'}
        avatar={{
          url: avatarUrl,
          fallback: user?.name?.[0],
          onPick: handleAvatarChange,
          loading: avatarLoading,
          showCamera: true,
        }}
      />

      <div className="px-5 pt-5 pb-6 lg:px-8 space-y-3 lg:max-w-3xl lg:mx-auto">

        {/* ── Kartu informasi akun ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[18px] border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-3.5">
            <h3 className="font-extrabold text-[15px] text-stone-900">Informasi Akun</h3>
            <button
              onClick={() => setEditMode(!editMode)}
              className="w-8 h-8 rounded-[10px] flex items-center justify-center border transition-colors"
              style={editMode
                ? { backgroundColor: '#FEF2F2', borderColor: 'rgba(220,38,38,0.2)' }
                : { backgroundColor: 'rgba(139,31,31,0.06)', borderColor: 'rgba(139,31,31,0.15)' }}
              aria-label={editMode ? 'Batal edit' : 'Edit profil'}
            >
              {editMode
                ? <X size={16} className="text-red-600" />
                : <Pencil size={15} style={{ color: '#8B1F1F' }} />}
            </button>
          </div>

          <div className="h-px bg-[#F5F5F4]" />

          {editMode ? (
            <form onSubmit={handleUpdateProfile} className="p-[18px] space-y-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Nama Lengkap</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-brand" required />
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Nomor WhatsApp</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-brand" type="tel" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 text-sm font-semibold rounded-xl text-white bg-[#8B1F1F] hover:bg-[#6d1818] active:scale-[0.98] transition-all disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </form>
          ) : (
            <div className="px-[18px] py-1">
              {infoRows.map((item, i) => (
                <div key={item.label}
                  className={`flex items-center gap-3.5 py-2.5 ${i < infoRows.length - 1 ? 'border-b border-[#F5F5F4]' : ''}`}>
                  <span className="w-[38px] h-[38px] rounded-[10px] bg-stone-100 flex items-center justify-center flex-shrink-0">
                    <item.icon size={17} className="text-stone-500" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-stone-400">{item.label}</div>
                    <div className="font-semibold text-stone-900 text-sm truncate">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Fitur & dukungan ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <SettingsSection title="FITUR & DUKUNGAN">
            <SettingsRow
              icon={BarChart3}
              title="Statistik Saya"
              subtitle="Ringkasan kehadiran & aktivitas"
              onClick={() => navigate('/my-stats')}
            />
            <SettingsRow
              icon={LifeBuoy}
              title="Pusat Bantuan"
              subtitle="Hubungi HRD atau baca FAQ"
              onClick={() => navigate('/helpdesk')}
              isLast
            />
          </SettingsSection>
        </motion.div>

        {/* ── Keamanan & akses ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SettingsSection title="KEAMANAN & AKSES">
            <SettingsRow
              icon={Lock}
              title="Ubah Password"
              subtitle="Perbarui kata sandi akun Anda"
              onClick={() => setPassMode(!passMode)}
              isLast
              trailing={
                <span className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <ChevronDown size={17} className={`text-stone-400 transition-transform ${passMode ? 'rotate-180' : ''}`} />
                </span>
              }
              expanded={passMode && (
                <form onSubmit={handleChangePassword} className="px-[18px] pb-4 pt-1 space-y-2.5">
                  <div className="h-px bg-[#F5F5F4] mb-3" />
                  <input type="password" placeholder="Password lama" value={passForm.old_password}
                    onChange={(e) => setPassForm({ ...passForm, old_password: e.target.value })} className="input-brand" required />
                  <input type="password" placeholder="Password baru (min. 6 karakter)" value={passForm.new_password}
                    onChange={(e) => setPassForm({ ...passForm, new_password: e.target.value })} className="input-brand" required minLength={6} />
                  <input type="password" placeholder="Konfirmasi password baru" value={passForm.confirm}
                    onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })} className="input-brand" required />
                  <button type="submit" disabled={loading}
                    className="w-full py-2.5 text-sm font-semibold rounded-xl text-white bg-[#8B1F1F] hover:bg-[#6d1818] active:scale-[0.98] transition-all disabled:opacity-50">
                    {loading ? 'Menyimpan...' : 'Ubah Password'}
                  </button>
                </form>
              )}
            />
          </SettingsSection>
        </motion.div>

        {/* ── Logout ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="pt-1">
          <SettingsSection>
            <SettingsRow
              icon={LogOut}
              iconColor="#DC2626"
              iconBg="#FEF2F2"
              title="Keluar dari Akun"
              subtitle="Akhiri sesi di perangkat ini"
              titleColor="#DC2626"
              onClick={handleLogout}
              isLast
            />
          </SettingsSection>
        </motion.div>

        {/* ── Versi aplikasi ── */}
        <div className="pt-5 text-center">
          <span className="inline-block px-3.5 py-1.5 rounded-full bg-[#FEF2F2] border border-red-600/20 text-red-600 text-xs font-semibold">
            EVERIWARE v1.0.0
          </span>
          <p className="text-stone-400 text-[11px] mt-1.5">© 2026 CV. Rajawali Bina Maju</p>
        </div>
      </div>
    </div>
  );
}
