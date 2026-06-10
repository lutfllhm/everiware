import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle, XCircle, Eye, X, Trash2, AlertTriangle, Clock, BarChart2, CalendarRange, CalendarDays, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import UserAvatar from '../../components/ui/UserAvatar';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/ui/Pagination';
import { ZoomableImage } from '../../components/ui/ImageLightbox';

const statusConfig = {
  pending:  { label: 'Menunggu',  cls: 'badge-warning' },
  approved: { label: 'Disetujui', cls: 'badge-success' },
  rejected: { label: 'Ditolak',   cls: 'badge-danger' },
};

const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}j ${m}m`;
  if (h > 0) return `${h} jam`;
  return `${m} menit`;
};

const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const buildParams = (filterMode, filters) => {
  if (filterMode === 'range') return `start_date=${filters.start_date}&end_date=${filters.end_date}`;
  const p = new URLSearchParams();
  if (filters.status) p.append('status', filters.status);
  if (filters.month)  p.append('month', filters.month);
  if (filters.year)   p.append('year', filters.year);
  return p.toString();
};

export default function OvertimeAdmin() {
  const [overtimes, setOvertimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState('month');
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [selected, setSelected] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeView, setActiveView] = useState('list');
  const [report, setReport] = useState({ report: [], summary: [], rate_per_hour: 0 });

  const rangeValid = filterMode === 'month' || (filters.start_date && filters.end_date && filters.start_date <= filters.end_date);

  useEffect(() => {
    if (rangeValid) fetchData();

    const handleUpdate = () => {
      if (rangeValid) fetchData();
    };
    window.addEventListener('realtime-overtime', handleUpdate);

    return () => {
      window.removeEventListener('realtime-overtime', handleUpdate);
    };
  }, [filters.status, filters.month, filters.year, filters.start_date, filters.end_date, filterMode, rangeValid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = buildParams(filterMode, filters);
      const { data } = await api.get(`/overtime/all?${q}`);
      setOvertimes(data.overtimes || []);
    } catch { toast.error('Gagal memuat data lembur'); }
    finally { setLoading(false); }
  };

  const fetchReport = async () => {
    try {
      const q = filterMode === 'range'
        ? `start_date=${filters.start_date}&end_date=${filters.end_date}`
        : `month=${filters.month}&year=${filters.year}`;
      const { data } = await api.get(`/overtime/report?${q}`);
      setReport({ report: data.report || [], summary: data.summary || [], rate_per_hour: data.rate_per_hour || 0 });
    } catch {}
  };

  useEffect(() => {
    if (activeView === 'report' && rangeValid) fetchReport();
  }, [activeView, filters.month, filters.year, filters.start_date, filters.end_date, filterMode]);

  const handleReview = async (status) => {
    setReviewing(true);
    try {
      await api.put(`/overtime/review/${selected.id}`, { status, review_notes: reviewNotes });
      toast.success(status === 'approved' ? '✅ Lembur disetujui' : '❌ Lembur ditolak');
      setSelected(null);
      setReviewNotes('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses');
    } finally { setReviewing(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/overtime/${deleteTarget.id}`);
      toast.success('Pengajuan lembur dihapus');
      setDeleteTarget(null);
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus');
    }
  };

  const filtered = overtimes.filter(o =>
    !filters.search || o.user_name?.toLowerCase().includes(filters.search.toLowerCase())
  );

  const pagination = usePagination(filtered, 25);

  const pendingCount  = overtimes.filter(o => o.status === 'pending').length;
  const approvedCount = overtimes.filter(o => o.status === 'approved').length;
  const rejectedCount = overtimes.filter(o => o.status === 'rejected').length;
  const totalApprovedMins = overtimes.filter(o => o.status === 'approved').reduce((s, o) => s + o.duration_minutes, 0);

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex bg-slate-100 rounded-2xl p-1 w-fit">
        {[{ key: 'list', label: 'Daftar Pengajuan' }, { key: 'report', label: 'Rekap Lembur' }].map(v => (
          <button key={v.key} onClick={() => setActiveView(v.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeView === v.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        {/* Toggle mode */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter Periode</span>
          <div className="flex bg-slate-100 rounded-xl p-0.5 ml-2">
            <button onClick={() => setFilterMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterMode === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <CalendarDays size={13} /> Bulan
            </button>
            <button onClick={() => setFilterMode('range')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterMode === 'range' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <CalendarRange size={13} /> Rentang Tanggal
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {activeView === 'list' && (
            <div className="relative min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Cari nama karyawan..." value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
                className="input-field pl-9 py-2.5 text-sm" />
            </div>
          )}
          {activeView === 'list' && (
            <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
              className="input-field py-2.5 text-sm w-auto">
              <option value="">Semua Status</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
          )}

          {filterMode === 'month' ? (
            <>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Bulan</label>
                <select value={filters.month} onChange={e => setFilters({ ...filters, month: +e.target.value })}
                  className="input-field py-2 text-sm w-auto">
                  {monthNames.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tahun</label>
                <select value={filters.year} onChange={e => setFilters({ ...filters, year: +e.target.value })}
                  className="input-field py-2 text-sm w-auto">
                  {[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Dari Tanggal</label>
                <input type="date" value={filters.start_date}
                  onChange={e => setFilters({ ...filters, start_date: e.target.value })}
                  className="input-field py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Sampai Tanggal</label>
                <input type="date" value={filters.end_date}
                  min={filters.start_date}
                  onChange={e => setFilters({ ...filters, end_date: e.target.value })}
                  className="input-field py-2 text-sm" />
              </div>
              {!rangeValid && (
                <p className="text-xs text-red-500 self-end pb-2">Tanggal akhir harus ≥ tanggal awal</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending',   value: pendingCount,  sub: 'pengajuan',  color: 'bg-amber-50 border-amber-200',   text: 'text-amber-700' },
          { label: 'Disetujui', value: approvedCount, sub: 'pengajuan',  color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
          { label: 'Ditolak',   value: rejectedCount, sub: 'pengajuan',  color: 'bg-red-50 border-red-200',        text: 'text-red-700' },
          { label: 'Total Jam', value: formatDuration(totalApprovedMins), sub: 'disetujui', color: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.color}`}>
            <div className={`text-xl font-bold ${s.text}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label} · {s.sub}</div>
          </div>
        ))}
      </div>

      {/* LIST VIEW */}
      {activeView === 'list' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Karyawan', 'Tanggal', 'Jam', 'Durasi', 'Alasan', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">Memuat data...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">Tidak ada data</td></tr>
                ) : pagination.paged.map(ot => (
                  <tr key={ot.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={ot.user_name} avatar={ot.user_avatar} size="md" />
                        <div>
                          <div className="font-medium text-slate-900 text-sm">{ot.user_name}</div>
                          <div className="text-xs text-slate-500">{[ot.department, ot.position].filter(Boolean).join(' · ') || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {format(new Date(ot.date), 'd MMM yyyy', { locale: id })}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {ot.start_time.slice(0, 5)} – {ot.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-900">{formatDuration(ot.duration_minutes)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{ot.reason}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={statusConfig[ot.status]?.cls}>{statusConfig[ot.status]?.label}</span>
                        {ot.attachment && (
                          <span title="Ada foto bukti" className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center">
                            <Image size={11} className="text-slate-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelected(ot); setReviewNotes(''); }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Detail">
                          <Eye size={15} className="text-slate-500" />
                        </button>
                        <button onClick={() => setDeleteTarget(ot)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
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
      )}

      {/* REPORT VIEW */}
      {activeView === 'report' && (
        <div className="space-y-4">
          {report.summary.length === 0 ? (
            <div className="card p-10 text-center text-slate-400">
              <BarChart2 size={36} className="mx-auto mb-3 opacity-30" />
              <p>Tidak ada data lembur yang disetujui untuk periode ini</p>
            </div>
          ) : (
            <>
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 text-sm">Rekap per Karyawan</h3>
                  {report.rate_per_hour > 0 && (
                    <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                      Tarif: Rp {report.rate_per_hour.toLocaleString('id-ID')}/jam
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Karyawan', 'Departemen', 'Sesi', 'Total Durasi', ...(report.rate_per_hour > 0 ? ['Kompensasi'] : [])].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {report.summary.map(s => (
                        <tr key={s.user_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 text-sm">{s.user_name}</div>
                            <div className="text-xs text-slate-500">{s.employee_id || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{s.department || '-'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{s.total_sessions}x</td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-slate-900">{formatDuration(s.total_minutes)}</span>
                          </td>
                          {report.rate_per_hour > 0 && (
                            <td className="px-4 py-3">
                              <span className="text-sm font-bold text-emerald-700">
                                Rp {(s.total_compensation || 0).toLocaleString('id-ID')}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {report.rate_per_hour > 0 && report.summary.length > 0 && (
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-sm font-bold text-slate-700">Total Kompensasi</td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-emerald-700">
                              Rp {report.summary.reduce((s, r) => s + (r.total_compensation || 0), 0).toLocaleString('id-ID')}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Detail / Review Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900 text-lg">Detail Lembur</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setDeleteTarget(selected); setSelected(null); }}
                    className="p-2 rounded-xl hover:bg-red-50 transition-colors" title="Hapus">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Info karyawan */}
              <div className="flex items-center gap-3 mb-5 p-3 bg-slate-50 rounded-2xl">
                <UserAvatar name={selected.user_name} avatar={selected.user_avatar} size="lg" />
                <div>
                  <div className="font-semibold text-slate-900">{selected.user_name}</div>
                  <div className="text-xs text-slate-500">{[selected.department, selected.position].filter(Boolean).join(' · ') || '-'}</div>
                </div>
              </div>

              <div className="space-y-2.5 text-sm mb-4">
                {[
                  { label: 'Tanggal', value: format(new Date(selected.date), 'EEEE, d MMMM yyyy', { locale: id }) },
                  { label: 'Jam Mulai', value: selected.start_time.slice(0, 5) },
                  { label: 'Jam Selesai', value: selected.end_time.slice(0, 5) },
                  { label: 'Durasi', value: formatDuration(selected.duration_minutes) },
                  { label: 'Status', value: statusConfig[selected.status]?.label, badge: statusConfig[selected.status]?.cls },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-slate-500">{item.label}</span>
                    {item.badge
                      ? <span className={item.badge}>{item.value}</span>
                      : <span className="font-medium text-slate-900">{item.value}</span>}
                  </div>
                ))}
                <div className="pt-1">
                  <p className="text-slate-500 mb-1">Alasan / Pekerjaan</p>
                  <p className="text-slate-900 bg-slate-50 rounded-xl p-3">{selected.reason}</p>
                </div>
              </div>

              {selected.review_notes && (
                <div className="mb-4 bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">Catatan</p>
                  <p className="text-sm text-slate-700">{selected.review_notes}</p>
                </div>
              )}

              {/* Foto Bukti Lembur */}
              {selected.attachment && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Foto Bukti Lembur</p>
                  <ZoomableImage
                    src={`/uploads/overtime/${selected.attachment}`}
                    alt="bukti lembur"
                    className="w-full rounded-xl object-cover border border-slate-200"
                  />
                </div>
              )}

              {selected.status === 'pending' && (
                <>
                  <div className="mb-4">
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Catatan (opsional)</label>
                    <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
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
              className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Hapus Pengajuan?</h3>
                  <p className="text-sm text-slate-500">{deleteTarget.user_name}</p>
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
