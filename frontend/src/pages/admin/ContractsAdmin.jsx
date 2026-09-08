import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSignature, Search, Plus, RefreshCw, X, History, AlertTriangle,
  CheckCircle2, Clock, UserMinus, UserCheck, BarChart3, Users, Filter, Pencil,
  UserPlus, Mail, CornerDownLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import ContractRecap from './ContractRecap';

// ── Konstanta tampilan ────────────────────────────────────────────────────────
const TYPE_LABELS = { PKWT: 'PKWT', PKWTT: 'PKWTT', DAILY_WORKER: 'Daily Worker' };
const TYPE_BADGE = {
  PKWT: 'bg-blue-50 text-blue-700 border-blue-200',
  PKWTT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DAILY_WORKER: 'bg-amber-50 text-amber-700 border-amber-200',
};
const RESIGN_OPTIONS = [
  { value: 'resign', label: 'Resign' },
  { value: 'tidak_lanjut_kontrak', label: 'Tidak Lanjut Kontrak' },
  { value: 'phk', label: 'PHK' },
  { value: 'pensiun', label: 'Pensiun' },
  { value: 'lainnya', label: 'Lainnya' },
];

const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  });
};
const fmtDateLong = (d) => {
  if (!d) return '-';
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
};
const todayISO = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

// Sisa hari tampil sebagai badge berwarna: merah H-14, kuning H-30, abu selebihnya.
function RemainingBadge({ row }) {
  if (!row.contract_id) return <span className="text-slate-300">-</span>;
  if (row.contract_type === 'PKWTT') return <span className="text-emerald-600 text-xs font-medium">Permanen</span>;
  if (row.days_remaining === null) return <span className="text-slate-300">-</span>;

  if (row.is_expired) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">Berakhir</span>;
  }
  const cls = row.is_expiring_soon
    ? 'bg-red-50 text-red-700 border-red-200'
    : row.days_remaining <= 30
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${cls}`}>
      {row.is_expiring_soon && <AlertTriangle size={11} />}
      {row.days_remaining} Hari
    </span>
  );
}

// Kolom checklist (TTD Kontrak / SKCK / Formjobs) — klik untuk toggle.
function CheckCell({ checked, onToggle, disabled, title }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={title}
      className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors mx-auto ${
        checked
          ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
          : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <CheckCircle2 size={14} />
    </button>
  );
}

export default function ContractsAdmin() {
  const [tab, setTab] = useState('data'); // 'data' | 'recap'
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [master, setMaster] = useState({ placements: [], institutions: [], positions: [], durations: [3, 6, 12] });
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPlacement, setFilterPlacement] = useState('');
  const [filterInstansi, setFilterInstansi] = useState('');
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  // Modal
  const [contractModal, setContractModal] = useState(null); // { row, mode: 'new'|'renew'|'edit' }
  const [historyModal, setHistoryModal] = useState(null);
  const [employmentModal, setEmploymentModal] = useState(null);
  const [terminateModal, setTerminateModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ contract_type: 'PKWT', duration_months: 6, start_date: todayISO(), note: '', is_signed: false });
  const [empForm, setEmpForm] = useState({ penempatan: '', instansi: '', join_date: '', position: '', has_skck: false, has_formjobs: false });
  const [termForm, setTermForm] = useState({ resign_date: todayISO(), resign_reason: 'resign', resign_note: '' });

  // Modal "Tambah Karyawan" — cari karyawan yang sudah ada, atau daftarkan baru
  const [addModal, setAddModal] = useState(null); // null | { step: 'search'|'form', prefillName }
  const [newForm, setNewForm] = useState({
    name: '', email: '', phone: '', employee_id: '', position: '',
    penempatan: '', instansi: '', join_date: todayISO(),
    has_skck: false, has_formjobs: false, send_invitation: true,
    contract_type: 'PKWT', duration_months: 6, start_date: '', note: '', is_signed: false,
  });

  useEffect(() => { fetchMaster(); }, []);
  useEffect(() => {
    const t = setTimeout(fetchRows, search ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterType, filterPlacement, filterInstansi, onlyExpiring, includeInactive]);

  const fetchMaster = async () => {
    try {
      const { data } = await api.get('/contracts/master');
      setMaster(data);
    } catch {}
  };

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/contracts', {
        params: {
          search: search || undefined,
          status: filterType || undefined,
          penempatan: filterPlacement || undefined,
          instansi: filterInstansi || undefined,
          expiring: onlyExpiring ? 'true' : undefined,
          include_inactive: includeInactive ? 'true' : undefined,
        },
      });
      setRows(data.contracts || []);
      setSummary(data.summary || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat data kontrak');
    } finally {
      setLoading(false);
    }
  };

  // Preview tanggal berakhir mengikuti rumus backend (start + durasi - 1 hari),
  // supaya HR melihat hasilnya sebelum menyimpan.
  const previewEndDate = useMemo(() => {
    if (form.contract_type !== 'PKWT' || !form.start_date || !form.duration_months) return null;
    const [y, m, d] = form.start_date.split('-').map(Number);
    const dueIdx = (m - 1) + Number(form.duration_months);
    const dueYear = y + Math.floor(dueIdx / 12);
    const dueMonth = dueIdx % 12;
    const daysInDue = new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate();
    if (d > daysInDue) return new Date(Date.UTC(dueYear, dueMonth, daysInDue)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(dueYear, dueMonth, d));
    end.setUTCDate(end.getUTCDate() - 1);
    return end.toISOString().slice(0, 10);
  }, [form.contract_type, form.start_date, form.duration_months]);

  // ── Aksi ────────────────────────────────────────────────────────────────────
  const openContractModal = (row, mode) => {
    if (mode === 'edit' && row.contract_id) {
      setForm({
        contract_type: row.contract_type,
        duration_months: row.duration_months || 6,
        start_date: String(row.start_date || todayISO()).slice(0, 10),
        note: row.note || '',
        is_signed: !!row.is_signed,
      });
    } else {
      // Perpanjangan default mulai sehari setelah kontrak lama berakhir
      const nextStart = mode === 'renew' && row.end_date
        ? (() => { const t = new Date(`${String(row.end_date).slice(0, 10)}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); })()
        : (row.join_date ? String(row.join_date).slice(0, 10) : todayISO());
      setForm({ contract_type: row.contract_type || 'PKWT', duration_months: row.duration_months || 6, start_date: nextStart, note: '', is_signed: false });
    }
    setContractModal({ row, mode });
  };

  const handleSaveContract = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        contract_type: form.contract_type,
        duration_months: form.contract_type === 'PKWT' ? Number(form.duration_months) : null,
        start_date: form.start_date,
        note: form.note,
        is_signed: form.is_signed,
      };
      if (contractModal.mode === 'edit') {
        await api.put(`/contracts/${contractModal.row.contract_id}`, payload);
        toast.success('Kontrak berhasil diperbarui');
      } else {
        const { data } = await api.post('/contracts', { user_id: contractModal.row.id, ...payload });
        toast.success(data.message || 'Kontrak berhasil disimpan');
      }
      setContractModal(null);
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan kontrak');
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (row) => {
    setHistoryModal({ loading: true, employee: row, history: [] });
    try {
      const { data } = await api.get(`/contracts/history/${row.id}`);
      setHistoryModal({ loading: false, employee: data.employee, history: data.history });
    } catch {
      toast.error('Gagal memuat riwayat kontrak');
      setHistoryModal(null);
    }
  };

  const openEmployment = (row) => {
    setEmpForm({
      penempatan: row.penempatan || '',
      instansi: row.instansi || '',
      position: row.position || '',
      join_date: row.join_date ? String(row.join_date).slice(0, 10) : '',
      has_skck: !!row.has_skck,
      has_formjobs: !!row.has_formjobs,
    });
    setEmploymentModal(row);
  };

  const handleSaveEmployment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/contracts/employment/${employmentModal.id}`, empForm);
      toast.success('Data kepegawaian berhasil diperbarui');
      setEmploymentModal(null);
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  // Toggle checklist langsung dari tabel (TTD kontrak / SKCK / Formjobs)
  const toggleCheck = async (row, field) => {
    try {
      if (field === 'is_signed') {
        if (!row.contract_id) return toast.error('Karyawan ini belum punya kontrak');
        await api.put(`/contracts/${row.contract_id}`, { is_signed: !row.is_signed });
      } else {
        await api.put(`/contracts/employment/${row.id}`, { [field]: !row[field] });
      }
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: !r[field] } : r));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui');
      fetchRows();
    }
  };

  const handleTerminate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/contracts/terminate/${terminateModal.id}`, termForm);
      toast.success('Data karyawan keluar berhasil disimpan');
      setTerminateModal(null);
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  // Preview tanggal berakhir untuk form pendaftaran karyawan baru.
  // Rumusnya sama dengan backend; tanggal mulai kontrak default = tanggal masuk.
  const newPreviewEnd = useMemo(() => {
    const start = newForm.start_date || newForm.join_date;
    if (newForm.contract_type !== 'PKWT' || !start || !newForm.duration_months) return null;
    const [y, m, d] = start.split('-').map(Number);
    const dueIdx = (m - 1) + Number(newForm.duration_months);
    const dueYear = y + Math.floor(dueIdx / 12);
    const dueMonth = dueIdx % 12;
    const daysInDue = new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate();
    if (d > daysInDue) return new Date(Date.UTC(dueYear, dueMonth, daysInDue)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(dueYear, dueMonth, d));
    end.setUTCDate(end.getUTCDate() - 1);
    return end.toISOString().slice(0, 10);
  }, [newForm.contract_type, newForm.start_date, newForm.join_date, newForm.duration_months]);

  const openAddModal = () => {
    setNewForm({
      name: '', email: '', phone: '', employee_id: '', position: '',
      penempatan: '', instansi: '', join_date: todayISO(),
      has_skck: false, has_formjobs: false, send_invitation: true,
      contract_type: 'PKWT', duration_months: 6, start_date: '', note: '', is_signed: false,
    });
    setAddModal({ step: 'search' });
  };

  // Karyawan yang sudah terdaftar dipilih dari hasil cari -> langsung ke form kontrak,
  // supaya tidak pernah terbentuk data karyawan ganda.
  const pickExistingEmployee = (emp) => {
    setAddModal(null);
    openContractModal({ ...emp, contract_type: emp.contract_type || 'PKWT' }, emp.has_contract ? 'renew' : 'new');
  };

  const handleSaveNewEmployee = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/contracts/employee', {
        ...newForm,
        duration_months: newForm.contract_type === 'PKWT' ? Number(newForm.duration_months) : null,
        start_date: newForm.start_date || newForm.join_date,
      });
      toast.success(data.message || 'Karyawan berhasil didaftarkan');
      setAddModal(null);
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mendaftarkan karyawan');
    } finally {
      setSaving(false);
    }
  };

  const handleReactivate = async (row) => {
    try {
      await api.put(`/contracts/reactivate/${row.id}`);
      toast.success(`${row.name} diaktifkan kembali`);
      fetchRows();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengaktifkan karyawan');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Total Karyawan', value: summary.total ?? 0, icon: Users, cls: 'text-slate-700 bg-slate-100' },
    { label: 'PKWT', value: summary.pkwt ?? 0, icon: FileSignature, cls: 'text-blue-700 bg-blue-100' },
    { label: 'PKWTT', value: summary.pkwtt ?? 0, icon: CheckCircle2, cls: 'text-emerald-700 bg-emerald-100' },
    { label: 'Daily Worker', value: summary.daily_worker ?? 0, icon: Clock, cls: 'text-amber-700 bg-amber-100' },
    { label: 'Segera Berakhir', value: summary.expiring_soon ?? 0, icon: AlertTriangle, cls: 'text-red-700 bg-red-100' },
  ];

  return (
    <div className="space-y-4">
      {/* Tab + tombol tambah */}
      <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'data', label: 'Data Kontrak', icon: FileSignature },
          { key: 'recap', label: 'Rekap & Statistik', icon: BarChart3 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

        {tab === 'data' && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <UserPlus size={16} /> Tambah Karyawan
          </button>
        )}
      </div>

      {tab === 'recap' ? <ContractRecap /> : (
        <>
          {/* Ringkasan */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stats.map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.cls}`}>
                  <s.icon size={16} />
                </div>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Peringatan H-14 */}
          {(summary.expiring_soon ?? 0) > 0 && !onlyExpiring && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800 flex-1">
                <b>{summary.expiring_soon} kontrak</b> akan berakhir dalam 14 hari ke depan. Segera proses perpanjangan.
              </p>
              <button
                onClick={() => setOnlyExpiring(true)}
                className="text-xs font-semibold text-red-700 hover:text-red-900 underline whitespace-nowrap"
              >
                Lihat daftar
              </button>
            </div>
          )}

          {/* Filter */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama / NIK karyawan..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none">
              <option value="">Semua Status</option>
              <option value="PKWT">PKWT</option>
              <option value="PKWTT">PKWTT</option>
              <option value="DAILY_WORKER">Daily Worker</option>
            </select>
            <select value={filterPlacement} onChange={e => setFilterPlacement(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none max-w-[170px]">
              <option value="">Semua Penempatan</option>
              {master.placements.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <select value={filterInstansi} onChange={e => setFilterInstansi(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none max-w-[170px]">
              <option value="">Semua Instansi</option>
              {master.institutions.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
            </select>
            <button
              onClick={() => setOnlyExpiring(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-colors ${
                onlyExpiring ? 'bg-red-50 border-red-200 text-red-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={14} /> H-14
            </button>
            <button
              onClick={() => setIncludeInactive(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-colors ${
                includeInactive ? 'bg-slate-900 border-slate-900 text-white font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <UserMinus size={14} /> Termasuk Keluar
            </button>
            <button onClick={fetchRows} className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Tabel */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 whitespace-nowrap">Nama</th>
                    <th className="px-3 py-3 whitespace-nowrap">Posisi</th>
                    <th className="px-3 py-3 whitespace-nowrap">Penempatan</th>
                    <th className="px-3 py-3 whitespace-nowrap">Instansi</th>
                    <th className="px-3 py-3 whitespace-nowrap">Tgl Masuk</th>
                    <th className="px-3 py-3 whitespace-nowrap">Status</th>
                    <th className="px-3 py-3 whitespace-nowrap text-center">Thn ke-</th>
                    <th className="px-3 py-3 whitespace-nowrap">Kontrak</th>
                    <th className="px-3 py-3 whitespace-nowrap">Berakhir</th>
                    <th className="px-3 py-3 whitespace-nowrap text-center">Sisa</th>
                    <th className="px-2 py-3 whitespace-nowrap text-center">TTD</th>
                    <th className="px-2 py-3 whitespace-nowrap text-center">SKCK</th>
                    <th className="px-2 py-3 whitespace-nowrap text-center">Formjobs</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={14} className="text-center py-12 text-slate-400">Memuat data...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={14} className="text-center py-12 text-slate-400">Tidak ada data karyawan</td></tr>
                  ) : rows.map(row => (
                    <tr key={row.id} className={`hover:bg-slate-50/70 transition-colors ${!row.is_active ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 whitespace-nowrap">{row.name}</div>
                        <div className="text-xs text-slate-400">{row.employee_id || '-'}</div>
                        {!row.is_active && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-600">
                            Keluar {fmtDate(row.resign_date)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{row.position || '-'}</td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{row.penempatan || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{row.instansi || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{fmtDate(row.join_date)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {row.contract_id ? (
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${TYPE_BADGE[row.contract_type]}`}>
                            {TYPE_LABELS[row.contract_type]}
                          </span>
                        ) : <span className="text-xs text-slate-400 italic">Belum ada</span>}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {row.pkwt_year
                          ? <span className="text-xs font-semibold text-slate-700">Tahun ke-{row.pkwt_year}</span>
                          : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                        {row.duration_months ? `${row.duration_months} Bulan` : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{row.contract_type === 'PKWTT' ? <span className="text-slate-300">-</span> : fmtDate(row.end_date)}</td>
                      <td className="px-3 py-3 text-center whitespace-nowrap"><RemainingBadge row={row} /></td>
                      <td className="px-2 py-3">
                        <CheckCell checked={!!row.is_signed} disabled={!row.contract_id}
                          title="TTD Kontrak" onToggle={() => toggleCheck(row, 'is_signed')} />
                      </td>
                      <td className="px-2 py-3">
                        <CheckCell checked={!!row.has_skck} title="SKCK" onToggle={() => toggleCheck(row, 'has_skck')} />
                      </td>
                      <td className="px-2 py-3">
                        <CheckCell checked={!!row.has_formjobs} title="Formjobs" onToggle={() => toggleCheck(row, 'has_formjobs')} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {row.contract_id ? (
                            <button onClick={() => openContractModal(row, 'renew')} title="Perpanjang kontrak"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50">
                              <RefreshCw size={15} />
                            </button>
                          ) : (
                            <button onClick={() => openContractModal(row, 'new')} title="Buat kontrak"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50">
                              <Plus size={15} />
                            </button>
                          )}
                          {row.contract_id && (
                            <button onClick={() => openContractModal(row, 'edit')} title="Koreksi kontrak"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                              <Pencil size={15} />
                            </button>
                          )}
                          <button onClick={() => openHistory(row)} title="Riwayat kontrak"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                            <History size={15} />
                          </button>
                          <button onClick={() => openEmployment(row)} title="Data kepegawaian"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                            <Users size={15} />
                          </button>
                          {row.is_active ? (
                            <button onClick={() => { setTermForm({ resign_date: todayISO(), resign_reason: 'resign', resign_note: '' }); setTerminateModal(row); }}
                              title="Tandai keluar" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                              <UserMinus size={15} />
                            </button>
                          ) : (
                            <button onClick={() => handleReactivate(row)} title="Aktifkan kembali"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50">
                              <UserCheck size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Modal Kontrak ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {contractModal && (
          <Modal onClose={() => setContractModal(null)}
            title={contractModal.mode === 'renew' ? 'Perpanjang Kontrak' : contractModal.mode === 'edit' ? 'Koreksi Kontrak' : 'Buat Kontrak Baru'}
            subtitle={contractModal.row.name}>
            <form onSubmit={handleSaveContract} className="space-y-4">
              {contractModal.mode === 'renew' && contractModal.row.end_date && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-800">
                  Kontrak berjalan berakhir <b>{fmtDateLong(contractModal.row.end_date)}</b>.
                  Histori kontrak lama tetap tersimpan.
                </div>
              )}

              <Field label="Jenis Kontrak">
                <div className="grid grid-cols-3 gap-2">
                  {['PKWT', 'PKWTT', 'DAILY_WORKER'].map(t => (
                    <button key={t} type="button" onClick={() => setForm(f => ({ ...f, contract_type: t }))}
                      className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                        form.contract_type === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}>
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </Field>

              {form.contract_type === 'PKWT' && (
                <Field label="Durasi Kontrak">
                  <div className="grid grid-cols-3 gap-2">
                    {(master.durations || [3, 6, 12]).map(d => (
                      <button key={d} type="button" onClick={() => setForm(f => ({ ...f, duration_months: d }))}
                        className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                          Number(form.duration_months) === d ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}>
                        {d} Bulan
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="Tanggal Mulai Kontrak">
                <input type="date" required value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </Field>

              {/* Hasil hitungan sistem — tidak bisa diinput manual */}
              {form.contract_type === 'PKWT' && previewEndDate && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Tanggal Berakhir</span>
                    <span className="font-semibold text-slate-900">{fmtDateLong(previewEndDate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Tahun PKWT</span>
                    <span className="font-semibold text-slate-900">
                      {contractModal.mode === 'edit'
                        ? (contractModal.row.pkwt_year ? `Tahun ke-${contractModal.row.pkwt_year}` : 'Dihitung sistem')
                        : 'Dihitung otomatis saat disimpan'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1">Kedua nilai di atas dihitung otomatis oleh sistem.</p>
                </div>
              )}

              <Field label="Catatan (opsional)">
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Catatan kontrak..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </Field>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_signed}
                  onChange={e => setForm(f => ({ ...f, is_signed: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300" />
                <span className="text-sm text-slate-600">Kontrak sudah ditandatangani</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setContractModal(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Modal Riwayat ─────────────────────────────────────────────────── */}
        {historyModal && (
          <Modal onClose={() => setHistoryModal(null)} title="Riwayat Kontrak" subtitle={historyModal.employee?.name} wide>
            {historyModal.loading ? (
              <div className="text-center py-8 text-slate-400 text-sm">Memuat riwayat...</div>
            ) : historyModal.history.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Belum ada riwayat kontrak</div>
            ) : (
              <div className="space-y-2">
                {historyModal.history.map((h, idx) => (
                  <div key={h.id} className={`border rounded-xl p-3 ${idx === 0 ? 'border-slate-900/20 bg-slate-50' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-400">#{h.sequence_no}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${TYPE_BADGE[h.contract_type]}`}>
                            {TYPE_LABELS[h.contract_type]}
                          </span>
                          {h.pkwt_year && <span className="text-xs font-medium text-slate-600">Tahun ke-{h.pkwt_year}</span>}
                          {h.duration_months && <span className="text-xs text-slate-500">{h.duration_months} Bulan</span>}
                          {idx === 0 && <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-900 text-white">TERKINI</span>}
                        </div>
                        <div className="text-sm text-slate-600 mt-1.5">
                          {fmtDate(h.start_date)} — {h.end_date ? fmtDate(h.end_date) : 'Tanpa batas'}
                        </div>
                        {h.note && <div className="text-xs text-slate-400 mt-1 truncate">{h.note}</div>}
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <div className="text-[11px] font-medium text-slate-500 capitalize">{h.status}</div>
                        {h.is_signed
                          ? <div className="text-[11px] text-emerald-600 flex items-center gap-1 justify-end"><CheckCircle2 size={11} /> TTD</div>
                          : <div className="text-[11px] text-slate-400">Belum TTD</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}

        {/* ── Modal Data Kepegawaian ────────────────────────────────────────── */}
        {employmentModal && (
          <Modal onClose={() => setEmploymentModal(null)} title="Data Kepegawaian" subtitle={employmentModal.name}>
            <form onSubmit={handleSaveEmployment} className="space-y-4">
              <Field label="Posisi">
                <input list="position-options" value={empForm.position}
                  onChange={e => setEmpForm(f => ({ ...f, position: e.target.value }))}
                  placeholder="Posisi karyawan"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                <datalist id="position-options">
                  {(master.positions || []).map(p => <option key={p} value={p} />)}
                </datalist>
              </Field>

              <Field label="Penempatan">
                <select value={empForm.penempatan}
                  onChange={e => {
                    const name = e.target.value;
                    // Instansi ikut terisi otomatis dari master penempatan
                    const match = master.placements.find(p => p.name === name);
                    setEmpForm(f => ({ ...f, penempatan: name, instansi: match?.instansi || f.instansi }));
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none">
                  <option value="">— Pilih Penempatan —</option>
                  {master.placements.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </Field>

              <Field label="Instansi">
                <select value={empForm.instansi} onChange={e => setEmpForm(f => ({ ...f, instansi: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none">
                  <option value="">— Pilih Instansi —</option>
                  {master.institutions.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
              </Field>

              <Field label="Tanggal Masuk">
                <input type="date" value={empForm.join_date}
                  onChange={e => setEmpForm(f => ({ ...f, join_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </Field>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={empForm.has_skck}
                    onChange={e => setEmpForm(f => ({ ...f, has_skck: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300" />
                  <span className="text-sm text-slate-600">SKCK</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={empForm.has_formjobs}
                    onChange={e => setEmpForm(f => ({ ...f, has_formjobs: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300" />
                  <span className="text-sm text-slate-600">Formjobs</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEmploymentModal(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Modal Tambah Karyawan: cari dulu, baru daftar ─────────────────── */}
        {addModal?.step === 'search' && (
          <Modal onClose={() => setAddModal(null)} title="Tambah Karyawan ke Kontrak"
            subtitle="Cari karyawan yang sudah terdaftar, atau daftarkan yang baru">
            <EmployeeSearch
              onPick={pickExistingEmployee}
              onCreateNew={(name) => {
                setNewForm(f => ({ ...f, name }));
                setAddModal({ step: 'form' });
              }}
            />
          </Modal>
        )}

        {/* ── Modal Daftar Karyawan Baru + Kontrak Pertama ──────────────────── */}
        {addModal?.step === 'form' && (
          <Modal onClose={() => setAddModal(null)} title="Daftarkan Karyawan Baru"
            subtitle="Akun karyawan, email aktivasi, dan kontrak pertama dibuat sekaligus" wide>
            <form onSubmit={handleSaveNewEmployee} className="space-y-4">
              {/* Data karyawan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nama Lengkap *">
                  <input required value={newForm.name}
                    onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nama karyawan"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </Field>
                <Field label="Email *">
                  <input required type="email" value={newForm.email}
                    onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@perusahaan.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </Field>
                <Field label="No. HP">
                  <input value={newForm.phone}
                    onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </Field>
                <Field label="ID Karyawan / NIK">
                  <input value={newForm.employee_id}
                    onChange={e => setNewForm(f => ({ ...f, employee_id: e.target.value }))}
                    placeholder="Opsional"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </Field>
                <Field label="Posisi">
                  <input list="new-position-options" value={newForm.position}
                    onChange={e => setNewForm(f => ({ ...f, position: e.target.value }))}
                    placeholder="Posisi karyawan"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                  <datalist id="new-position-options">
                    {(master.positions || []).map(p => <option key={p} value={p} />)}
                  </datalist>
                </Field>
                <Field label="Tanggal Masuk *">
                  <input required type="date" value={newForm.join_date}
                    onChange={e => setNewForm(f => ({ ...f, join_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </Field>
                <Field label="Penempatan">
                  <select value={newForm.penempatan}
                    onChange={e => {
                      const name = e.target.value;
                      const match = master.placements.find(p => p.name === name);
                      setNewForm(f => ({ ...f, penempatan: name, instansi: match?.instansi || f.instansi }));
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none">
                    <option value="">— Pilih Penempatan —</option>
                    {master.placements.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Instansi">
                  <select value={newForm.instansi}
                    onChange={e => setNewForm(f => ({ ...f, instansi: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none">
                    <option value="">— Pilih Instansi —</option>
                    {master.institutions.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                  </select>
                </Field>
              </div>

              {/* Kontrak pertama */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-slate-700">Status Hubungan Kerja</p>

                <Field label="Jenis Kontrak">
                  <div className="grid grid-cols-3 gap-2">
                    {['PKWT', 'PKWTT', 'DAILY_WORKER'].map(t => (
                      <button key={t} type="button" onClick={() => setNewForm(f => ({ ...f, contract_type: t }))}
                        className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                          newForm.contract_type === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}>
                        {TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </Field>

                {newForm.contract_type === 'PKWT' && (
                  <Field label="Durasi Kontrak">
                    <div className="grid grid-cols-3 gap-2">
                      {(master.durations || [3, 6, 12]).map(d => (
                        <button key={d} type="button" onClick={() => setNewForm(f => ({ ...f, duration_months: d }))}
                          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                            Number(newForm.duration_months) === d ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}>
                          {d} Bulan
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                <Field label="Tanggal Mulai Kontrak">
                  <input type="date" value={newForm.start_date || newForm.join_date}
                    onChange={e => setNewForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                  <p className="text-[11px] text-slate-400 mt-1">Kosongkan untuk mengikuti tanggal masuk kerja.</p>
                </Field>

                {newForm.contract_type === 'PKWT' && newPreviewEnd && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Tanggal Berakhir</span>
                      <span className="font-semibold text-slate-900">{fmtDateLong(newPreviewEnd)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Tahun PKWT</span>
                      <span className="font-semibold text-slate-900">Tahun ke-1</span>
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1">Dihitung otomatis oleh sistem.</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newForm.is_signed}
                      onChange={e => setNewForm(f => ({ ...f, is_signed: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300" />
                    <span className="text-sm text-slate-600">Sudah TTD kontrak</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newForm.has_skck}
                      onChange={e => setNewForm(f => ({ ...f, has_skck: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300" />
                    <span className="text-sm text-slate-600">SKCK</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newForm.has_formjobs}
                      onChange={e => setNewForm(f => ({ ...f, has_formjobs: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300" />
                    <span className="text-sm text-slate-600">Formjobs</span>
                  </label>
                </div>
              </div>

              {/* Aktivasi akun */}
              <label className="flex items-start gap-2 cursor-pointer bg-blue-50 border border-blue-200 rounded-xl p-3">
                <input type="checkbox" checked={newForm.send_invitation}
                  onChange={e => setNewForm(f => ({ ...f, send_invitation: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 mt-0.5" />
                <span className="text-xs text-blue-900">
                  <b className="flex items-center gap-1.5"><Mail size={13} /> Kirim email aktivasi akun</b>
                  <span className="block mt-0.5 text-blue-700">
                    Karyawan menerima tautan untuk membuat kata sandi dan langsung bisa absensi.
                    Karyawan ini otomatis muncul juga di menu Karyawan.
                  </span>
                </span>
              </label>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setAddModal({ step: 'search' })}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                  Kembali
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Daftarkan Karyawan & Kontrak'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Modal Karyawan Keluar ─────────────────────────────────────────── */}
        {terminateModal && (
          <Modal onClose={() => setTerminateModal(null)} title="Tandai Karyawan Keluar" subtitle={terminateModal.name}>
            <form onSubmit={handleTerminate} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                Karyawan akan dinonaktifkan dan dihitung sebagai <b>turn over</b> pada rekap tahunan.
                Riwayat kontraknya tetap tersimpan.
              </div>

              <Field label="Tanggal Keluar">
                <input type="date" required value={termForm.resign_date}
                  onChange={e => setTermForm(f => ({ ...f, resign_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </Field>

              <Field label="Alasan Keluar">
                <select value={termForm.resign_reason}
                  onChange={e => setTermForm(f => ({ ...f, resign_reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none">
                  {RESIGN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>

              <Field label="Catatan (opsional)">
                <input value={termForm.resign_note}
                  onChange={e => setTermForm(f => ({ ...f, resign_note: e.target.value }))}
                  placeholder="Keterangan tambahan..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </Field>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setTerminateModal(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Kolom cari karyawan ───────────────────────────────────────────────────────
// HR mengetik nama, sistem menawarkan karyawan yang SUDAH terdaftar supaya
// kontrak selalu terkait ke akun sungguhan (bukan nama teks bebas, yang akan
// membuat data ganda dan merusak rekap turn over serta reminder H-14).
// Kalau tidak ketemu, HR ditawari mendaftarkan orang itu sebagai karyawan baru.
function EmployeeSearch({ onPick, onCreateNew }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/contracts/search-employees', { params: { q: q || undefined } });
        setResults(data.employees || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setTouched(true);
      }
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Ketik nama, email, atau NIK karyawan..."
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      </div>

      <div className="max-h-72 overflow-y-auto space-y-1.5">
        {loading && <div className="text-center py-6 text-slate-400 text-sm">Mencari...</div>}

        {!loading && results.map(emp => (
          <button
            key={emp.id}
            type="button"
            onClick={() => onPick(emp)}
            className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-900/20 hover:bg-slate-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
              {emp.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 text-sm truncate">{emp.name}</div>
              <div className="text-xs text-slate-500 truncate">
                {emp.employee_id ? `${emp.employee_id} · ` : ''}{emp.email}
              </div>
              {emp.penempatan && <div className="text-[11px] text-slate-400 truncate">{emp.penempatan}</div>}
            </div>
            <div className="flex-shrink-0 text-right">
              {emp.has_contract ? (
                <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${TYPE_BADGE[emp.contract_type]}`}>
                  {TYPE_LABELS[emp.contract_type]}
                  {emp.pkwt_year ? ` · Thn ${emp.pkwt_year}` : ''}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                  Belum ada kontrak
                </span>
              )}
            </div>
          </button>
        ))}

        {!loading && touched && results.length === 0 && (
          <div className="text-center py-6 text-slate-400 text-sm">
            {q ? `Tidak ada karyawan cocok dengan "${q}"` : 'Belum ada karyawan aktif'}
          </div>
        )}
      </div>

      {/* Jalan keluar kalau orangnya memang belum terdaftar */}
      <button
        type="button"
        onClick={() => onCreateNew(q.trim())}
        className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:border-slate-900/30 hover:bg-slate-50 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
          <UserPlus size={16} />
        </div>
        <div className="flex-1 text-left">
          <div className="font-medium text-slate-900 text-sm">
            {q.trim() ? `Daftarkan "${q.trim()}" sebagai karyawan baru` : 'Daftarkan karyawan baru'}
          </div>
          <div className="text-xs text-slate-500">Buat akun + kontrak pertama sekaligus</div>
        </div>
        <CornerDownLeft size={15} className="text-slate-400 flex-shrink-0" />
      </button>
    </div>
  );
}

// ── Komponen bantu ────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, subtitle, children, onClose, wide }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
        onClick={e => e.stopPropagation()}
        className={`bg-white rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}
