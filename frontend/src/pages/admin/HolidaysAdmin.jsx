import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, X, Calendar, AlertTriangle, Upload, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import useAuthStore from '../../store/authStore';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// Hari libur default Indonesia untuk import cepat
const PRESET_2026 = [
  { date: '2026-01-01', name: 'Tahun Baru Masehi' },
  { date: '2026-01-16', name: 'Isra Miraj Nabi Muhammad SAW' },
  { date: '2026-01-28', name: 'Tahun Baru Imlek' },
  { date: '2026-03-17', name: 'Hari Raya Idul Fitri 1447 H' },
  { date: '2026-03-18', name: 'Hari Raya Idul Fitri 1447 H (Hari Kedua)' },
  { date: '2026-03-16', name: 'Cuti Bersama Idul Fitri' },
  { date: '2026-03-19', name: 'Hari Suci Nyepi / Cuti Bersama Idul Fitri' },
  { date: '2026-03-20', name: 'Wafat Isa Al Masih / Cuti Bersama Idul Fitri' },
  { date: '2026-04-05', name: 'Paskah' },
  { date: '2026-05-01', name: 'Hari Buruh Internasional' },
  { date: '2026-05-14', name: 'Kenaikan Isa Al Masih' },
  { date: '2026-05-27', name: 'Hari Raya Idul Adha 1447 H' },
  { date: '2026-05-31', name: 'Hari Raya Waisak' },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila' },
  { date: '2026-06-17', name: 'Tahun Baru Islam 1448 H' },
  { date: '2026-08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
  { date: '2026-08-25', name: 'Maulid Nabi Muhammad SAW' },
  { date: '2026-12-25', name: 'Hari Raya Natal' },
];

export default function HolidaysAdmin() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [modal, setModal] = useState(null); // null | 'add' | holiday object
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ date: '', name: '', description: '' });
  const [expandedMonths, setExpandedMonths] = useState({});
  const { user } = useAuthStore();
  const canEdit = user?.role !== 'hrd';

  useEffect(() => { fetchHolidays(); }, [yearFilter]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/holidays?year=${yearFilter}`);
      setHolidays(data.holidays);
    } catch {} finally { setLoading(false); }
  };

  const openAdd = () => {
    setForm({ date: `${yearFilter}-01-01`, name: '', description: '' });
    setModal('add');
  };

  const openEdit = (h) => {
    setForm({ date: h.date.split('T')[0], name: h.name, description: h.description || '' });
    setModal(h);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'add') {
        await api.post('/holidays', form);
        toast.success('Hari libur berhasil ditambahkan');
      } else {
        await api.put(`/holidays/${modal.id}`, form);
        toast.success('Hari libur berhasil diperbarui');
      }
      setModal(null);
      fetchHolidays();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/holidays/${deleteTarget.id}`);
      toast.success('Hari libur berhasil dihapus');
      setDeleteTarget(null);
      fetchHolidays();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus');
    }
  };

  const handleImportPreset = async () => {
    if (!confirm(`Import ${PRESET_2026.length} hari libur nasional 2026? Data duplikat akan dilewati.`)) return;
    try {
      const { data } = await api.post('/holidays/bulk', { holidays: PRESET_2026 });
      toast.success(data.message);
      setYearFilter(2026);
      fetchHolidays();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal import');
    }
  };

  // Kelompokkan per bulan
  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    month: i,
    label: MONTHS[i],
    items: holidays.filter(h => new Date(h.date).getMonth() === i),
  })).filter(m => m.items.length > 0);

  const toggleMonth = (m) => setExpandedMonths(p => ({ ...p, [m]: !p[m] }));

  const getDayName = (dateStr) => {
    const d = new Date(dateStr);
    return format(d, 'EEEE', { locale: id });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select value={yearFilter} onChange={e => setYearFilter(+e.target.value)}
            className="input-field py-2 text-sm w-auto">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-slate-500 text-sm">{holidays.length} hari libur</span>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={handleImportPreset}
              className="btn-secondary py-2 flex items-center gap-2 text-sm">
              <Upload size={15} /> Import Preset 2026
            </button>
          )}
          {canEdit && (
            <button onClick={openAdd} className="btn-primary py-2 flex items-center gap-2 text-sm">
              <Plus size={15} /> Tambah Hari Libur
            </button>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">📅 Kalender Hari Libur Nasional Indonesia</p>
        <p className="text-blue-600 text-xs leading-relaxed">
          Hari libur yang terdaftar di sini akan otomatis di-skip saat menghitung hari kerja untuk pengajuan cuti/izin.
          Hari Sabtu dan Minggu sudah otomatis di-skip tanpa perlu didaftarkan.
        </p>
      </div>

      {/* List per bulan */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">Memuat data...</div>
      ) : holidays.length === 0 ? (
        <div className="card p-10 text-center">
          <Calendar size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Belum ada hari libur untuk tahun {yearFilter}</p>
          <p className="text-slate-400 text-sm mt-1">Tambah manual atau gunakan tombol Import Preset</p>
        </div>
      ) : (
        <div className="space-y-2">
          {byMonth.map(({ month, label, items }) => (
            <div key={month} className="card overflow-hidden">
              <button onClick={() => toggleMonth(month)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-600">{String(month + 1).padStart(2, '0')}</span>
                  </div>
                  <span className="font-semibold text-slate-900">{label}</span>
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{items.length} hari</span>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${expandedMonths[month] ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {expandedMonths[month] && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-100">
                    <div className="divide-y divide-slate-50">
                      {items.map(h => (
                        <div key={h.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-slate-50">
                          <div className="w-12 text-center flex-shrink-0">
                            <div className="text-lg font-bold text-slate-800 leading-none">
                              {new Date(h.date).getDate()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase">
                              {getDayName(h.date).slice(0, 3)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">{h.name}</p>
                            {h.description && <p className="text-xs text-slate-400 truncate">{h.description}</p>}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEdit && (
                              <button onClick={() => openEdit(h)}
                                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                                <Edit size={13} className="text-slate-500" />
                              </button>
                            )}
                            {canEdit && (
                              <button onClick={() => setDeleteTarget(h)}
                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={13} className="text-red-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah/Edit */}
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900 text-lg">
                  {modal === 'add' ? 'Tambah Hari Libur' : 'Edit Hari Libur'}
                </h3>
                <button onClick={() => setModal(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Tanggal *</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="input-field" required />
                  {form.date && (
                    <p className="text-xs text-slate-400 mt-1">
                      {format(new Date(form.date), 'EEEE, d MMMM yyyy', { locale: id })}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Nama Hari Libur *</label>
                  <input value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="input-field" required
                    placeholder="Contoh: Hari Raya Idul Fitri" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Keterangan</label>
                  <input value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="input-field" placeholder="Opsional" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">
                    {modal === 'add' ? 'Tambah' : 'Simpan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Konfirmasi Hapus */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Hapus Hari Libur?</h3>
                  <p className="text-sm text-slate-500">{deleteTarget.name}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                <button onClick={handleDelete}
                  className="flex-1 py-2.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-2xl font-medium transition-colors">
                  Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
