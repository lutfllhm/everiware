import { useState, useEffect } from 'react';
import { Shield, Search, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/ui/Pagination';

const ACTION_LABELS = {
  APPROVE_LEAVE:    { label: 'Setujui Izin',      color: 'bg-emerald-100 text-emerald-700' },
  REJECT_LEAVE:     { label: 'Tolak Izin',         color: 'bg-red-100 text-red-700' },
  DELETE_LEAVE:     { label: 'Hapus Izin',          color: 'bg-red-100 text-red-700' },
  APPROVE_OVERTIME: { label: 'Setujui Lembur',     color: 'bg-emerald-100 text-emerald-700' },
  REJECT_OVERTIME:  { label: 'Tolak Lembur',        color: 'bg-red-100 text-red-700' },
  DELETE_OVERTIME:  { label: 'Hapus Lembur',        color: 'bg-red-100 text-red-700' },
  EDIT_ATTENDANCE:  { label: 'Edit Absensi',        color: 'bg-blue-100 text-blue-700' },
  DELETE_ATTENDANCE:{ label: 'Hapus Absensi',       color: 'bg-red-100 text-red-700' },
};

export default function AuditLogAdmin() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => { fetchLogs(); }, [actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 500 });
      if (actionFilter) params.append('action', actionFilter);
      const { data } = await api.get(`/audit-logs?${params}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  };

  const filtered = logs.filter(l =>
    !search ||
    l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.description?.toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filtered, 30);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Cari nama admin atau deskripsi..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 py-2.5 text-sm" />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="input-field py-2.5 text-sm w-auto">
          <option value="">Semua Aksi</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={fetchLogs} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          <RefreshCw size={15} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-xs text-slate-400">{total} total log</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Waktu', 'Admin', 'Aksi', 'Deskripsi', 'IP'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Memuat data...</td></tr>
              ) : pagination.paged.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">
                  <Shield size={32} className="mx-auto mb-2 opacity-20" />
                  Belum ada log aktivitas
                </td></tr>
              ) : pagination.paged.map(log => {
                const cfg = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: id })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{log.user_name}</div>
                      <div className="text-xs text-slate-400 capitalize">{log.user_role}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs">
                      <p className="truncate">{log.description || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{log.ip_address || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </div>
    </div>
  );
}
