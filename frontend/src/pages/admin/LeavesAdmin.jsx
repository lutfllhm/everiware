import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle, XCircle, Eye, X, Trash2, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import UserAvatar from '../../components/ui/UserAvatar';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/ui/Pagination';
import { ZoomableImage } from '../../components/ui/ImageLightbox';

const statusConfig = {
  pending:  { label: 'Menunggu', cls: 'badge-warning' },
  approved: { label: 'Disetujui', cls: 'badge-success' },
  rejected: { label: 'Ditolak', cls: 'badge-danger' },
};

const typeConfig = {
  annual:          { label: 'Cuti Tahunan', cls: 'badge-info' },
  sick:            { label: 'Izin Sakit', cls: 'badge-purple' },
  permission:      { label: 'Izin', cls: 'badge-warning' },
  wfh:             { label: 'WFH', cls: 'badge-success' },
  dinas:           { label: 'Dinas Luar', cls: 'badge-warning' },
  late_permission: { label: 'Izin Terlambat', cls: 'badge-warning' },
  early_leave:     { label: 'Izin Pulang Cepat', cls: 'badge-warning' },
  leave_office:    { label: 'Izin Keluar Kantor', cls: 'badge-purple' },
};

export default function LeavesAdmin() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', type: '', search: '' });
  const [selected, setSelected] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [checkedIds, setCheckedIds] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  useEffect(() => {
    fetchData();

    const handleUpdate = () => fetchData();
    window.addEventListener('realtime-leave', handleUpdate);

    return () => {
      window.removeEventListener('realtime-leave', handleUpdate);
    };
  }, [filters.status, filters.type]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      const { data } = await api.get(`/leave/all?${params}`);
      setLeaves(data.leaves || []);
    } catch (err) {
      console.error('fetchData error:', err.response?.data || err.message);
      toast.error('Gagal memuat data perizinan', { id: 'leaves-fetch-error' });
    } finally { setLoading(false); }
  };

  const handleReview = async (status) => {
    setReviewing(true);
    try {
      await api.put(`/leave/review/${selected.id}`, { status, review_notes: reviewNotes });
      toast.success(status === 'approved' ? '✅ Pengajuan disetujui' : '❌ Pengajuan ditolak');
      setSelected(null);
      setReviewNotes('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses');
    } finally { setReviewing(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/leave/${deleteTarget.id}`);
      toast.success('Pengajuan berhasil dihapus');
      setDeleteTarget(null);
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus');
    } finally { setDeleting(false); }
  };

  const filtered = leaves.filter(l =>
    !filters.search || l.user_name?.toLowerCase().includes(filters.search.toLowerCase())
  );

  const pendingFiltered = filtered.filter(l => l.status === 'pending');
  const allPendingChecked = pendingFiltered.length > 0 && pendingFiltered.every(l => checkedIds.includes(l.id));

  const toggleCheck = (id) => setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setCheckedIds(allPendingChecked ? [] : pendingFiltered.map(l => l.id));

  const pagination = usePagination(filtered, 25);

  const handleBulkAction = async (status) => {
    if (!checkedIds.length) return;
    setBulkProcessing(true);
    let success = 0;
    for (const id of checkedIds) {
      try { await api.put(`/leave/review/${id}`, { status, review_notes: '' }); success++; } catch {}
    }
    toast.success(`${success} pengajuan berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}`);
    setCheckedIds([]);
    fetchData();
    setBulkProcessing(false);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Cari nama karyawan..." value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-field pl-9 py-2.5 text-sm" />
          </div>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input-field py-2.5 text-sm w-auto">
            <option value="">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="input-field py-2.5 text-sm w-auto">
            <option value="">Semua Jenis</option>
            <option value="annual">Cuti Tahunan</option>
            <option value="sick">Izin Sakit</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: leaves.filter(l => l.status === 'pending').length, iconCls: 'bg-amber-100 text-amber-600', borderCls: 'border-amber-200' },
          { label: 'Disetujui', value: leaves.filter(l => l.status === 'approved').length, iconCls: 'bg-teal-100 text-teal-600', borderCls: 'border-teal-200' },
          { label: 'Ditolak', value: leaves.filter(l => l.status === 'rejected').length, iconCls: 'bg-red-100 text-red-600', borderCls: 'border-red-200' },
        ].map(s => (
          <div key={s.label} className={`bg-white border ${s.borderCls} rounded-xl p-4 flex items-center gap-3 shadow-sm`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconCls}`}>
              <span className="text-sm font-bold">{s.value}</span>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 leading-none">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk action bar */}
      {checkedIds.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="card p-3 flex items-center gap-3 bg-slate-900 text-white">
          <span className="text-sm font-medium">{checkedIds.length} dipilih</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => handleBulkAction('approved')} disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors disabled:opacity-50">
              <CheckCircle size={13} /> Setujui Semua
            </button>
            <button onClick={() => handleBulkAction('rejected')} disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors disabled:opacity-50">
              <XCircle size={13} /> Tolak Semua
            </button>
            <button onClick={() => setCheckedIds([])} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors">
              Batal
            </button>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['', 'Karyawan', 'Jenis', 'Tanggal', 'Durasi', 'Alasan', 'Status', 'Aksi'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h === '' ? (
                      <button onClick={toggleAll} className="text-slate-400 hover:text-slate-700">
                        {allPendingChecked ? <CheckSquare size={15} /> : <Square size={15} />}
                      </button>
                    ) : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Tidak ada data</td></tr>
              ) : pagination.paged.map((leave) => (
                <tr key={leave.id} className={`hover:bg-slate-50 transition-colors ${checkedIds.includes(leave.id) ? 'bg-slate-50' : ''}`}>
                  <td className="px-4 py-3">
                    {leave.status === 'pending' && (
                      <button onClick={() => toggleCheck(leave.id)} className="text-slate-400 hover:text-slate-700">
                        {checkedIds.includes(leave.id) ? <CheckSquare size={15} className="text-slate-900" /> : <Square size={15} />}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={leave.user_name} avatar={leave.user_avatar} size="md" />
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{leave.user_name}</div>
                        <div className="text-xs text-slate-500">{[leave.department, leave.position].filter(Boolean).join(' · ') || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={(typeConfig[leave.type] || { cls: 'badge-info', label: leave.type }).cls}>{(typeConfig[leave.type] || { label: leave.type }).label}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {format(new Date(leave.start_date), 'd MMM', { locale: id })} - {format(new Date(leave.end_date), 'd MMM yyyy', { locale: id })}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium">{leave.total_days} hari</td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{leave.reason}</td>
                  <td className="px-4 py-3"><span className={statusConfig[leave.status]?.cls}>{statusConfig[leave.status]?.label}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setSelected(leave); setReviewNotes(''); }} title="Detail"
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                        <Eye size={15} className="text-slate-500" />
                      </button>
                      <button onClick={() => setDeleteTarget(leave)} title="Hapus"
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={15} className="text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </div>

      {/* Detail / Review Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Detail Pengajuan</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setDeleteTarget(selected); setSelected(null); }}
                    className="p-2 rounded-xl hover:bg-red-50 transition-colors" title="Hapus">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 text-sm mb-4">
                {[
                  { label: 'Karyawan', value: selected.user_name },
                  { label: 'Departemen', value: [selected.department, selected.position].filter(Boolean).join(' · ') || '-' },
                  { label: 'Jenis', value: (typeConfig[selected.type] || { label: selected.type }).label, badge: (typeConfig[selected.type] || { cls: 'badge-info' }).cls },
                  { label: 'Tanggal', value: `${format(new Date(selected.start_date), 'd MMM', { locale: id })} - ${format(new Date(selected.end_date), 'd MMM yyyy', { locale: id })}` },
                  { label: 'Durasi', value: `${selected.total_days} hari kerja` },
                  { label: 'Status', value: statusConfig[selected.status]?.label, badge: statusConfig[selected.status]?.cls },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-500">{item.label}</span>
                    {item.badge
                      ? <span className={item.badge}>{item.value}</span>
                      : <span className="font-medium text-slate-900">{item.value}</span>
                    }
                  </div>
                ))}
                <div>
                  <span className="text-slate-500">Alasan</span>
                  <p className="text-slate-900 mt-1 bg-slate-50 rounded-xl p-3 text-sm">{selected.reason}</p>
                </div>
              </div>

              {selected.attachment && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Bukti Foto</p>
                  <ZoomableImage src={`/uploads/sick/${selected.attachment}`} alt="bukti" className="w-full rounded-xl" />
                </div>
              )}

              {selected.review_notes && (
                <div className="mb-4 bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">Catatan HRD</p>
                  <p className="text-sm text-slate-700">{selected.review_notes}</p>
                </div>
              )}

              {selected.status === 'pending' && (
                <>
                  <div className="mb-4">
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Catatan (opsional)</label>
                    <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
                      className="input-field resize-none text-sm" rows={2}
                      placeholder="Tambahkan catatan untuk karyawan..." />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleReview('rejected')} disabled={reviewing}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition-colors disabled:opacity-50">
                      <XCircle size={18} /> Tolak
                    </button>
                    <button onClick={() => handleReview('approved')} disabled={reviewing}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50">
                      <CheckCircle size={18} /> {reviewing ? 'Memproses...' : 'Setujui'}
                    </button>
                  </div>
                </>
              )}
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
              className="bg-white rounded-3xl p-6 w-full max-w-sm"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={22} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Hapus Pengajuan?</h3>
                  <p className="text-slate-500 text-sm">Tindakan ini tidak bisa dibatalkan</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 mb-5 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Karyawan</span>
                  <span className="font-medium text-slate-900">{deleteTarget.user_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jenis</span>
                  <span className={(typeConfig[deleteTarget.type] || { cls: 'badge-info' }).cls}>{(typeConfig[deleteTarget.type] || { label: deleteTarget.type }).label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal</span>
                  <span className="font-medium text-slate-900">
                    {format(new Date(deleteTarget.start_date), 'd MMM', { locale: id })} - {format(new Date(deleteTarget.end_date), 'd MMM yyyy', { locale: id })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={statusConfig[deleteTarget.status]?.cls}>{statusConfig[deleteTarget.status]?.label}</span>
                </div>
                {deleteTarget.status === 'approved' && deleteTarget.type === 'annual' && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <p className="text-amber-600 text-xs">⚠️ Jatah cuti yang sudah terpakai akan dikembalikan otomatis</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 py-2.5 text-sm">
                  Batal
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {deleting ? 'Menghapus...' : <><Trash2 size={15} /> Hapus</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
