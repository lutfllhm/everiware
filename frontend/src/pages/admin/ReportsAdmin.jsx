import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Download, Calendar, FileSpreadsheet, FileText, CalendarRange, CalendarDays } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../../api/axios';
import UserAvatar from '../../components/ui/UserAvatar';

const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const COLORS = { present: '#14b8a6', late: '#f59e0b', absent: '#ef4444', leave: '#38bdf8', sick: '#a855f7' };

// ── Helper: bangun query params dari filter ───────────────────────────────────
const buildParams = (filterMode, filters) => {
  if (filterMode === 'range') {
    return `start_date=${filters.start_date}&end_date=${filters.end_date}`;
  }
  return `month=${filters.month}&year=${filters.year}`;
};

const periodLabel = (filterMode, filters) => {
  if (filterMode === 'range') {
    if (!filters.start_date || !filters.end_date) return '-';
    return `${filters.start_date} s/d ${filters.end_date}`;
  }
  return `${monthNames[filters.month - 1]} ${filters.year}`;
};

export default function ReportsAdmin() {
  const [activeTab, setActiveTab] = useState('attendance');
  const [filterMode, setFilterMode] = useState('month'); // 'month' | 'range'
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    department: '',
    employee_id: '',
  });

  const [attReport, setAttReport] = useState([]);
  const [leaveReport, setLeaveReport] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  // Validasi range
  const rangeValid = filterMode === 'month' || (filters.start_date && filters.end_date && filters.start_date <= filters.end_date);

  useEffect(() => {
    // Load departments & employees untuk filter
    api.get('/departments').then(r => setDepartments(r.data.departments || [])).catch(() => {});
    api.get('/users?role=employee').then(r => setEmployees(r.data.users || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (rangeValid) fetchReports();
  }, [filters, activeTab, filterMode]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const q = buildParams(filterMode, filters);
      const extra = [
        filters.department ? `department=${encodeURIComponent(filters.department)}` : '',
        filters.employee_id ? `employee_id=${filters.employee_id}` : '',
      ].filter(Boolean).join('&');
      const fullQ = extra ? `${q}&${extra}` : q;

      if (activeTab === 'attendance') {
        const { data } = await api.get(`/attendance/report?${fullQ}`);
        setAttReport(data.report);
      } else {
        const { data } = await api.get(`/leave/report?${fullQ}`);
        setLeaveReport(data.report);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const q = buildParams(filterMode, filters);
      const urlMap = {
        'att-excel':     `/export/attendance/excel?${q}`,
        'att-pdf':       `/export/attendance/pdf?${q}`,
        'leave-excel':   `/export/leave/excel?${q}`,
        'monthly-excel': `/export/monthly-recap/excel?${q}`,
      };
      const token = JSON.parse(localStorage.getItem('iware-auth') || '{}')?.token;
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://192.168.120.223:5005/api'}${urlMap[type]}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export gagal');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') || '';
      const fname = cd.match(/filename=(.+)/)?.[1] || `export_${type}.xlsx`;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Gagal export. Pastikan server berjalan.');
    } finally { setExporting(''); }
  };

  // Summary charts
  const attSummary = attReport.reduce((acc, r) => ({
    present: acc.present + (r.present_count || 0),
    late:    acc.late    + (r.late_count    || 0),
    absent:  acc.absent  + (r.absent_count  || 0),
    leave:   acc.leave   + (r.leave_count   || 0),
    sick:    acc.sick    + (r.sick_count    || 0),
  }), { present: 0, late: 0, absent: 0, leave: 0, sick: 0 });

  const pieData = [
    { name: 'Hadir',     value: attSummary.present, color: COLORS.present },
    { name: 'Terlambat', value: attSummary.late,    color: COLORS.late    },
    { name: 'Absen',     value: attSummary.absent,  color: COLORS.absent  },
    { name: 'Cuti',      value: attSummary.leave,   color: COLORS.leave   },
    { name: 'Sakit',     value: attSummary.sick,    color: COLORS.sick    },
  ].filter(d => d.value > 0);

  const barData = attReport.slice(0, 8).map(r => ({
    name: r.name?.split(' ')[0] || '-',
    Hadir: r.present_count,
    Terlambat: r.late_count,
    Absen: r.absent_count,
  }));

  const leaveTypeData = [
    { name: 'Cuti Tahunan', value: leaveReport.filter(l => l.type === 'annual').length,     color: '#38bdf8' },
    { name: 'Izin Sakit',   value: leaveReport.filter(l => l.type === 'sick').length,       color: '#a855f7' },
    { name: 'Izin',         value: leaveReport.filter(l => l.type === 'permission').length, color: '#f59e0b' },
    { name: 'WFH',          value: leaveReport.filter(l => l.type === 'wfh').length,        color: '#14b8a6' },
    { name: 'Dinas',        value: leaveReport.filter(l => l.type === 'dinas').length,      color: '#6366f1' },
  ].filter(d => d.value > 0);

  const totalLeavedays = leaveReport.reduce((s, l) => s + (l.total_days || 0), 0);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div>
        <h2 className="font-bold text-slate-900 text-lg">Laporan</h2>
        <p className="text-slate-500 text-sm">Rekap data {periodLabel(filterMode, filters)}</p>
      </div>

      {/* ── Filter Bar ── */}
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

        {/* Filter inputs */}
        <div className="flex flex-wrap gap-3 items-end">
          {filterMode === 'month' ? (
            <>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Bulan</label>
                <select value={filters.month} onChange={e => setFilters({ ...filters, month: +e.target.value })}
                  className="input-field py-2 text-sm w-auto">
                  {monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tahun</label>
                <select value={filters.year} onChange={e => setFilters({ ...filters, year: +e.target.value })}
                  className="input-field py-2 text-sm w-auto">
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
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

          {/* Filter Departemen & Karyawan */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Departemen</label>
            <select value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value, employee_id: '' })}
              className="input-field py-2 text-sm w-auto">
              <option value="">Semua Departemen</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Karyawan</label>
            <select value={filters.employee_id} onChange={e => setFilters({ ...filters, employee_id: e.target.value })}
              className="input-field py-2 text-sm w-auto">
              <option value="">Semua Karyawan</option>
              {(filters.department
                ? employees.filter(e => e.department === filters.department)
                : employees
              ).map(e => <option key={e.id} value={e.employee_id || e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 flex-wrap ml-auto">
            {activeTab === 'attendance' && (<>
              <button onClick={() => handleExport('att-excel')} disabled={!!exporting || !rangeValid}
                className="btn-secondary py-2 flex items-center gap-1.5 text-sm disabled:opacity-50">
                <FileSpreadsheet size={14} className="text-teal-600" />
                {exporting === 'att-excel' ? 'Exporting...' : 'Excel'}
              </button>
              <button onClick={() => handleExport('att-pdf')} disabled={!!exporting || !rangeValid}
                className="btn-secondary py-2 flex items-center gap-1.5 text-sm disabled:opacity-50">
                <FileText size={14} className="text-red-500" />
                {exporting === 'att-pdf' ? 'Exporting...' : 'PDF'}
              </button>
              <button onClick={() => handleExport('monthly-excel')} disabled={!!exporting || !rangeValid}
                className="btn-secondary py-2 flex items-center gap-1.5 text-sm disabled:opacity-50">
                <Download size={14} />
                {exporting === 'monthly-excel' ? 'Exporting...' : 'Rekap/Karyawan'}
              </button>
            </>)}
            {activeTab === 'leave' && (
              <button onClick={() => handleExport('leave-excel')} disabled={!!exporting || !rangeValid}
                className="btn-secondary py-2 flex items-center gap-1.5 text-sm disabled:opacity-50">
                <FileSpreadsheet size={14} className="text-teal-600" />
                {exporting === 'leave-excel' ? 'Exporting...' : 'Export Excel'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-slate-100 rounded-2xl p-1 w-fit">
        {[{ key: 'attendance', label: 'Absensi', icon: BarChart3 }, { key: 'leave', label: 'Perizinan', icon: Calendar }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════
          TAB ABSENSI
      ══════════════════════════════════ */}
      {activeTab === 'attendance' && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Hadir',     value: attSummary.present, color: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-200' },
              { label: 'Terlambat', value: attSummary.late,    color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
              { label: 'Absen',     value: attSummary.absent,  color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
              { label: 'Cuti',      value: attSummary.leave,   color: 'text-sky-700',    bg: 'bg-sky-50',    border: 'border-sky-200' },
              { label: 'Sakit',     value: attSummary.sick,    color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
            ].map(s => (
              <div key={s.label} className={`bg-white border ${s.border} rounded-xl p-4 text-center`}>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          {!loading && attReport.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-slate-800 rounded-full" />
                  <h3 className="font-bold text-slate-900 text-sm">Kehadiran per Karyawan</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Bar dataKey="Hadir"     fill={COLORS.present} radius={[4,4,0,0]} />
                    <Bar dataKey="Terlambat" fill={COLORS.late}    radius={[4,4,0,0]} />
                    <Bar dataKey="Absen"     fill={COLORS.absent}  radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-slate-800 rounded-full" />
                  <h3 className="font-bold text-slate-900 text-sm">Distribusi Status</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tabel */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Detail per Karyawan</h3>
                <p className="text-slate-400 text-xs mt-0.5">{attReport.length} karyawan · {periodLabel(filterMode, filters)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Karyawan', 'ID', 'Dept · Jabatan', 'Hadir', 'Terlambat', 'Absen', 'Cuti', 'Sakit', 'Total'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-10 text-slate-400">Memuat data...</td></tr>
                  ) : attReport.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10">
                      <BarChart3 size={32} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Tidak ada data untuk periode ini</p>
                    </td></tr>
                  ) : attReport.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={row.name} avatar={row.avatar} size="md" />
                          <span className="font-medium text-slate-900 text-sm">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{row.employee_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{[row.department, row.position].filter(Boolean).join(' · ') || '-'}</td>
                      <td className="px-4 py-3"><span className="badge-success">{row.present_count}</span></td>
                      <td className="px-4 py-3"><span className="badge-warning">{row.late_count}</span></td>
                      <td className="px-4 py-3"><span className="badge-danger">{row.absent_count}</span></td>
                      <td className="px-4 py-3"><span className="badge-info">{row.leave_count}</span></td>
                      <td className="px-4 py-3"><span className="badge-purple">{row.sick_count}</span></td>
                      <td className="px-4 py-3 font-bold text-slate-900">{row.total_days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          TAB PERIZINAN
      ══════════════════════════════════ */}
      {activeTab === 'leave' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Pengajuan', value: leaveReport.length,    color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
              { label: 'Total Hari',      value: totalLeavedays,        color: 'text-sky-700',   bg: 'bg-sky-50',   border: 'border-sky-200' },
              { label: 'Cuti Tahunan',    value: leaveReport.filter(l => l.type === 'annual').length, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
            ].map(s => (
              <div key={s.label} className={`bg-white border ${s.border} rounded-xl p-4 text-center`}>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {!loading && leaveReport.length > 0 && leaveTypeData.length > 0 && (
            <div className="card p-5 max-w-xs">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-slate-800 rounded-full" />
                <h3 className="font-bold text-slate-900 text-sm">Jenis Perizinan</h3>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={leaveTypeData} cx="50%" cy="45%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                    {leaveTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Detail Perizinan Disetujui</h3>
              <p className="text-slate-400 text-xs mt-0.5">{leaveReport.length} pengajuan · {periodLabel(filterMode, filters)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Karyawan', 'Departemen', 'Jenis', 'Tanggal', 'Durasi', 'Alasan'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-400">Memuat data...</td></tr>
                  ) : leaveReport.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10">
                      <Calendar size={32} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Tidak ada perizinan disetujui untuk periode ini</p>
                    </td></tr>
                  ) : leaveReport.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={row.user_name} avatar={row.user_avatar} size="md" />
                          <span className="font-medium text-slate-900 text-sm">{row.user_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{[row.department, row.position].filter(Boolean).join(' · ') || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={row.type === 'annual' ? 'badge-info' : row.type === 'sick' ? 'badge-purple' : row.type === 'wfh' ? 'badge-success' : 'badge-warning'}>
                          {row.type === 'annual' ? 'Cuti' : row.type === 'sick' ? 'Sakit' : row.type === 'wfh' ? 'WFH' : row.type === 'dinas' ? 'Dinas' : 'Izin'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(row.start_date).toLocaleDateString('id-ID')} – {new Date(row.end_date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.total_days} hari</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



