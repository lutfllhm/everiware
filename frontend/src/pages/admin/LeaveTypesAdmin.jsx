import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, X, FileText, Paperclip, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

const empty = { code: '', name: '', requires_attachment: false, deducts_quota: false, blocks_attendance: true, max_duration_minutes: null, is_active: true };

export default function LeaveTypesAdmin() {
  const [types, setTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const { user } = useAuthStore();
  const canEdit = user?.role !== 'hrd';

  useEffect(() => { fetchTypes(); }, []);

  const fetchTypes = async () => {
    try { const { data } = await api.get('/leave-types'); setTypes(data.leaveTypes); } catch {}
  };

  const openAdd = () => { setEditItem(null); setForm(empty); setShowModal(true); };
  const openEdit = (t) => {
    setEditItem(t);
    setForm({ code: t.code, name: t.name, requires_attachment: !!t.requires_attachment, deducts_quota: !!t.deducts_quota, blocks_attendance: t.blocks_attendance !== undefined ? !!t.blocks_attendance : true, max_duration_minutes: t.max_duration_minutes || null, is_active: !!t.is_active });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/leave-types/${editItem.id}`, form);
        toast.success('Jenis izin diperbarui');
      } else {
        await api.post('/leave-types', form);
        toast.success('Jenis izin ditambahkan');
      }
      setShowModal(false);
      fetchTypes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus jenis izin ini?')) return;
    try {
      await api.delete(`/leave-types/${id}`);
      toast.success('Jenis izin dihapus');
      fetchTypes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus');
    }
  };

  const defaultCodes = ['annual', 'sick', 'permission'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900">Jenis Izin & Cuti</h2>
          <p className="text-slate-500 text-sm">Kelola tipe izin yang tersedia untuk karyawan</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} className="btn-primary py-2.5 flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Jenis
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`card p-5 ${!t.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <FileText size={18} className="text-slate-600" />
              </div>
              <div className="flex gap-1">
                {canEdit && (
                  <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                    <Edit size={14} className="text-slate-500" />
                  </button>
                )}
                {canEdit && !defaultCodes.includes(t.code) && (
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                )}
              </div>
            </div>
            <h3 className="font-bold text-slate-900">{t.name}</h3>
            <p className="text-slate-400 text-xs mt-0.5 font-mono">{t.code}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {t.requires_attachment && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  <Paperclip size={10} /> Butuh lampiran
                </span>
              )}
              {t.deducts_quota && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  <TrendingDown size={10} /> Kurangi kuota
                </span>
              )}
              {t.blocks_attendance ? (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Blokir absensi
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Tidak blokir absensi
                </span>
              )}
              {t.max_duration_minutes ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {t.max_duration_minutes} menit
                </span>
              ) : null}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                {t.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900 text-lg">{editItem ? 'Edit Jenis Izin' : 'Tambah Jenis Izin'}</h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                {!editItem && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Kode (unik, tanpa spasi) *</label>
                    <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/\s+/g,'_') })}
                      className="input-field text-sm font-mono" placeholder="wfh, dinas_luar..." required />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Nama Jenis Izin *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="input-field text-sm" placeholder="Work From Home, Dinas Luar..." required />
                </div>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50">
                    <input type="checkbox" checked={form.requires_attachment} onChange={e => setForm({ ...form, requires_attachment: e.target.checked })} className="rounded" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">Wajib lampiran</div>
                      <div className="text-xs text-slate-400">Karyawan harus upload foto/dokumen</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50">
                    <input type="checkbox" checked={form.deducts_quota} onChange={e => setForm({ ...form, deducts_quota: e.target.checked })} className="rounded" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">Kurangi jatah cuti</div>
                      <div className="text-xs text-slate-400">Mengurangi saldo cuti tahunan karyawan</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50">
                    <input type="checkbox" checked={form.blocks_attendance} onChange={e => setForm({ ...form, blocks_attendance: e.target.checked })} className="rounded" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">Blokir absensi</div>
                      <div className="text-xs text-slate-400">Centang jika izin ini harus memblokir check-in/check-out</div>
                    </div>
                  </label>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Durasi Maksimal (menit)</label>
                    <input type="number" value={form.max_duration_minutes || ''} onChange={e => setForm({ ...form, max_duration_minutes: e.target.value ? parseInt(e.target.value) : null })}
                      className="input-field text-sm" placeholder="Kosongkan untuk unlimited" min={1} />
                    <p className="text-xs text-slate-400 mt-1">Gunakan untuk izin seperti leave_office, tinggalkan kosong jika tidak ada batas</p>
                  </div>
                  {editItem && (
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50">
                      <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                      <div>
                        <div className="text-sm font-medium text-slate-800">Aktif</div>
                        <div className="text-xs text-slate-400">Tampilkan di form pengajuan karyawan</div>
                      </div>
                    </label>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5 text-sm">
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
