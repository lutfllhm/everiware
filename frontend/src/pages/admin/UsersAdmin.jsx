import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Edit, Trash2, X, Shield, Key, ToggleLeft, ToggleRight, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

const roleConfig = {
  superadmin: { label: 'Super Admin', cls: 'bg-red-50 text-red-700 border border-red-200', iconCls: 'bg-red-100 text-red-600', desc: 'Akses penuh ke semua fitur' },
  admin:      { label: 'Admin',       cls: 'bg-slate-100 text-slate-700 border border-slate-200', iconCls: 'bg-slate-200 text-slate-600', desc: 'Kelola karyawan & pengaturan' },
  hrd:        { label: 'HRD',         cls: 'bg-purple-50 text-purple-700 border border-purple-200', iconCls: 'bg-purple-100 text-purple-600', desc: 'Approve cuti & lihat laporan' },
  employee:   { label: 'Karyawan',    cls: 'bg-sky-50 text-sky-700 border border-sky-200', iconCls: 'bg-sky-100 text-sky-600', desc: 'Absensi & pengajuan izin' },
};

export default function UsersAdmin() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showPassModal, setShowPassModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'employee', department: '', position: '', employee_id: '' });

  useEffect(() => { fetchUsers(); }, [roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 999 });
      if (roleFilter) params.append('role', roleFilter);
      const { data } = await api.get(`/users?${params}`);
      setUsers(data.users);
    } catch {} finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, form);
        toast.success('Data user berhasil diperbarui');
      } else {
        if (!form.password) return toast.error('Password wajib diisi');
        await api.post('/users', form);
        toast.success('User berhasil ditambahkan');
      }
      closeModal();
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data');
    }
  };

  const handleToggleActive = async (user) => {
    if (user.id === currentUser?.id) return toast.error('Tidak bisa menonaktifkan akun sendiri');
    try {
      await api.put(`/users/${user.id}`, { ...user, is_active: !user.is_active });
      toast.success(`Akun ${!user.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchUsers();
    } catch { toast.error('Gagal mengubah status akun'); }
  };

  const handleDeactivate = async () => {
    try {
      await api.delete(`/users/${deleteModal.id}`);
      toast.success('Akun berhasil dinonaktifkan');
      setDeleteModal(null);
      fetchUsers();
    } catch (err) {
      toast.error('Gagal menonaktifkan akun');
    }
  };

  const handlePermanentDelete = async () => {
    try {
      await api.delete(`/users/${deleteModal.id}/permanent`);
      toast.success('Akun berhasil dihapus permanen');
      setDeleteModal(null);
      fetchUsers();
    } catch (err) {
      toast.error('Gagal menghapus akun');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPass || newPass.length < 6) return toast.error('Password minimal 6 karakter');
    try {
      await api.put(`/users/${showPassModal.id}`, { ...showPassModal, new_password: newPass });
      toast.success('Password berhasil direset');
      setShowPassModal(null);
      setNewPass('');
    } catch { toast.error('Gagal reset password'); }
  };

  const openEdit = (user) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, password: '', phone: user.phone || '', role: user.role, department: user.department || '', position: user.position || '', employee_id: user.employee_id || '' });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditUser(null); setForm({ name: '', email: '', password: '', phone: '', role: 'employee', department: '', position: '', employee_id: '' }); };

  const filtered = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.employee_id?.includes(search)
  );

  const roleCounts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(roleConfig).map(([key, cfg]) => (
          <div key={key} className={`bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow ${roleFilter === key ? 'ring-2 ring-slate-900' : ''}`}
            onClick={() => setRoleFilter(roleFilter === key ? '' : key)}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconCls}`}>
                <Shield size={16} />
              </div>
              <div className="text-2xl font-bold text-slate-900">{roleCounts[key] || 0}</div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${cfg.cls}`}>{cfg.label}</span>
            <div className="text-xs text-slate-400 mt-1.5">{cfg.desc}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Cari nama, email, ID..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 py-2.5 text-sm" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input-field py-2.5 text-sm w-auto">
            <option value="">Semua Role</option>
            {Object.entries(roleConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        {currentUser?.role === 'superadmin' && (
          <button onClick={() => { closeModal(); setShowModal(true); }} className="btn-primary py-2.5 flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah User
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['User', 'Role', 'Departemen', 'Kontak', 'Status', 'Aksi'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Tidak ada user ditemukan</td></tr>
              ) : filtered.map((u) => {
                const rc = roleConfig[u.role] || roleConfig.employee;
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-700 to-slate-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                          {u.avatar ? <img src={`/uploads/avatar/${u.avatar}`} alt="" className="w-full h-full object-cover" /> : u.name?.[0]}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 text-sm flex items-center gap-1">
                            {u.name} {isSelf && <span className="text-xs text-indigo-500">(Kamu)</span>}
                          </div>
                          <div className="text-xs text-slate-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${rc.cls}`}>{rc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{u.department || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-600">{u.phone || '-'}</div>
                      <div className="text-xs text-slate-400">{u.employee_id || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${u.is_active ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)} title="Edit" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                          <Edit size={14} className="text-slate-500" />
                        </button>
                        <button onClick={() => { setShowPassModal(u); setNewPass(''); }} title="Reset Password" className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors">
                          <Key size={14} className="text-amber-500" />
                        </button>
                        {!isSelf && (
                          <>
                            <button onClick={() => handleToggleActive(u)} title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                              {u.is_active ? <UserX size={14} className="text-red-500" /> : <UserCheck size={14} className="text-emerald-500" />}
                            </button>
                            <button onClick={() => setDeleteModal(u)} title="Hapus" className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeModal}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{editUser ? 'Edit User' : 'Tambah User Baru'}</h3>
                  <p className="text-slate-500 text-sm">{editUser ? `Edit data ${editUser.name}` : 'Buat akun baru untuk tim kamu'}</p>
                </div>
                <button onClick={closeModal} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Nama Lengkap *</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field text-sm" required placeholder="Nama lengkap" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Email *</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field text-sm" required disabled={!!editUser} placeholder="email@domain.com" />
                  </div>
                  {!editUser && (
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Password *</label>
                      <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input-field text-sm" required placeholder="Min. 6 karakter" minLength={6} />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">No. WhatsApp</label>
                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field text-sm" placeholder="08xxxxxxxxxx" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Role *</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input-field text-sm">
                      {Object.entries(roleConfig).map(([k, v]) => (
                        k !== 'superadmin' || currentUser?.role === 'superadmin'
                          ? <option key={k} value={k}>{v.label}</option>
                          : null
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">ID Karyawan</label>
                    <input value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className="input-field text-sm" placeholder="EMP001" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Departemen</label>
                    <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="input-field text-sm" placeholder="IT, HR, Finance..." />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Jabatan</label>
                    <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="input-field text-sm" placeholder="Staff, Manager, Supervisor..." />
                  </div>
                </div>

                {/* Role info */}
                <div className={`rounded-xl p-3 text-xs border ${roleConfig[form.role]?.cls || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  <Shield size={12} className="inline mr-1" />
                  <strong>{roleConfig[form.role]?.label}</strong>: {roleConfig[form.role]?.desc}
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">{editUser ? 'Simpan Perubahan' : 'Buat Akun'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {showPassModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPassModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900">Reset Password</h3>
                  <p className="text-slate-500 text-sm">{showPassModal.name}</p>
                </div>
                <button onClick={() => setShowPassModal(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Password Baru *</label>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="input-field" placeholder="Min. 6 karakter" required minLength={6} />
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  ⚠️ Password lama akan langsung diganti. Beritahu user password barunya.
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowPassModal(null)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">Reset Password</button>
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
                  <h3 className="font-bold text-slate-900">Hapus User</h3>
                  <p className="text-sm text-slate-500">{deleteModal.name}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-5">Pilih tindakan yang ingin dilakukan untuk akun ini:</p>
              <div className="space-y-2.5">
                <button onClick={handleDeactivate}
                  className="w-full text-left px-4 py-3 rounded-2xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors group">
                  <div className="font-medium text-slate-800 text-sm group-hover:text-amber-700">Nonaktifkan Akun</div>
                  <div className="text-xs text-slate-400 mt-0.5">User tidak bisa login, data tetap tersimpan</div>
                </button>
                <button onClick={handlePermanentDelete}
                  className="w-full text-left px-4 py-3 rounded-2xl border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-colors group">
                  <div className="font-medium text-slate-800 text-sm group-hover:text-red-600">Hapus Permanen</div>
                  <div className="text-xs text-slate-400 mt-0.5">Semua data user akan dihapus dan tidak bisa dikembalikan</div>
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
    </div>
  );
}
