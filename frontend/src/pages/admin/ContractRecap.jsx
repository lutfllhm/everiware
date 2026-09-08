import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import {
  UserPlus, UserMinus, TrendingUp, TrendingDown, Users, Percent, X, CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

// Palet selaras dashboard: hijau untuk masuk, merah untuk keluar, netral untuk sisanya.
const C = {
  hire: '#0d9488',
  exit: '#ef4444',
  neutral: '#64748b',
  accent: '#3b82f6',
  warn: '#f59e0b',
};
const PIE_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#64748b'];
const STATUS_COLORS = { PKWT: '#3b82f6', PKWTT: '#0d9488', DAILY_WORKER: '#f59e0b', BELUM_ADA: '#cbd5e1' };

const fmtDate = (d) => d
  ? new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  : '-';

const chartTooltip = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 };

export default function ContractRecap() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); // { type, employees, loading }

  useEffect(() => { fetchRecap(); /* eslint-disable-next-line */ }, [year]);

  const fetchRecap = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/contracts/recap', { params: { year } });
      setData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat rekap');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (type) => {
    setDetail({ type, loading: true, employees: [] });
    try {
      const { data } = await api.get('/contracts/recap/detail', { params: { year, type } });
      setDetail({ type, loading: false, employees: data.employees });
    } catch {
      toast.error('Gagal memuat detail');
      setDetail(null);
    }
  };

  if (loading || !data) {
    return <div className="text-center py-16 text-slate-400 text-sm">Memuat rekap...</div>;
  }

  const s = data.summary;
  const cards = [
    { label: 'Karyawan Baru', value: s.karyawan_baru, icon: UserPlus, color: 'text-teal-600', bg: 'bg-teal-50', onClick: () => openDetail('hire') },
    { label: 'Turn Over', value: s.turn_over, icon: UserMinus, color: 'text-red-600', bg: 'bg-red-50', onClick: () => openDetail('exit') },
    {
      label: 'Pertumbuhan Bersih', value: s.net_growth > 0 ? `+${s.net_growth}` : s.net_growth,
      icon: s.net_growth >= 0 ? TrendingUp : TrendingDown,
      color: s.net_growth >= 0 ? 'text-teal-600' : 'text-red-600',
      bg: s.net_growth >= 0 ? 'bg-teal-50' : 'bg-red-50',
    },
    { label: 'Headcount Akhir', value: s.headcount_akhir, icon: Users, color: 'text-slate-700', bg: 'bg-slate-100' },
    { label: 'Rasio Turn Over', value: `${s.turnover_rate}%`, icon: Percent, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-5">
      {/* Pemilih tahun */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Rekap Tahun {data.year}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Karyawan baru dihitung dari tanggal masuk, turn over dari tanggal keluar.
          </p>
        </div>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          {(data.available_years || [year]).map(y => <option key={y} value={y}>Tahun {y}</option>)}
        </select>
      </div>

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={c.onClick}
            className={`bg-white rounded-2xl border border-slate-200 p-4 ${c.onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all' : ''}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c.bg}`}>
              <c.icon size={16} className={c.color} />
            </div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-slate-500">{c.label}</div>
            {c.onClick && <div className="text-[10px] text-slate-400 mt-1">Klik untuk detail →</div>}
          </motion.div>
        ))}
      </div>

      {/* Tren bulanan masuk vs keluar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-slate-800 rounded-full" />
          <h3 className="font-bold text-slate-900 text-sm">Karyawan Masuk vs Keluar — {data.year}</h3>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.monthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
            <Tooltip contentStyle={chartTooltip} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="karyawan_baru" name="Karyawan Baru" fill={C.hire} radius={[4, 4, 0, 0]} />
            <Bar dataKey="turn_over" name="Turn Over" fill={C.exit} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Komposisi status hubungan kerja */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-slate-800 rounded-full" />
            <h3 className="font-bold text-slate-900 text-sm">Komposisi Status Hubungan Kerja</h3>
          </div>
          {data.by_status.length ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.by_status} cx="50%" cy="45%" innerRadius={48} outerRadius={72}
                    paddingAngle={3} dataKey="total" nameKey="label">
                    {data.by_status.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.key] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={chartTooltip} formatter={(v) => [`${v} karyawan`, 'Jumlah']} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-xs text-slate-400 text-center">Berdasarkan kontrak aktif karyawan saat ini</p>
            </>
          ) : <EmptyChart />}
        </motion.div>

        {/* Alasan keluar */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-slate-800 rounded-full" />
            <h3 className="font-bold text-slate-900 text-sm">Alasan Keluar — {data.year}</h3>
          </div>
          {data.by_reason.length ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.by_reason} cx="50%" cy="45%" innerRadius={48} outerRadius={72}
                    paddingAngle={3} dataKey="total" nameKey="label">
                    {data.by_reason.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={chartTooltip} formatter={(v) => [`${v} karyawan`, 'Jumlah']} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-xs text-slate-400 text-center">Total {s.turn_over} karyawan keluar sepanjang {data.year}</p>
            </>
          ) : <EmptyChart text={`Tidak ada karyawan keluar di ${data.year}`} />}
        </motion.div>

        {/* Sebaran PKWT tahun ke-berapa */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-slate-800 rounded-full" />
            <h3 className="font-bold text-slate-900 text-sm">Sebaran PKWT per Tahun Kontrak</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.by_pkwt_year} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltip} formatter={(v) => [`${v} karyawan`, 'Jumlah']} />
              <Bar dataKey="total" name="Karyawan" fill={C.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-400 text-center mt-1">Dihitung otomatis dari riwayat perpanjangan kontrak</p>
        </motion.div>

        {/* Kontrak berakhir per bulan */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-slate-800 rounded-full" />
            <h3 className="font-bold text-slate-900 text-sm">Kontrak Berakhir per Bulan — {data.year}</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.contract_endings} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltip} formatter={(v) => [`${v} kontrak`, 'Berakhir']} />
              <Line type="monotone" dataKey="total" name="Kontrak Berakhir" stroke={C.warn}
                strokeWidth={2} dot={{ r: 3, fill: C.warn }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-400 text-center mt-1">Untuk perencanaan perpanjangan kontrak</p>
        </motion.div>
      </div>

      {/* Sebaran penempatan & instansi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-slate-800 rounded-full" />
            <h3 className="font-bold text-slate-900 text-sm">Karyawan Aktif per Penempatan</h3>
          </div>
          {data.by_placement.length ? (
            <ResponsiveContainer width="100%" height={Math.max(200, data.by_placement.length * 28)}>
              <BarChart data={data.by_placement} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={chartTooltip} formatter={(v) => [`${v} karyawan`, 'Jumlah']} />
                <Bar dataKey="total" name="Karyawan" fill={C.neutral} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-slate-800 rounded-full" />
            <h3 className="font-bold text-slate-900 text-sm">Karyawan Aktif per Instansi</h3>
          </div>
          {data.by_instansi.length ? (
            <ResponsiveContainer width="100%" height={Math.max(200, data.by_instansi.length * 34)}>
              <BarChart data={data.by_instansi} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={chartTooltip} formatter={(v) => [`${v} karyawan`, 'Jumlah']} />
                <Bar dataKey="total" name="Karyawan" fill={C.accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </motion.div>
      </div>

      {/* Modal detail karyawan baru / keluar */}
      {detail && (
        <div onClick={() => setDetail(null)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {detail.type === 'hire' ? 'Karyawan Baru' : 'Karyawan Keluar (Turn Over)'} — {year}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{detail.employees.length} karyawan</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              {detail.loading ? (
                <div className="text-center py-12 text-slate-400 text-sm">Memuat...</div>
              ) : detail.employees.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Tidak ada data</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                      <th className="px-4 py-2.5">Nama</th>
                      <th className="px-3 py-2.5">Posisi</th>
                      <th className="px-3 py-2.5">Penempatan</th>
                      <th className="px-3 py-2.5">{detail.type === 'hire' ? 'Tgl Masuk' : 'Tgl Keluar'}</th>
                      <th className="px-3 py-2.5">{detail.type === 'hire' ? 'Status' : 'Alasan'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.employees.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-900">{e.name}</div>
                          <div className="text-xs text-slate-400">{e.employee_id || '-'}</div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{e.position || '-'}</td>
                        <td className="px-3 py-2.5 text-slate-600">{e.penempatan || '-'}</td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                          {fmtDate(detail.type === 'hire' ? e.join_date : e.resign_date)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {detail.type === 'hire'
                            ? (e.contract_type
                                ? `${e.contract_type}${e.pkwt_year ? ` • Thn ke-${e.pkwt_year}` : ''}`
                                : <span className="text-slate-300">Belum ada kontrak</span>)
                            : (e.resign_reason_label || '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function EmptyChart({ text = 'Belum ada data' }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-slate-300 gap-2">
      <CalendarClock size={28} />
      <span className="text-sm">{text}</span>
    </div>
  );
}
