import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, CheckCircle, XCircle, AlertCircle, X, Trash2, ChevronRight, Camera, Image, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const statusConfig = {
  pending:  { label: 'Menunggu',  color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',  icon: AlertCircle },
  approved: { label: 'Disetujui', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle },
  rejected: { label: 'Ditolak',   color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     icon: XCircle },
};

const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} jam ${m} menit`;
  if (h > 0) return `${h} jam`;
  return `${m} menit`;
};

const tabs = ['Riwayat', 'Ajukan Lembur'];

export default function OvertimePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [overtimes, setOvertimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInputRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ date: today, start_time: '17:00', end_time: '19:00', reason: '' });
  const [attachment, setAttachment] = useState(null); // { file, preview }

  useEffect(() => {
    fetchData();

    const handleUpdate = () => fetchData();
    window.addEventListener('realtime-overtime', handleUpdate);

    return () => {
      window.removeEventListener('realtime-overtime', handleUpdate);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/overtime/my');
      setOvertimes(data.overtimes);
    } catch {} finally { setLoading(false); }
  };

  // Hitung durasi preview
  const calcDuration = () => {
    if (!form.start_time || !form.end_time) return null;
    const [sh, sm] = form.start_time.split(':').map(Number);
    const [eh, em] = form.end_time.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins : null;
  };
  const previewDuration = calcDuration();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Hanya file gambar yang diizinkan (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }
    const preview = URL.createObjectURL(file);
    setAttachment({ file, preview });
  };

  const removeAttachment = () => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!previewDuration)
      return toast.error('Jam selesai harus lebih dari jam mulai');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('date', form.date);
      formData.append('start_time', form.start_time);
      formData.append('end_time', form.end_time);
      formData.append('reason', form.reason);
      if (attachment?.file) formData.append('attachment', attachment.file);

      const { data } = await api.post('/overtime/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(data.message);
      setForm({ date: today, start_time: '17:00', end_time: '19:00', reason: '' });
      removeAttachment();
      setActiveTab(0);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengajukan lembur');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/overtime/${deleteTarget.id}`);
      toast.success('Pengajuan lembur dibatalkan');
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membatalkan');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 rounded-2xl p-6 text-white">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Clock size={20} />
          </div>
          <h2 className="text-xl font-bold">Lembur</h2>
        </div>
        <p className="text-slate-400 text-sm mt-1">Ajukan dan pantau status lembur kamu</p>

        {/* Ringkasan bulan ini */}
        {overtimes.length > 0 && (() => {
          const thisMonth = new Date().getMonth();
          const thisYear  = new Date().getFullYear();
          const monthData = overtimes.filter(o => {
            const d = new Date(o.date);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear && o.status === 'approved';
          });
          const totalMins = monthData.reduce((s, o) => s + o.duration_minutes, 0);
          if (!monthData.length) return null;
          return (
            <div className="mt-4 bg-white/10 border border-white/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Total lembur bulan ini</p>
                <p className="text-lg font-bold">{formatDuration(totalMins)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Sesi disetujui</p>
                <p className="text-lg font-bold">{monthData.length}x</p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-2xl p-1">
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === i ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Riwayat */}
        {activeTab === 0 && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-slate-400">Memuat data...</div>
            ) : overtimes.length === 0 ? (
              <div className="card p-10 text-center">
                <Clock size={36} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Belum ada pengajuan lembur</p>
                <p className="text-slate-400 text-sm mt-1">Tap "Ajukan Lembur" untuk membuat pengajuan baru</p>
              </div>
            ) : overtimes.map((ot) => {
              const s = statusConfig[ot.status] || { label: ot.status, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: AlertCircle };
              return (
                <motion.div key={ot.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelected(ot)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-10 h-10 ${s.bg} border ${s.border} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <s.icon size={18} className={s.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm">
                          {format(new Date(ot.date), 'EEEE, d MMMM yyyy', { locale: id })}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.color}`}>
                          {s.label}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {ot.start_time.slice(0, 5)} – {ot.end_time.slice(0, 5)} · <span className="font-medium text-slate-700">{formatDuration(ot.duration_minutes)}</span>
                      </p>
                      <p className="text-slate-600 text-sm mt-1 truncate">{ot.reason}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 flex-shrink-0 mt-1" />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Form Ajukan */}
        {activeTab === 1 && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="card p-5">
              <h3 className="font-bold text-slate-900 mb-4">Pengajuan Lembur</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Lembur</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="input-field" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Jam Mulai</label>
                    <input type="time" value={form.start_time}
                      onChange={e => setForm({ ...form, start_time: e.target.value })}
                      className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Jam Selesai</label>
                    <input type="time" value={form.end_time}
                      onChange={e => setForm({ ...form, end_time: e.target.value })}
                      className="input-field" required />
                  </div>
                </div>

                {/* Preview durasi */}
                {previewDuration ? (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <Clock size={16} className="text-slate-500" />
                    <span className="text-sm text-slate-600">Durasi lembur: </span>
                    <span className="text-sm font-bold text-slate-900">{formatDuration(previewDuration)}</span>
                  </div>
                ) : form.start_time && form.end_time ? (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <XCircle size={16} className="text-red-500" />
                    <span className="text-sm text-red-600">Jam selesai harus lebih dari jam mulai</span>
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Alasan / Pekerjaan yang Dilakukan</label>
                  <textarea value={form.reason}
                    onChange={e => setForm({ ...form, reason: e.target.value })}
                    className="input-field resize-none" rows={3}
                    placeholder="Jelaskan pekerjaan yang dikerjakan saat lembur..." required />
                </div>

                {/* Lampiran Foto */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Foto Bukti Lembur <span className="text-slate-400 font-normal">(opsional)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {!attachment ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center gap-2 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Paperclip size={18} className="text-slate-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700">Tambah foto bukti lembur</p>
                        <p className="text-xs text-slate-400 mt-0.5">Foto aktivitas kerja, layar komputer, dll. Maks 5MB</p>
                      </div>
                    </button>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200">
                      <img src={attachment.preview} alt="preview" className="w-full max-h-48 object-cover" />
                      <button
                        type="button"
                        onClick={removeAttachment}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                      >
                        <X size={14} className="text-white" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                        <p className="text-white text-xs font-medium truncate">{attachment.file.name}</p>
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={submitting || !previewDuration} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                  <Plus size={18} />
                  {submitting ? 'Mengajukan...' : 'Kirim Pengajuan Lembur'}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900 text-lg">Detail Lembur</h3>
                <div className="flex items-center gap-1">
                  {selected.status === 'pending' && (
                    <button onClick={() => { setDeleteTarget(selected); setSelected(null); }}
                      className="p-2 rounded-xl hover:bg-red-50 transition-colors" title="Batalkan">
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  )}
                  <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {[
                  { label: 'Tanggal', value: format(new Date(selected.date), 'EEEE, d MMMM yyyy', { locale: id }) },
                  { label: 'Jam Mulai', value: selected.start_time.slice(0, 5) },
                  { label: 'Jam Selesai', value: selected.end_time.slice(0, 5) },
                  { label: 'Durasi', value: formatDuration(selected.duration_minutes) },
                ].map(item => (
                  <div key={item.label} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-slate-500">{item.label}</span>
                    <span className="font-medium text-slate-900">{item.value}</span>
                  </div>
                ))}

                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">Status</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${(statusConfig[selected.status] || statusConfig.pending).bg} ${(statusConfig[selected.status] || statusConfig.pending).color}`}>
                    {(statusConfig[selected.status] || { label: selected.status }).label}
                  </span>
                </div>

                <div className="pt-1">
                  <p className="text-slate-500 mb-1">Alasan / Pekerjaan</p>
                  <p className="text-slate-900 bg-slate-50 rounded-xl p-3">{selected.reason}</p>
                </div>

                {selected.review_notes && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Catatan HRD</p>
                    <p className="text-slate-700">{selected.review_notes}</p>
                  </div>
                )}

                {selected.attachment && (
                  <div>
                    <p className="text-slate-500 text-sm mb-2">Foto Bukti Lembur</p>
                    <img
                      src={`/uploads/overtime/${selected.attachment}`}
                      alt="bukti lembur"
                      className="w-full rounded-xl object-cover border border-slate-200"
                    />
                  </div>
                )}

                {selected.reviewer_name && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Diproses oleh</span>
                    <span className="font-medium text-slate-900">{selected.reviewer_name}</span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Konfirmasi Batalkan */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center">
                  <Trash2 size={18} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Batalkan Pengajuan?</h3>
                  <p className="text-sm text-slate-500">
                    {format(new Date(deleteTarget.date), 'd MMMM yyyy', { locale: id })}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 py-2.5 text-sm">Tidak</button>
                <button onClick={handleDelete}
                  className="flex-1 py-2.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-2xl font-medium transition-colors">
                  Ya, Batalkan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



