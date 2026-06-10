import { useState, useEffect } from 'react';
import { Save, Clock, Calendar, Building, Database, GitMerge, RotateCcw, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

export default function SettingsAdmin() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [carryOverForm, setCarryOverForm] = useState({ from_year: new Date().getFullYear() - 1, to_year: new Date().getFullYear() });
  const [carryOverLoading, setCarryOverLoading] = useState(false);
  const { user } = useAuthStore();
  const canEdit = user?.role !== 'hrd';

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/users/settings');
        setSettings(data.settings);
      } catch {} finally { setLoading(false); }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/users/settings', settings);
      toast.success('Pengaturan berhasil disimpan');
    } catch { toast.error('Gagal menyimpan pengaturan'); }
    finally { setSaving(false); }
  };

  const handleCarryOver = async () => {
    if (!confirm(`Jalankan carry-over sisa cuti dari ${carryOverForm.from_year} ke ${carryOverForm.to_year}?`)) return;
    setCarryOverLoading(true);
    try {
      const { data } = await api.post('/leave/carry-over', carryOverForm);
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menjalankan carry-over');
    } finally { setCarryOverLoading(false); }
  };

  if (loading) return <div className="text-center py-12 text-slate-400">Memuat pengaturan...</div>;

  const SectionHeader = ({ icon: Icon, color, title }) => (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
        <Icon size={20} />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 bg-slate-800 rounded-full" />
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Banner info untuk HRD */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-700">
          <span className="text-lg">👁️</span>
          <span>Kamu hanya bisa melihat pengaturan. Hubungi Superadmin atau Admin untuk mengubah konfigurasi.</span>
        </div>
      )}
      <form onSubmit={handleSave} className="space-y-6">
        <fieldset disabled={!canEdit} className="disabled:opacity-70 disabled:pointer-events-none">

        {/* Informasi Perusahaan */}
        <div className="card p-6">
          <SectionHeader icon={Building} color="bg-slate-100 text-slate-600" title="Informasi Perusahaan" />
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Nama Aplikasi</label>
              <input value={settings.app_name || ''} onChange={e => setSettings({ ...settings, app_name: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Nama Perusahaan</label>
              <input value={settings.company_name || ''} onChange={e => setSettings({ ...settings, company_name: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Alamat Perusahaan</label>
              <input value={settings.company_address || ''} onChange={e => setSettings({ ...settings, company_address: e.target.value })} className="input-field" />
            </div>
          </div>
        </div>

        {/* Jam Kerja */}
        <div className="card p-6">
          <SectionHeader icon={Clock} color="bg-teal-100 text-teal-600" title="Jam Kerja" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Jam Masuk (Senin–Jumat)</label>
              <input type="time" value={settings.work_start_time || '08:00'} onChange={e => setSettings({ ...settings, work_start_time: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Jam Pulang (Senin–Jumat)</label>
              <input type="time" value={settings.work_end_time || '17:00'} onChange={e => setSettings({ ...settings, work_end_time: e.target.value })} className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-slate-700 mb-1 block">Toleransi Keterlambatan (menit)</label>
              <input type="number" value={settings.late_tolerance || 15} onChange={e => setSettings({ ...settings, late_tolerance: e.target.value })} className="input-field" min={0} max={60} />
              <p className="text-xs text-slate-400 mt-1">Karyawan yang absen lebih dari {settings.late_tolerance || 15} menit setelah jam masuk akan dianggap terlambat</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Batas Maks Izin Terlambat</label>
              <input type="time" value={settings.late_permission_max_time || '11:00'} onChange={e => setSettings({ ...settings, late_permission_max_time: e.target.value })} className="input-field" />
              <p className="text-xs text-slate-400 mt-1">Maksimal jam check-in untuk pengguna izin terlambat</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Batas Minimal Izin Pulang Cepat</label>
              <input type="time" value={settings.early_leave_min_time || '13:00'} onChange={e => setSettings({ ...settings, early_leave_min_time: e.target.value })} className="input-field" />
              <p className="text-xs text-slate-400 mt-1">Minimal jam check-out untuk pengguna izin pulang cepat</p>
            </div>
          </div>

          {/* Pengaturan Sabtu */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-amber-100 rounded-md flex items-center justify-center text-xs">S</span>
              Hari Sabtu
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Status Hari Sabtu</label>
                <select value={settings.saturday_work_enabled ?? 'true'}
                  onChange={e => setSettings({ ...settings, saturday_work_enabled: e.target.value })}
                  className="input-field">
                  <option value="true">Masuk kerja (setengah hari)</option>
                  <option value="false">Libur</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Jam Pulang Sabtu</label>
                <input type="time" value={settings.saturday_end_time || '15:00'}
                  onChange={e => setSettings({ ...settings, saturday_end_time: e.target.value })}
                  className="input-field"
                  disabled={settings.saturday_work_enabled === 'false'} />
              </div>
            </div>
            {settings.saturday_work_enabled !== 'false' && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                📅 Hari Sabtu: masuk jam {settings.work_start_time || '08:00'}, pulang jam {settings.saturday_end_time || '15:00'} WIB
              </p>
            )}
          </div>
        </div>

        {/* Pengaturan Cuti */}
        <div className="card p-6">
          <SectionHeader icon={Calendar} color="bg-purple-100 text-purple-600" title="Pengaturan Cuti" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Jatah Cuti Tahunan (hari)</label>
              <input type="number" value={settings.annual_leave_days || 12} onChange={e => setSettings({ ...settings, annual_leave_days: e.target.value })} className="input-field" min={1} max={30} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Tambahan Cuti per Tahun (hari)</label>
              <input type="number" value={settings.leave_increment_per_year || 1} onChange={e => setSettings({ ...settings, leave_increment_per_year: e.target.value })} className="input-field" min={0} max={5} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-slate-700 mb-1 block">Maks. Pengajuan Cuti per Bulan</label>
              <input
                type="number"
                value={settings.max_leave_requests_per_month || 0}
                onChange={e => setSettings({ ...settings, max_leave_requests_per_month: e.target.value })}
                className="input-field"
                min={0}
                max={31}
              />
              <p className="text-xs text-slate-400 mt-1">
                {parseInt(settings.max_leave_requests_per_month || 0) === 0
                  ? 'Tidak ada batas — karyawan bisa mengajukan cuti berapa kali saja dalam sebulan.'
                  : `Karyawan hanya bisa mengajukan cuti maksimal ${settings.max_leave_requests_per_month} kali per bulan.`}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 bg-slate-50 rounded-xl p-3">
            💡 Karyawan baru mendapat {settings.annual_leave_days || 12} hari. Setelah 1 tahun menjadi {parseInt(settings.annual_leave_days || 12) + parseInt(settings.leave_increment_per_year || 1)} hari.
          </p>
        </div>

        {/* Mode Approval */}
        <div className="card p-6">
          <SectionHeader icon={GitMerge} color="bg-indigo-100 text-indigo-600" title="Mode Approval Izin" />
          <div className="space-y-3">
            {[
              { value: 'single', label: 'Single Level', desc: 'Pengajuan langsung ke HRD/Admin' },
              { value: 'multi',  label: 'Multi Level',  desc: 'Pengajuan ke Atasan dulu, lalu HRD/Admin' },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${settings.leave_approval_mode === opt.value ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" name="approval_mode" value={opt.value}
                  checked={settings.leave_approval_mode === opt.value}
                  onChange={() => setSettings({ ...settings, leave_approval_mode: opt.value })}
                  className="accent-slate-900" />
                <div>
                  <div className="font-medium text-slate-900 text-sm">{opt.label}</div>
                  <div className="text-xs text-slate-400">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
          {settings.leave_approval_mode === 'multi' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
              ⚠️ Pastikan setiap karyawan sudah diatur atasannya di halaman Karyawan (field Manager).
            </p>
          )}
        </div>

        {/* Carry-over */}
        <div className="card p-6">
          <SectionHeader icon={RotateCcw} color="bg-teal-100 text-teal-600" title="Carry-over Sisa Cuti" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Aktifkan Carry-over</label>
              <select value={settings.leave_carryover_enabled || 'false'} onChange={e => setSettings({ ...settings, leave_carryover_enabled: e.target.value })} className="input-field">
                <option value="true">Ya, aktifkan</option>
                <option value="false">Tidak</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Maks. Hari Carry-over</label>
              <input type="number" value={settings.leave_carryover_max_days || 5} onChange={e => setSettings({ ...settings, leave_carryover_max_days: e.target.value })} className="input-field" min={1} max={30} />
            </div>
          </div>
          <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
            Sisa cuti tahun lalu (maks. {settings.leave_carryover_max_days || 5} hari) otomatis ditambahkan ke jatah cuti tahun baru saat karyawan pertama kali mengakses kuota.
          </p>
        </div>

        {/* Tarif Lembur */}
        <div className="card p-6">
          <SectionHeader icon={Clock} color="bg-amber-100 text-amber-600" title="Kompensasi Lembur" />
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Tarif Lembur per Jam (Rp)</label>
            <input type="number" value={settings.overtime_rate_per_hour || 0}
              onChange={e => setSettings({ ...settings, overtime_rate_per_hour: e.target.value })}
              className="input-field" min={0} />
            <p className="text-xs text-slate-400 mt-1">
              {parseInt(settings.overtime_rate_per_hour || 0) === 0
                ? 'Isi 0 untuk menonaktifkan kalkulasi kompensasi di rekap lembur.'
                : `Kompensasi = durasi lembur × Rp ${parseInt(settings.overtime_rate_per_hour).toLocaleString('id-ID')}/jam`}
            </p>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={18} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
        </fieldset>
        {canEdit && (
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={18} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        )}
      </form>

      {/* Trigger Carry-over Manual */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
            <RefreshCw size={20} className="text-teal-600" />
          </div>
          <div>
            <div className="w-1 h-5 bg-slate-800 rounded-full inline-block mr-2 align-middle" />
            <h3 className="font-bold text-slate-900 inline">Jalankan Carry-over Manual</h3>
            <p className="text-slate-500 text-sm mt-0.5">Pindahkan sisa cuti semua karyawan ke tahun berikutnya</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Dari Tahun</label>
            <input type="number" value={carryOverForm.from_year} onChange={e => setCarryOverForm({ ...carryOverForm, from_year: +e.target.value })} className="input-field py-2 text-sm w-28" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Ke Tahun</label>
            <input type="number" value={carryOverForm.to_year} onChange={e => setCarryOverForm({ ...carryOverForm, to_year: +e.target.value })} className="input-field py-2 text-sm w-28" />
          </div>
          <button onClick={handleCarryOver} disabled={carryOverLoading} className="btn-secondary py-2.5 flex items-center gap-2 text-sm disabled:opacity-50">
            <RefreshCw size={15} className={carryOverLoading ? 'animate-spin' : ''} />
            {carryOverLoading ? 'Memproses...' : 'Jalankan Carry-over'}
          </button>
        </div>
      </div>

      {/* Backup */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Database size={20} className="text-amber-600" />
          </div>
          <div>
            <div className="w-1 h-5 bg-slate-800 rounded-full inline-block mr-2 align-middle" />
            <h3 className="font-bold text-slate-900 inline">Backup Database</h3>
            <p className="text-slate-500 text-sm mt-0.5">Unduh backup data aplikasi</p>
          </div>
        </div>
        <button onClick={() => window.location.href = '/admin/backup'} className="btn-secondary flex items-center gap-2 text-sm">
          <Database size={16} /> Buka Halaman Backup
        </button>
      </div>
    </div>
  );
}




