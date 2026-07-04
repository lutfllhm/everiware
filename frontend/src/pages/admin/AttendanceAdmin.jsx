import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Eye, X, Trash2, AlertTriangle, Edit, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import UserAvatar from '../../components/ui/UserAvatar';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/ui/Pagination';
import { ZoomableImage } from '../../components/ui/ImageLightbox';

export default function AttendanceAdmin() {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), search: '' });
  const [selected, setSelected] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ check_in: '', check_out: '', status: '', notes: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detailEmployee, setDetailEmployee] = useState(null);

  useEffect(() => {
    fetchData();

    const handleUpdate = () => fetchData();
    window.addEventListener('realtime-attendance', handleUpdate);

    return () => {
      window.removeEventListener('realtime-attendance', handleUpdate);
    };
  }, [filters.month, filters.year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/attendance/all?month=${filters.month}&year=${filters.year}&limit=100`);
      setAttendances(data.attendances);
    } catch {} finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/attendance/${deleteTarget.id}`);
      toast.success('Data absensi berhasil dihapus');
      setDeleteTarget(null);
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus data');
    } finally { setDeleting(false); }
  };

  const openEdit = (att) => {
    setEditTarget(att);
    setEditForm({
      check_in:  att.check_in  ? format(new Date(att.check_in),  'HH:mm') : '',
      check_out: att.check_out ? format(new Date(att.check_out), 'HH:mm') : '',
      status: att.status,
      notes: att.notes || '',
    });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      await api.put(`/attendance/${editTarget.id}`, editForm);
      toast.success('Data absensi berhasil diperbarui');
      setEditTarget(null);
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui data');
    } finally { setEditSaving(false); }
  };

  const filtered = attendances.filter(a =>
    !filters.search || a.user_name?.toLowerCase().includes(filters.search.toLowerCase()) || a.employee_id?.includes(filters.search)
  );

  const grouped = Object.values(
    filtered.reduce((acc, a) => {
      const key = a.employee_id || a.user_name;
      if (!acc[key]) acc[key] = { key, user_name: a.user_name, user_avatar: a.user_avatar, employee_id: a.employee_id, department: a.department, position: a.position, records: [] };
      acc[key].records.push(a);
      return acc;
    }, {})
  ).sort((a, b) => (a.user_name || '').localeCompare(b.user_name || ''));

  const pagination = usePagination(grouped, 25);
  const detailPagination = usePagination(detailEmployee?.records || [], 10);

  // Sinkronkan modal detail karyawan dengan data terbaru setelah edit/hapus
  useEffect(() => {
    if (!detailEmployee) return;
    const fresh = grouped.find(g => g.key === detailEmployee.key);
    if (fresh !== detailEmployee) setDetailEmployee(fresh || null);
  }, [grouped]);

  const statusConfig = {
    present: { label: 'Hadir', cls: 'badge-success' },
    late:    { label: 'Terlambat', cls: 'badge-warning' },
    absent:  { label: 'Absen', cls: 'badge-danger' },
    leave:   { label: 'Cuti', cls: 'badge-info' },
    sick:    { label: 'Sakit', cls: 'badge-purple' },
  };

  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Cari nama atau ID karyawan..." value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-field pl-9 py-2.5 text-sm" />
          </div>
          <select value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            className="input-field py-2.5 text-sm w-auto">
            {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            className="input-field py-2.5 text-sm w-auto">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: filtered.length, iconCls: 'bg-slate-100 text-slate-600', borderCls: 'border-slate-200' },
          { label: 'Hadir', value: filtered.filter(a => a.status === 'present').length, iconCls: 'bg-teal-100 text-teal-600', borderCls: 'border-teal-200' },
          { label: 'Terlambat', value: filtered.filter(a => a.status === 'late').length, iconCls: 'bg-amber-100 text-amber-600', borderCls: 'border-amber-200' },
          { label: 'Cuti', value: filtered.filter(a => a.status === 'leave').length, iconCls: 'bg-sky-100 text-sky-600', borderCls: 'border-sky-200' },
          { label: 'Sakit', value: filtered.filter(a => a.status === 'sick').length, iconCls: 'bg-purple-100 text-purple-600', borderCls: 'border-purple-200' },
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

      {/* Grouped per karyawan (accordion) */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Memuat data...</div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-8 text-slate-400">Tidak ada data</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pagination.paged.map((grp) => {
              const counts = {
                present: grp.records.filter(r => r.status === 'present').length,
                late: grp.records.filter(r => r.status === 'late').length,
                absent: grp.records.filter(r => r.status === 'absent').length,
                leave: grp.records.filter(r => r.status === 'leave').length,
                sick: grp.records.filter(r => r.status === 'sick').length,
              };
              return (
                <button key={grp.key} onClick={() => setDetailEmployee(grp)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar name={grp.user_name} avatar={grp.user_avatar} size="md" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 text-sm">{grp.user_name}</div>
                      <div className="text-xs text-slate-500 truncate">{grp.employee_id ? `${grp.employee_id}${grp.department ? ' · ' + grp.department : ''}${grp.position ? ' · ' + grp.position : ''}` : [grp.department, grp.position].filter(Boolean).join(' · ') || '-'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="hidden sm:flex items-center gap-2 text-xs">
                      <span className="badge-success">{counts.present} Hadir</span>
                      <span className="badge-warning">{counts.late} Terlambat</span>
                      {counts.absent > 0 && <span className="badge-danger">{counts.absent} Absen</span>}
                      {counts.leave > 0 && <span className="badge-info">{counts.leave} Cuti</span>}
                      {counts.sick > 0 && <span className="badge-purple">{counts.sick} Sakit</span>}
                    </div>
                    <span className="text-xs text-slate-400">{grp.records.length} hari</span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <Pagination {...pagination} />
      </div>

      {/* Modal Detail Absensi per Karyawan */}
      <AnimatePresence>
        {detailEmployee && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setDetailEmployee(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 p-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={detailEmployee.user_name} avatar={detailEmployee.user_avatar} size="md" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{detailEmployee.user_name}</h3>
                    <p className="text-xs text-slate-500 truncate">
                      {detailEmployee.employee_id ? `${detailEmployee.employee_id}${detailEmployee.department ? ' · ' + detailEmployee.department : ''}${detailEmployee.position ? ' · ' + detailEmployee.position : ''}` : [detailEmployee.department, detailEmployee.position].filter(Boolean).join(' · ') || '-'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setDetailEmployee(null)} className="p-2 rounded-xl hover:bg-slate-100 flex-shrink-0">
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {['Tanggal', 'Masuk', 'Pulang', 'Lokasi', 'Status', 'Aksi'].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide sticky top-0 bg-white">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailPagination.paged.map((att) => {
                        const s = statusConfig[att.status] || statusConfig.present;
                        return (
                          <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 text-sm text-slate-600">{format(new Date(att.date), 'dd MMM yyyy', { locale: id })}</td>
                            <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{att.check_in ? format(new Date(att.check_in), 'HH:mm') : '-'}</td>
                            <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{att.check_out ? format(new Date(att.check_out), 'HH:mm') : '-'}</td>
                            <td className="px-4 py-2.5 text-sm text-slate-500">{att.location_name || '-'}</td>
                            <td className="px-4 py-2.5"><span className={s.cls}>{s.label}</span></td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <button onClick={() => setSelected(att)} title="Detail"
                                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                  <Eye size={15} className="text-slate-500" />
                                </button>
                                <button onClick={() => openEdit(att)} title="Edit"
                                  className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors">
                                  <Edit size={15} className="text-blue-500" />
                                </button>
                                <button onClick={() => setDeleteTarget(att)} title="Hapus"
                                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 size={15} className="text-red-500" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination {...detailPagination} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Detail Absensi</h3>
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
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Karyawan', value: selected.user_name },
                  { label: 'ID Karyawan', value: selected.employee_id || '-' },
                  { label: 'Departemen', value: [selected.department, selected.position].filter(Boolean).join(' · ') || '-' },
                  { label: 'Tanggal', value: format(new Date(selected.date), 'dd MMMM yyyy', { locale: id }) },
                  { label: 'Jam Masuk', value: selected.check_in ? format(new Date(selected.check_in), 'HH:mm:ss') : '-' },
                  { label: 'Jam Pulang', value: selected.check_out ? format(new Date(selected.check_out), 'HH:mm:ss') : '-' },
                  { label: 'Lokasi', value: selected.location_name || '-' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-500">{item.label}</span>
                    <span className="font-medium text-slate-900">{item.value}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Status</span>
                  <span className={statusConfig[selected.status]?.cls}>{statusConfig[selected.status]?.label}</span>
                </div>
              </div>
              {selected.check_in_photo && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Foto Masuk</p>
                  <ZoomableImage src={`/uploads/selfie/${selected.check_in_photo}`} alt="selfie masuk"
                    className="w-full rounded-xl object-cover" />
                </div>
              )}
              {selected.check_out_photo && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Foto Pulang</p>
                  <ZoomableImage src={`/uploads/selfie/${selected.check_out_photo}`} alt="selfie pulang"
                    className="w-full rounded-xl object-cover" />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Edit Absensi */}
      <AnimatePresence>
        {editTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setEditTarget(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Edit Absensi</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {editTarget.user_name} · {format(new Date(editTarget.date), 'dd MMM yyyy', { locale: id })}
                  </p>
                </div>
                <button onClick={() => setEditTarget(null)} className="p-2 rounded-xl hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Jam Masuk</label>
                    <input type="time" value={editForm.check_in}
                      onChange={e => setEditForm({ ...editForm, check_in: e.target.value })}
                      className="input-field py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Jam Pulang</label>
                    <input type="time" value={editForm.check_out}
                      onChange={e => setEditForm({ ...editForm, check_out: e.target.value })}
                      className="input-field py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                  <select value={editForm.status}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                    className="input-field py-2 text-sm">
                    <option value="present">Hadir</option>
                    <option value="late">Terlambat</option>
                    <option value="absent">Absen</option>
                    <option value="leave">Cuti</option>
                    <option value="sick">Sakit</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Catatan (opsional)</label>
                  <textarea value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                    className="input-field resize-none text-sm" rows={2}
                    placeholder="Catatan admin..." />
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                  ⚠️ Perubahan jam masuk akan otomatis menghitung ulang status Hadir/Terlambat
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" disabled={editSaving} className="btn-primary flex-1 py-2.5 text-sm">
                    {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
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
              className="bg-white rounded-3xl p-6 w-full max-w-sm"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={22} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Hapus Data Absensi?</h3>
                  <p className="text-slate-500 text-sm">Tindakan ini tidak bisa dibatalkan</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 mb-5 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Karyawan</span>
                  <span className="font-medium text-slate-900">{deleteTarget.user_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal</span>
                  <span className="font-medium text-slate-900">{format(new Date(deleteTarget.date), 'dd MMM yyyy', { locale: id })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={statusConfig[deleteTarget.status]?.cls}>{statusConfig[deleteTarget.status]?.label}</span>
                </div>
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
