import { useState, useEffect, useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Edit, Trash2, X, User, Mail, Phone, Building, Briefcase, Calendar, AlertTriangle, ChevronDown, ChevronRight, ChevronLeft, MailCheck, Copy, CheckCircle2, Check, Send } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { FEATURES } from '../../constants/features';

const CONTRACT_TYPES = [
  { key: 'PKWT', label: 'PKWT' },
  { key: 'PKWTT', label: 'PKWTT' },
  { key: 'DAILY_WORKER', label: 'Daily Worker' },
];

const todayISO = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Role yang dihitung sebagai karyawan biasa. 'gm' & 'spv' hanya penanda jabatan
// struktural untuk approval — aksesnya sama dengan 'employee', bukan admin.
// Harus sinkron dengan EMPLOYEE_ROLES di backend/src/constants/roles.js
const EMPLOYEE_ROLES = ['employee', 'gm', 'spv'];
const ROLE_LABELS = {
  employee: 'Karyawan', gm: 'General Manager', spv: 'SPV/PIC',
  hrd: 'HRD', admin: 'Admin', superadmin: 'Superadmin',
};

// Satu sumber nilai awal form supaya reset di tombol tambah, setelah simpan,
// dan saat batal edit tidak pernah berbeda isinya.
const emptyForm = () => ({
  name: '', email: '', password: '', phone: '', role: 'employee', department: '',
  position: '', employee_id: '', join_date: todayISO(), manager_id: '',
  send_invitation: true, location_id: '',
  // Status hubungan kerja — sebelumnya diisi lewat form terpisah di menu
  // Status Hubungan Kerja; sekarang jadi satu supaya tidak ada data ganda.
  penempatan: '', instansi: '', has_skck: false, has_formjobs: false,
  contract_type: 'PKWT', duration_months: 6, start_date: '', note: '', is_signed: false,
});

export default function EmployeesAdmin() {
  // Kalau URL-nya /admin/employees/:department (dari submenu sidebar), halaman
  // langsung menampilkan daftar karyawan divisi itu tanpa accordion.
  const { department: deptParam } = useParams();
  const activeDept = deptParam ? decodeURIComponent(deptParam) : null;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [quotaModal, setQuotaModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [managers, setManagers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [quotaForm, setQuotaForm] = useState({ total_days: 12, year: new Date().getFullYear() });
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [expandedDept, setExpandedDept] = useState({});
  const [deptSearch, setDeptSearch] = useState({});
  const [saving, setSaving] = useState(false);
  // Master penempatan & instansi dipakai bagian status hubungan kerja di form.
  const [master, setMaster] = useState({ placements: [], institutions: [], durations: [3, 6, 12] });
  // Ditampilkan kalau email aktivasi tidak dikirim / gagal terkirim — tanpa ini
  // karyawan tidak punya cara masuk sama sekali.
  const [activationModal, setActivationModal] = useState(null);
  const [copied, setCopied] = useState(false);
  // Tambah departemen/jabatan langsung dari form karyawan supaya HR tidak perlu
  // keluar ke menu Departemen & Jabatan hanya untuk membuat satu entri baru.
  // null = dropdown biasa, string = sedang mengetik nama baru.
  const [newDept, setNewDept] = useState(null);
  const [newPos, setNewPos] = useState(null);
  const [savingMaster, setSavingMaster] = useState(false);

  useEffect(() => { fetchUsers(); fetchManagers(); fetchDepartments(); fetchLocations(); }, [locationFilter]);
  useEffect(() => { fetchMaster(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = `/users?role=${EMPLOYEE_ROLES.join(',')}&limit=1000${locationFilter ? `&location_id=${locationFilter}` : ''}`;
      const { data } = await api.get(url);
      setUsers(data.users);
    } catch {} finally { setLoading(false); }
  };

  const fetchManagers = async () => {
    try {
      const { data } = await api.get('/users?limit=1000');
      // GM & SPV/PIC ikut jadi kandidat atasan — itu memang alasan role-nya ada,
      // walaupun aksesnya setara karyawan biasa.
      setManagers(data.users.filter(u =>
        ['superadmin','admin','hrd','gm','spv'].includes(u.role) ||
        (Array.isArray(u.permissions) && u.permissions.length > 0)
      ));
    } catch {}
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get('/departments/all');
      setDepartments(data.departments);
    } catch {}
  };

  const fetchLocations = async () => {
    try {
      const { data } = await api.get('/attendance/locations');
      setLocations(data.locations || []);
    } catch {}
  };

  const fetchMaster = async () => {
    try {
      const { data } = await api.get('/contracts/master');
      setMaster(m => ({ ...m, ...data }));
    } catch {}
  };

  // Preview tanggal berakhir kontrak. Rumusnya sama persis dengan backend
  // (mulai + durasi bulan - 1 hari); yang disimpan tetap hasil hitungan server.
  const previewEndDate = useMemo(() => {
    const start = form.start_date || form.join_date;
    if (form.contract_type !== 'PKWT' || !start || !form.duration_months) return null;
    const [y, m, d] = start.split('-').map(Number);
    const dueIdx = (m - 1) + Number(form.duration_months);
    const dueYear = y + Math.floor(dueIdx / 12);
    const dueMonth = dueIdx % 12;
    const daysInDue = new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate();
    if (d > daysInDue) return new Date(Date.UTC(dueYear, dueMonth, daysInDue)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(dueYear, dueMonth, d));
    end.setUTCDate(end.getUTCDate() - 1);
    return end.toISOString().slice(0, 10);
  }, [form.contract_type, form.start_date, form.join_date, form.duration_months]);

  const fmtDateLong = (d) => d
    ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '-';

  // Posisi yang tersedia berdasarkan departemen yang dipilih
  const selectedDept = departments.find(d => d.name === form.department);
  const availablePositions = selectedDept?.positions?.filter(p => p.is_active) || [];

  // Form tambah cepat selalu bersih tiap modal karyawan dibuka/ditutup.
  useEffect(() => { setNewDept(null); setNewPos(null); }, [showModal]);

  // Simpan departemen baru lalu langsung pilih di form (jabatan direset karena
  // departemen baru belum punya jabatan sama sekali).
  const handleCreateDept = async () => {
    const name = (newDept || '').trim();
    if (!name) return;
    setSavingMaster(true);
    try {
      await api.post('/departments', { name });
      await fetchDepartments();
      setForm(f => ({ ...f, department: name, position: '' }));
      setNewDept(null);
      setNewPos(null);
      toast.success('Departemen berhasil ditambahkan');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambah departemen');
    } finally {
      setSavingMaster(false);
    }
  };

  // Posisi baru selalu menempel ke departemen yang sedang dipilih.
  const handleCreatePos = async () => {
    const name = (newPos || '').trim();
    if (!name || !selectedDept) return;
    setSavingMaster(true);
    try {
      await api.post('/departments/positions', { department_id: selectedDept.id, name });
      await fetchDepartments();
      setForm(f => ({ ...f, position: name }));
      setNewPos(null);
      toast.success('Posisi berhasil ditambahkan');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambah posisi');
    } finally {
      setSavingMaster(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, form);
        if (EMPLOYEE_ROLES.includes(form.role)) {
          await api.put(`/users/${editUser.id}/permissions`, { feature_keys: permissions });
        }
        toast.success('Data karyawan berhasil diperbarui');
      } else {
        // Create user with avatar upload
        const payload = {
          ...form,
          // Tanggal mulai kontrak default mengikuti tanggal bergabung.
          start_date: form.start_date || form.join_date,
          duration_months: form.contract_type === 'PKWT' ? Number(form.duration_months) : '',
        };
        const formData = new FormData();
        Object.keys(payload).forEach(key => {
          const val = payload[key];
          // Boolean false tetap harus dikirim (mis. send_invitation dimatikan),
          // sedangkan string kosong / null diabaikan agar kolomnya NULL di DB.
          if (typeof val === 'boolean') { formData.append(key, val ? 'true' : 'false'); return; }
          if (val !== null && val !== undefined && val !== '') formData.append(key, val);
        });
        if (avatarFile) {
          formData.append('avatar', avatarFile);
        }

        const { data } = await api.post('/users', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(data.message || 'Karyawan berhasil ditambahkan');

        // Kalau email tidak dikirim (atau gagal), tautan aktivasi wajib
        // ditampilkan supaya HR bisa membagikannya manual.
        if (!data.email_sent && data.activation_link) {
          setActivationModal({
            name: form.name,
            email: form.email,
            link: data.activation_link,
            failed: form.send_invitation, // diminta kirim tapi tetap gagal
          });
        }
      }
      setShowModal(false);
      setEditUser(null);
      setForm(emptyForm());
      setAvatarFile(null);
      setAvatarPreview(null);
      setPermissions([]);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  // Kirim ulang tautan aktivasi untuk karyawan yang belum membuat kata sandi.
  // Token lama otomatis batal, yang baru berlaku 7 hari.
  const handleResendActivation = async (user, sendEmail) => {
    try {
      const { data } = await api.post(`/contracts/resend-activation/${user.id}`, { send_email: sendEmail });
      toast.success(data.message);
      if (!data.email_sent && data.activation_link) {
        setActivationModal({ name: user.name, email: user.email, link: data.activation_link, failed: sendEmail });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim ulang aktivasi');
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Tautan disalin');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API butuh HTTPS/localhost — kalau ditolak, tautannya tetap
      // tampil sebagai teks sehingga masih bisa disalin manual.
      toast.error('Gagal menyalin otomatis. Silakan salin manual dari kotak tautan.');
    }
  };

  const handleDeactivate = async () => {
    try {
      await api.delete(`/users/${deleteModal.id}`);
      toast.success('Karyawan berhasil dinonaktifkan');
      setDeleteModal(null);
      fetchUsers();
    } catch (err) {
      toast.error('Gagal menonaktifkan karyawan');
    }
  };

  const handlePermanentDelete = async () => {
    try {
      await api.delete(`/users/${deleteModal.id}/permanent`);
      toast.success('Karyawan berhasil dihapus permanen');
      setDeleteModal(null);
      fetchUsers();
    } catch (err) {
      toast.error('Gagal menghapus karyawan');
    }
  };

  const handleUpdateQuota = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/leave/quota/${quotaModal.id}`, quotaForm);
      toast.success('Jatah cuti berhasil diperbarui');
      setQuotaModal(null);
      fetchUsers();
    } catch (err) {
      toast.error('Gagal memperbarui jatah cuti');
    }
  };

  const openEdit = (user) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, password: '', phone: user.phone || '', role: user.role, department: user.department || '', position: user.position || '', employee_id: user.employee_id || '', join_date: user.join_date?.split('T')[0] || '', manager_id: user.manager_id || '', send_invitation: false, location_id: user.location_id || '' });
    setAvatarFile(null);
    setAvatarPreview(null);
    setPermissions([]);
    setShowModal(true);
    // Refresh lokasi & manager agar tidak ada opsi usang yang sudah dihapus di database
    fetchLocations();
    fetchManagers();
    fetchPermissions(user.id);
  };

  const fetchPermissions = async (userId) => {
    try {
      const { data } = await api.get(`/users/${userId}/permissions`);
      setPermissions(data.permissions || []);
    } catch {}
  };

  const togglePermission = (key) => {
    setPermissions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 5MB');
        return;
      }
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error('Hanya file gambar yang diizinkan');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const filtered = users.filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.employee_id?.toLowerCase().includes(search.toLowerCase()));

  const groupedByDept = useMemo(() => {
    const byDept = filtered.reduce((acc, u) => {
      const dept = u.department || 'Tanpa Departemen';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(u);
      return acc;
    }, {});
    const groups = Object.entries(byDept)
      .map(([department, members]) => ({ department, members }))
      .sort((a, b) => a.department.localeCompare(b.department));

    // Mode satu divisi: hanya tampilkan divisi dari URL. Divisi yang belum
    // punya karyawan tetap dirender (grup kosong) supaya tidak terlihat
    // seperti halaman rusak saat diklik dari sidebar.
    if (activeDept) {
      const found = groups.find(g => g.department === activeDept);
      return [found || { department: activeDept, members: [] }];
    }
    return groups;
  }, [filtered, activeDept]);

  // Saat mencari, otomatis buka departemen yang punya hasil match
  useEffect(() => {
    if (!search) return;
    setExpandedDept(prev => {
      const next = { ...prev };
      groupedByDept.forEach(d => { next[d.department] = true; });
      return next;
    });
  }, [search, groupedByDept]);

  // Divisi yang dipilih dari sidebar langsung terbuka — itu inti dari submenu.
  useEffect(() => {
    if (activeDept) setExpandedDept(prev => ({ ...prev, [activeDept]: true }));
  }, [activeDept]);

  // Landing /admin/employees tidak lagi menampilkan kartu departemen — pilihan
  // divisi ada di sidebar. Pencarian tetap boleh menembus semua divisi supaya
  // HR masih bisa mencari nama tanpa tahu divisinya.
  const showDeptPicker = !activeDept && !search.trim();

  const toggleDept = (dept) => setExpandedDept(prev => ({ ...prev, [dept]: !prev[dept] }));
  const setDeptSearchValue = (dept, value) => setDeptSearch(prev => ({ ...prev, [dept]: value }));

  return (
    <div className="space-y-4">
      {/* Breadcrumb kembali — hanya saat sedang melihat satu divisi */}
      {activeDept && (
        <Link to="/admin/employees"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
          <ChevronLeft size={15} /> Semua Departemen
        </Link>
      )}

      {/* Header Actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-1 flex-wrap gap-3 items-center min-w-48">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder={activeDept ? `Cari karyawan di ${activeDept}...` : 'Cari karyawan...'} value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9 py-2.5 text-sm" />
          </div>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="input-field py-2.5 px-3 text-sm max-w-xs"
          >
            <option value="">Semua Lokasi Penempatan</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <button onClick={() => { setEditUser(null); setForm({ ...emptyForm(), department: activeDept || '' }); setAvatarFile(null); setAvatarPreview(null); setPermissions([]); setShowModal(true); }}
          className="btn-primary py-2.5 flex items-center gap-2 text-sm">
          <Plus size={16} /> Tambah Karyawan
        </button>
      </div>

      {/* Grouped per departemen (accordion) */}
      <div className="space-y-3">
        {loading ? (
          <div className="card text-center py-8 text-slate-400">Memuat data...</div>
        ) : showDeptPicker ? (
          /* Tanpa divisi terpilih & tanpa pencarian: daftar karyawan sengaja
             tidak ditampilkan — pemilihan divisi dilakukan lewat submenu
             "Karyawan" di sidebar. */
          <div className="card text-center py-16 px-6">
            <div className="w-14 h-14 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <Building size={24} className="text-slate-400" />
            </div>
            <div className="font-semibold text-slate-900 text-sm">Pilih departemen dulu</div>
            <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">
              Buka submenu <span className="font-medium text-slate-500">Karyawan</span> di sidebar,
              lalu pilih departemen untuk melihat daftar karyawannya. Bisa juga langsung ketik nama
              di kolom pencarian di atas.
            </p>
          </div>
        ) : groupedByDept.length === 0 ? (
          <div className="card text-center py-8 text-slate-400">Tidak ada karyawan</div>
        ) : (
          groupedByDept.map(({ department, members }) => {
            // Di mode satu divisi header tidak bisa ditutup — tidak ada gunanya
            // menyembunyikan satu-satunya tabel di halaman.
            const isOpen = activeDept ? true : !!expandedDept[department];
            const activeCount = members.filter(m => m.is_active).length;
            const deptQuery = (deptSearch[department] || '').toLowerCase();
            const visibleMembers = deptQuery
              ? members.filter(m => m.name?.toLowerCase().includes(deptQuery) || m.email?.toLowerCase().includes(deptQuery) || m.employee_id?.toLowerCase().includes(deptQuery) || m.position?.toLowerCase().includes(deptQuery))
              : members;
            return (
              <div key={department} className="card overflow-hidden">
                <button onClick={() => { if (!activeDept) toggleDept(department); }}
                  disabled={!!activeDept}
                  className={`w-full flex items-center gap-3 p-4 transition-colors text-left ${activeDept ? 'cursor-default' : 'hover:bg-slate-50'}`}>
                  {!activeDept && (isOpen
                    ? <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />
                    : <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />)}
                  <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building size={18} className="text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 text-sm">{department}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{members.length} karyawan</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-xs flex-shrink-0">
                    <span className="badge-success">{activeCount} Aktif</span>
                    {activeCount < members.length && <span className="badge-danger">{members.length - activeCount} Nonaktif</span>}
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-slate-100">
                      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative max-w-xs">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input placeholder={`Cari di ${department}...`} value={deptSearch[department] || ''}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setDeptSearchValue(department, e.target.value)}
                            className="input-field pl-8 py-1.5 text-xs" />
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              {['Karyawan', 'ID', 'Posisi', 'Penempatan', 'Jatah Cuti', 'Status', 'Aksi'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {visibleMembers.length === 0 ? (
                              <tr><td colSpan={7} className="text-center py-6 text-slate-400 text-sm">Tidak ada karyawan yang cocok</td></tr>
                            ) : visibleMembers.map((user) => (
                              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-500 rounded-lg flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                                      {user.avatar
                                        ? <img
                                            src={user.avatar.startsWith('http') ? user.avatar : `/uploads/avatar/${user.avatar}`}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = `<span class="text-white font-bold text-sm">${user.name?.[0] || '?'}</span>`; }}
                                          />
                                        : user.name?.[0]
                                      }
                                    </div>
                                    <div>
                                      <div className="font-medium text-slate-900 text-sm">{user.name}</div>
                                      <div className="text-xs text-slate-500">{user.email}</div>
                                      {user.position && (
                                        <div className="text-xs text-slate-400 mt-0.5">{user.position}</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">{user.employee_id || '-'}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{user.position || '-'}</td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-600">
                                  <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                                    📍 {user.location_name || 'Belum di-assign'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <button onClick={() => { setQuotaModal(user); setQuotaForm({ total_days: user.total_days || 12, year: new Date().getFullYear() }); }}
                                    className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline">
                                    {user.remaining_days ?? '-'} / {user.total_days ?? 12} hari
                                  </button>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={user.is_active ? 'badge-success' : 'badge-danger'}>{user.is_active ? 'Aktif' : 'Nonaktif'}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    {/* Karyawan yang belum pernah membuat kata sandi
                                        (is_verified masih false) diberi jalan kirim
                                        ulang tautan aktivasi ke email terdaftarnya. */}
                                    {!user.is_verified && (
                                      <button onClick={() => handleResendActivation(user, true)}
                                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                        title={`Kirim aktivasi ke ${user.email}`}>
                                        <Send size={15} className="text-blue-500" />
                                      </button>
                                    )}
                                    <button onClick={() => openEdit(user)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
                                      <Edit size={15} className="text-slate-500" />
                                    </button>
                                    <button onClick={() => setDeleteModal(user)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                                      <Trash2 size={15} className="text-red-500" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900 text-lg">{editUser ? 'Edit Karyawan' : 'Tambah Karyawan'}</h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {!editUser && (
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-600 mb-2 block">Foto Profil Karyawan</label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0">
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <User size={32} className="text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handleAvatarChange}
                            className="hidden"
                            id="avatar-upload"
                          />
                          <label
                            htmlFor="avatar-upload"
                            className="btn-secondary py-2 px-4 text-sm cursor-pointer inline-block"
                          >
                            Pilih Foto
                          </label>
                          <p className="text-xs text-slate-400 mt-1">Foto ini akan digunakan untuk verifikasi wajah saat absensi</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Nama Lengkap *</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field text-sm" required placeholder="Nama lengkap" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Email *</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field text-sm" required placeholder="email@domain.com" disabled={!!editUser} />
                    {!editUser && <p className="text-xs text-slate-400 mt-1">Email undangan akan dikirim ke alamat ini</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">No. WhatsApp</label>
                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field text-sm" placeholder="08xxxxxxxxxx" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">ID Karyawan</label>
                    <input value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className="input-field text-sm" placeholder="EMP001" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Departemen</label>
                    {newDept === null ? (
                      <select
                        value={form.department}
                        onChange={e => {
                          if (e.target.value === '__new__') { setNewDept(''); return; }
                          setForm({ ...form, department: e.target.value, position: '' });
                        }}
                        className="input-field text-sm"
                      >
                        <option value="">-- Pilih Departemen --</option>
                        {departments.filter(d => d.is_active).map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                        {/* Tampilkan nilai lama jika tidak ada di list */}
                        {form.department && !departments.find(d => d.name === form.department) && (
                          <option value={form.department}>{form.department}</option>
                        )}
                        <option value="__new__">+ Tambah departemen baru...</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={newDept}
                          onChange={e => setNewDept(e.target.value)}
                          onKeyDown={e => {
                            // Enter di sini tidak boleh men-submit form karyawan.
                            if (e.key === 'Enter') { e.preventDefault(); handleCreateDept(); }
                            if (e.key === 'Escape') setNewDept(null);
                          }}
                          className="input-field text-sm flex-1"
                          placeholder="Nama departemen baru"
                        />
                        <button type="button" onClick={handleCreateDept} disabled={savingMaster || !newDept.trim()}
                          className="btn-primary px-3 py-2 text-sm disabled:opacity-50" title="Simpan departemen">
                          <Check size={16} />
                        </button>
                        <button type="button" onClick={() => setNewDept(null)}
                          className="btn-secondary px-3 py-2 text-sm" title="Batal">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Posisi</label>
                    {newPos === null ? (
                      <select
                        value={form.position}
                        onChange={e => {
                          if (e.target.value === '__new__') { setNewPos(''); return; }
                          setForm({ ...form, position: e.target.value });
                        }}
                        className="input-field text-sm"
                        disabled={!form.department}
                      >
                        <option value="">-- Pilih Posisi --</option>
                        {availablePositions.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                        {/* Tampilkan nilai lama jika tidak ada di list */}
                        {form.position && !availablePositions.find(p => p.name === form.position) && (
                          <option value={form.position}>{form.position}</option>
                        )}
                        {/* Hanya departemen terdaftar yang punya id untuk ditempeli jabatan */}
                        {selectedDept && <option value="__new__">+ Tambah posisi baru...</option>}
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={newPos}
                          onChange={e => setNewPos(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); handleCreatePos(); }
                            if (e.key === 'Escape') setNewPos(null);
                          }}
                          className="input-field text-sm flex-1"
                          placeholder={'Posisi baru di ' + form.department}
                        />
                        <button type="button" onClick={handleCreatePos} disabled={savingMaster || !newPos.trim()}
                          className="btn-primary px-3 py-2 text-sm disabled:opacity-50" title="Simpan posisi">
                          <Check size={16} />
                        </button>
                        <button type="button" onClick={() => setNewPos(null)}
                          className="btn-secondary px-3 py-2 text-sm" title="Batal">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    {!form.department && newPos === null && (
                      <p className="text-xs text-slate-400 mt-1">Pilih departemen terlebih dahulu</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Tanggal Bergabung</label>
                    <input type="date" value={form.join_date} onChange={e => setForm({ ...form, join_date: e.target.value })} className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Role</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input-field text-sm">
                      {/* GM & SPV/PIC adalah penanda jabatan struktural: aksesnya
                          tetap setara karyawan, dipakai untuk alur approval. */}
                      <optgroup label="Karyawan">
                        <option value="employee">Karyawan</option>
                        <option value="gm">General Manager</option>
                        <option value="spv">SPV/PIC</option>
                      </optgroup>
                      <optgroup label="Akses Panel Admin">
                        <option value="hrd">HRD</option>
                        <option value="admin">Admin</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Lokasi Penempatan Kerja</label>
                    <select
                      value={form.location_id}
                      onChange={e => setForm({ ...form, location_id: e.target.value })}
                      className="input-field text-sm"
                    >
                      <option value="">-- Pilih Lokasi Penempatan --</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Karyawan harus ter-assign ke lokasi agar dapat melakukan absensi mobile</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Atasan / Manager (untuk multi-level approval)</label>
                  <select value={form.manager_id} onChange={e => setForm({ ...form, manager_id: e.target.value })} className="input-field text-sm">
                    <option value="">Tidak ada atasan</option>
                    {managers
                      .filter(m => m.id !== editUser?.id)
                      .filter(m => !form.department || m.department === form.department)
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role] || m.role})</option>
                      ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Menampilkan akun HRD/Admin, General Manager, SPV/PIC, serta karyawan yang sudah diberi akses, di divisi yang sama{!form.department && ' (pilih divisi karyawan dulu untuk menyaring)'}</p>
                </div>
                {editUser && EMPLOYEE_ROLES.includes(form.role) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <label className="text-xs font-medium text-slate-600 mb-2 block">Kelola Akses (fitur admin yang diberikan)</label>
                    <div className="space-y-2">
                      {FEATURES.map(f => (
                        <label key={f.key} className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={permissions.includes(f.key)}
                            onChange={() => togglePermission(f.key)}
                            className="w-4 h-4 mt-0.5 text-blue-600 rounded"
                          />
                          <span>
                            <span className="text-sm font-medium text-slate-700 block">{f.label}</span>
                            <span className="text-xs text-slate-400">{f.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {/* ── Status Hubungan Kerja ────────────────────────────────
                    Digabung ke sini supaya akun + kontrak pertama dibuat sekali
                    jalan; form tambah karyawan terpisah di menu Status Hubungan
                    Kerja sudah dihapus agar tidak ada data ganda. */}
                {!editUser && (
                  <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Briefcase size={15} className="text-slate-500" />
                      <h4 className="text-sm font-semibold text-slate-800">Status Hubungan Kerja</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Penempatan</label>
                        <select
                          value={form.penempatan}
                          onChange={e => {
                            const name = e.target.value;
                            const match = master.placements.find(pl => pl.name === name);
                            // Instansi ikut terisi otomatis karena satu penempatan
                            // selalu bernaung di bawah instansi yang sama.
                            setForm(f => ({ ...f, penempatan: name, instansi: match?.instansi || f.instansi }));
                          }}
                          className="input-field text-sm"
                        >
                          <option value="">-- Pilih Penempatan --</option>
                          {master.placements.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Instansi</label>
                        <select
                          value={form.instansi}
                          onChange={e => setForm({ ...form, instansi: e.target.value })}
                          className="input-field text-sm"
                        >
                          <option value="">-- Pilih Instansi --</option>
                          {master.institutions.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Jenis Kontrak *</label>
                      <div className="grid grid-cols-3 gap-2">
                        {CONTRACT_TYPES.map(t => (
                          <button key={t.key} type="button"
                            onClick={() => setForm({ ...form, contract_type: t.key })}
                            className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                              form.contract_type === t.key
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.contract_type === 'PKWT' && (
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Durasi Kontrak</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(master.durations || [3, 6, 12]).map(d => (
                            <button key={d} type="button"
                              onClick={() => setForm({ ...form, duration_months: d })}
                              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                                Number(form.duration_months) === d
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                              }`}>
                              {d} Bulan
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Tanggal Mulai Kontrak</label>
                      <input type="date" value={form.start_date || form.join_date}
                        onChange={e => setForm({ ...form, start_date: e.target.value })}
                        className="input-field text-sm" />
                      <p className="text-xs text-slate-400 mt-1">Kosongkan untuk mengikuti tanggal bergabung.</p>
                    </div>

                    {form.contract_type === 'PKWT' && previewEndDate && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Tanggal Berakhir</span>
                          <span className="font-semibold text-slate-900">{fmtDateLong(previewEndDate)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Tahun PKWT</span>
                          <span className="font-semibold text-slate-900">Tahun ke-1</span>
                        </div>
                        <p className="text-xs text-slate-400 pt-1">Dihitung otomatis oleh sistem.</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4">
                      {[
                        { key: 'is_signed', label: 'Sudah TTD kontrak' },
                        { key: 'has_skck', label: 'SKCK' },
                        { key: 'has_formjobs', label: 'Formjobs' },
                      ].map(c => (
                        <label key={c.key} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form[c.key]}
                            onChange={e => setForm({ ...form, [c.key]: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300" />
                          <span className="text-sm text-slate-600">{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {!editUser && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, send_invitation: !form.send_invitation })}
                    aria-pressed={form.send_invitation}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-colors ${
                      form.send_invitation
                        ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      form.send_invitation ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {form.send_invitation ? <MailCheck size={18} /> : <Mail size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${form.send_invitation ? 'text-blue-900' : 'text-slate-700'}`}>
                        {form.send_invitation ? 'Email aktivasi akan dikirim' : 'Email aktivasi tidak dikirim'}
                      </div>
                      <p className={`text-xs mt-0.5 truncate ${form.send_invitation ? 'text-blue-700' : 'text-slate-500'}`}>
                        {form.send_invitation
                          ? `Tautan aktivasi dikirim ke ${form.email || 'email yang didaftarkan'}`
                          : 'Tautan aktivasi ditampilkan untuk dibagikan manual'}
                      </p>
                    </div>
                    {/* Klik ikon = hidupkan/matikan pengiriman email aktivasi */}
                    <div className={`w-10 h-6 rounded-full flex items-center px-0.5 flex-shrink-0 transition-colors ${
                      form.send_invitation ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}>
                      <div className="w-5 h-5 rounded-full bg-white" />
                    </div>
                  </button>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                    {saving ? 'Menyimpan...' : editUser ? 'Simpan Perubahan' : 'Tambah Karyawan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quota Modal */}
      <AnimatePresence>
        {quotaModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setQuotaModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Edit Jatah Cuti</h3>
                <button onClick={() => setQuotaModal(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <p className="text-slate-500 text-sm mb-4">{quotaModal.name}</p>
              <form onSubmit={handleUpdateQuota} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Tahun</label>
                  <input type="number" value={quotaForm.year} onChange={e => setQuotaForm({ ...quotaForm, year: e.target.value })} className="input-field text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Total Hari Cuti</label>
                  <input type="number" value={quotaForm.total_days} onChange={e => setQuotaForm({ ...quotaForm, total_days: e.target.value })} className="input-field text-sm" min={1} max={30} />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setQuotaModal(null)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">Simpan</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Hapus Karyawan</h3>
                  <p className="text-sm text-slate-500">{deleteModal.name}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-5">Pilih tindakan yang ingin dilakukan untuk akun ini:</p>
              <div className="space-y-2.5">
                <button onClick={handleDeactivate}
                  className="w-full text-left px-4 py-3 rounded-2xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors group">
                  <div className="font-medium text-slate-800 text-sm group-hover:text-amber-700">Nonaktifkan Akun</div>
                  <div className="text-xs text-slate-400 mt-0.5">Karyawan tidak bisa login, data tetap tersimpan</div>
                </button>
                <button onClick={handlePermanentDelete}
                  className="w-full text-left px-4 py-3 rounded-2xl border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-colors group">
                  <div className="font-medium text-slate-800 text-sm group-hover:text-red-600">Hapus Permanen</div>
                  <div className="text-xs text-slate-400 mt-0.5">Semua data karyawan akan dihapus dan tidak bisa dikembalikan</div>
                </button>
                <button onClick={() => setDeleteModal(null)}
                  className="w-full px-4 py-2.5 rounded-2xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Kotak Tautan Aktivasi — muncul saat email tidak dikirim atau gagal */}
      <AnimatePresence>
        {activationModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setActivationModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900">Tautan Aktivasi Akun</h3>
                  <p className="text-sm text-slate-500">{activationModal.name} · {activationModal.email}</p>
                </div>
                <button onClick={() => setActivationModal(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>

              <div className={`border rounded-xl px-3 py-2.5 text-xs mb-4 ${
                activationModal.failed
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {activationModal.failed
                  ? <>Email aktivasi <b>gagal terkirim</b>. Bagikan tautan di bawah ini secara manual agar karyawan tetap bisa membuat kata sandi.</>
                  : <>Email aktivasi <b>tidak dikirim</b>. Bagikan tautan di bawah ini ke karyawan (mis. lewat WhatsApp) agar dia bisa membuat kata sandinya sendiri.</>}
              </div>

              <label className="block text-xs font-medium text-slate-500 mb-1.5">Tautan Aktivasi</label>
              <div className="flex gap-2 mb-4">
                <input readOnly value={activationModal.link} onFocus={e => e.target.select()}
                  className="input-field text-xs font-mono flex-1" />
                <button type="button" onClick={() => copyLink(activationModal.link)}
                  className="btn-primary px-3 py-2 text-sm flex items-center gap-1.5 flex-shrink-0">
                  {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-4">Tautan berlaku 7 hari dan hanya bisa dipakai sekali. Kalau kedaluwarsa, pakai tombol kirim aktivasi di baris karyawan.</p>

              <button onClick={() => setActivationModal(null)} className="btn-secondary w-full py-2.5 text-sm">Tutup</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
