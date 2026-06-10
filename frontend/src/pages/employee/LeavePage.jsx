import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, FileText, Upload, ChevronRight, Clock, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const tabs = ['Riwayat', 'Ajukan Izin'];

export default function LeavePage({ defaultTab = 0 }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [leaves, setLeaves] = useState([]);
  const [quota, setQuota] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);

  const [form, setForm] = useState({ type: '', start_date: '', end_date: '', time_start: '', time_end: '', reason: '', attachment: null });
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    fetchData();
    fetchLeaveTypes();

    const handleUpdate = () => fetchData();
    window.addEventListener('realtime-leave', handleUpdate);

    return () => {
      window.removeEventListener('realtime-leave', handleUpdate);
    };
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const { data } = await api.get('/leave-types/active');
      setLeaveTypes(data.leaveTypes);
      if (data.leaveTypes.length) setForm(f => ({ ...f, type: data.leaveTypes[0].code }));
    } catch {}
  };

  const fetchData = async () => {
    try {
      const [leavesRes, quotaRes] = await Promise.all([api.get('/leave/my'), api.get('/leave/quota')]);
      setLeaves(leavesRes.data.leaves);
      setQuota(quotaRes.data.quota);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedType = leaveTypes.find(t => t.code === form.type);
    if (selectedType?.requires_attachment && !form.attachment) {
      return toast.error(`Bukti foto/dokumen wajib diupload untuk ${selectedType.name}`);
    }
    if (form.type === 'late_permission' && !form.time_start) {
      return toast.error('Rencana jam masuk wajib diisi untuk izin terlambat');
    }
    if (form.type === 'early_leave' && !form.time_end) {
      return toast.error('Rencana jam pulang wajib diisi untuk izin pulang cepat');
    }
    if (form.type === 'leave_office') {
      if (!form.time_start || !form.time_end) {
        return toast.error('Jam izin keluar dan jam kembali wajib diisi untuk izin keluar kantor');
      }
      const [startH, startM] = form.time_start.split(':').map(Number);
      const [endH, endM] = form.time_end.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      if (endMinutes <= startMinutes) {
        return toast.error('Jam kembali harus lebih besar dari jam keluar kantor');
      }
      if (endMinutes - startMinutes > 120) {
        return toast.error('Izin keluar kantor maksimal 2 jam');
      }
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('type', form.type);
      formData.append('start_date', form.start_date);
      formData.append('end_date', form.end_date);
      formData.append('reason', form.reason);
      formData.append('time_start', form.time_start || '');
      formData.append('time_end', form.time_end || '');
      if (form.attachment) formData.append('attachment', form.attachment);
      const { data } = await api.post('/leave/submit', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(data.message);
      setForm({ type: leaveTypes[0]?.code || '', start_date: '', end_date: '', time_start: '', time_end: '', reason: '', attachment: null });
      setPreview(null);
      setActiveTab(0);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengajukan');
    } finally { setLoading(false); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, attachment: file });
      setPreview(URL.createObjectURL(file));
    }
  };

  const selectedType = leaveTypes.find(t => t.code === form.type);

  const statusConfig = {
    pending: { label: 'Menunggu', color: 'text-amber-600', bg: 'bg-amber-100', icon: Clock },
    approved: { label: 'Disetujui', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle },
    rejected: { label: 'Ditolak', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
  };

  const typeConfig = {
    annual:          { label: 'Cuti Tahunan',  color: 'text-blue-600',   bg: 'bg-blue-100' },
    sick:            { label: 'Izin Sakit',    color: 'text-purple-600', bg: 'bg-purple-100' },
    permission:      { label: 'Izin',          color: 'text-orange-600', bg: 'bg-orange-100' },
    wfh:             { label: 'Work From Home',color: 'text-teal-600',   bg: 'bg-teal-100' },
    dinas:           { label: 'Dinas Luar',    color: 'text-amber-600',  bg: 'bg-amber-100' },
    late_permission: { label: 'Izin Terlambat', color: 'text-amber-600',  bg: 'bg-amber-100' },
    early_leave:     { label: 'Izin Pulang Cepat', color: 'text-orange-600', bg: 'bg-orange-100' },
    leave_office:    { label: 'Izin Keluar Kantor', color: 'text-indigo-600', bg: 'bg-indigo-100' },
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 rounded-2xl p-6 text-white">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <h2 className="text-xl font-bold mb-1">Izin & Cuti</h2>
        {quota && (
          <div className="mt-3 bg-white/10 border border-white/20 rounded-xl p-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-300">Jatah Cuti {quota.year}</span>
              <span className="font-bold">{quota.remaining_days} hari tersisa</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div className="bg-white h-2 rounded-full" style={{ width: `${((quota.total_days - quota.remaining_days) / quota.total_days) * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1 text-slate-400">
              <span>Terpakai: {quota.used_days} hari</span>
              <span>Total: {quota.total_days} hari</span>
            </div>
          </div>
        )}
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
            {leaves.length === 0 ? (
              <div className="card p-8 text-center">
                <FileText size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">Belum ada pengajuan</p>
              </div>
            ) : leaves.map((leave) => {
              const s = statusConfig[leave.status] || { label: leave.status, color: 'text-slate-600', bg: 'bg-slate-100', icon: Clock };
              const t = typeConfig[leave.type] || { label: leave.type, color: 'text-slate-600', bg: 'bg-slate-100' };
              return (
                <motion.div key={leave.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedLeave(leave)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`${t.bg} ${t.color} text-xs px-2 py-0.5 rounded-full font-medium`}>{t.label}</span>
                        <span className={`${s.bg} ${s.color} text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1`}>
                          <s.icon size={10} /> {s.label}
                        </span>
                      </div>
                      <p className="text-slate-900 font-medium text-sm">{leave.reason}</p>
                      <p className="text-slate-500 text-xs mt-1">
                        {format(new Date(leave.start_date), 'd MMM', { locale: id })} - {format(new Date(leave.end_date), 'd MMM yyyy', { locale: id })} · {leave.total_days} hari
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 mt-1" />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Ajukan Izin — unified form */}
        {activeTab === 1 && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card p-5">
            <h3 className="font-bold text-slate-900 mb-4">Pengajuan Izin / Cuti</h3>
            {quota && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-700">
                📅 Sisa jatah cuti: <strong>{quota.remaining_days} hari</strong>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Jenis izin */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Jenis Izin</label>
                <div className="grid grid-cols-2 gap-2">
                  {leaveTypes.map(t => (
                    <button key={t.code} type="button" onClick={() => setForm({ ...form, type: t.code })}
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all text-left ${form.type === t.code ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                      {t.name}
                      {t.deducts_quota && <span className="text-xs opacity-60 block">Kurangi kuota</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="input-field" required min={form.start_date} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alasan / Keterangan</label>
                <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="input-field resize-none" rows={3} placeholder="Jelaskan alasan pengajuan..." required />
              </div>
              {/* Lampiran — tampil jika tipe butuh attachment */}
              {/* Time inputs — tampil untuk late_permission, early_leave, leave_office */}
              {['late_permission', 'early_leave', 'leave_office'].includes(form.type) && (
                <div className="grid grid-cols-2 gap-3">
                  {(form.type === 'late_permission' || form.type === 'leave_office') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {form.type === 'late_permission' ? 'Rencana Jam Masuk' : 'Jam Tinggalkan Kantor'}
                      </label>
                      <input type="time" value={form.time_start || ''} onChange={e => setForm({ ...form, time_start: e.target.value })}
                        className="input-field" />
                    </div>
                  )}
                  {(form.type === 'early_leave' || form.type === 'leave_office') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {form.type === 'early_leave' ? 'Rencana Jam Pulang' : 'Rencana Jam Kembali'}
                      </label>
                      <input type="time" value={form.time_end || ''} onChange={e => setForm({ ...form, time_end: e.target.value })}
                        className="input-field" />
                    </div>
                  )}
                </div>
              )}
              {form.type === 'late_permission' && (
                <p className="text-xs text-slate-500">Izin terlambat hanya boleh diajukan dengan rencana jam masuk maksimal 11:00 WIB.</p>
              )}
              {form.type === 'early_leave' && (
                <p className="text-xs text-slate-500">Izin pulang cepat hanya boleh diajukan dengan rencana jam pulang minimal 13:00 WIB.</p>
              )}
              {form.type === 'leave_office' && (
                <p className="text-xs text-slate-500">Izin keluar kantor maksimal 2 jam. Pastikan jam kembali lebih dari jam keluar.</p>
              )}

              {selectedType?.requires_attachment && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bukti / Lampiran <span className="text-red-500">*</span>
                  </label>
                  {preview ? (
                    <div className="relative">
                      <img src={preview} alt="preview" className="w-full h-48 object-cover rounded-xl" />
                      <button type="button" onClick={() => { setPreview(null); setForm({ ...form, attachment: null }); }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-slate-500 hover:bg-slate-50 transition-colors">
                      <Upload size={24} className="text-slate-400 mb-2" />
                      <span className="text-slate-500 text-sm">Tap untuk upload foto/dokumen</span>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  )}
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Mengajukan...' : 'Kirim Pengajuan'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedLeave && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedLeave(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Detail Pengajuan</h3>
                <button onClick={() => setSelectedLeave(null)} className="p-2 rounded-xl hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Jenis</span>
                  <span className="font-medium">{(typeConfig[selectedLeave.type] || { label: selectedLeave.type }).label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal</span>
                  <span className="font-medium">
                    {format(new Date(selectedLeave.start_date), 'd MMM', { locale: id })} - {format(new Date(selectedLeave.end_date), 'd MMM yyyy', { locale: id })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Durasi</span>
                  <span className="font-medium">{selectedLeave.total_days} hari kerja</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={`${statusConfig[selectedLeave.status]?.bg} ${statusConfig[selectedLeave.status]?.color} px-2 py-0.5 rounded-full text-sm font-medium`}>
                    {statusConfig[selectedLeave.status]?.label}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-sm">Alasan</span>
                  <p className="text-slate-900 mt-1">{selectedLeave.reason}</p>
                </div>
                {selectedLeave.review_notes && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="text-slate-500 text-sm">Catatan HRD</span>
                    <p className="text-slate-900 mt-1 text-sm">{selectedLeave.review_notes}</p>
                  </div>
                )}
                {selectedLeave.attachment && (
                  <img src={`/uploads/sick/${selectedLeave.attachment}`} alt="bukti" className="w-full rounded-xl" />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}




