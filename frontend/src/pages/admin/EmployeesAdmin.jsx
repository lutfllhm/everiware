import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Edit, Trash2, X, User, Mail, Phone, Building, Briefcase, Calendar, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export default function EmployeesAdmin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [quotaModal, setQuotaModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [managers, setManagers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'employee', department: '', position: '', employee_id: '', join_date: '', manager_id: '', send_invitation: true, location_id: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [quotaForm, setQuotaForm] = useState({ total_days: 12, year: new Date().getFullYear() });
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');

  useEffect(() => { fetchUsers(); fetchManagers(); fetchDepartments(); fetchLocations(); }, [locationFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = `/users?role=employee${locationFilter ? `&location_id=${locationFilter}` : ''}`;
      const { data } = await api.get(url);
      setUsers(data.users);
    } catch {} finally { setLoading(false); }
  };

  const fetchManagers = async () => {
    try {
      const { data } = await api.get('/users');
      setManagers(data.users.filter(u => ['superadmin','admin','hrd'].includes(u.role) || u.role === 'employee'));
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

  // Posisi yang tersedia berdasarkan departemen yang dipilih
  const availablePositions = departments.find(d => d.name === form.department)?.positions?.filter(p => p.is_active) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, form);
        toast.success('Data karyawan berhasil diperbarui');
      } else {
        // Create user with avatar upload
        const formData = new FormData();
        Object.keys(form).forEach(key => {
          if (form[key] !== null && form[key] !== undefined && form[key] !== '') {
            formData.append(key, form[key]);
          }
        });
        if (avatarFile) {
          formData.append('avatar', avatarFile);
        }
        
        await api.post('/users', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Karyawan berhasil ditambahkan. Email undangan telah dikirim.');
      }
      setShowModal(false);
      setEditUser(null);
      setForm({ name: '', email: '', password: '', phone: '', role: 'employee', department: '', position: '', employee_id: '', join_date: '', manager_id: '', send_invitation: true, location_id: '' });
      setAvatarFile(null);
      setAvatarPreview(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data');
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
    setShowModal(true);
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

  const filtered = users.filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.includes(search) || u.employee_id?.includes(search));

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-1 flex-wrap gap-3 items-center min-w-48">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Cari karyawan..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9 py-2.5 text-sm" />
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
        <button onClick={() => { setEditUser(null); setForm({ name: '', email: '', password: '', phone: '', role: 'employee', department: '', position: '', employee_id: '', join_date: '', manager_id: '', send_invitation: true, location_id: '' }); setAvatarFile(null); setAvatarPreview(null); setShowModal(true); }}
          className="btn-primary py-2.5 flex items-center gap-2 text-sm">
          <Plus size={16} /> Tambah Karyawan
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Karyawan', 'ID', 'Departemen', 'Jabatan', 'Penempatan', 'Jatah Cuti', 'Status', 'Aksi'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Tidak ada karyawan</td></tr>
              ) : filtered.map((user) => (
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
                        {(user.department || user.position) && (
                          <div className="text-xs text-slate-400 mt-0.5">{[user.department, user.position].filter(Boolean).join(' · ')}</div>
                        )}
                      </div>                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{user.employee_id || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{user.department || '-'}</td>
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
                    <select
                      value={form.department}
                      onChange={e => setForm({ ...form, department: e.target.value, position: '' })}
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
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Jabatan</label>
                    <select
                      value={form.position}
                      onChange={e => setForm({ ...form, position: e.target.value })}
                      className="input-field text-sm"
                      disabled={!form.department}
                    >
                      <option value="">-- Pilih Jabatan --</option>
                      {availablePositions.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                      {/* Tampilkan nilai lama jika tidak ada di list */}
                      {form.position && !availablePositions.find(p => p.name === form.position) && (
                        <option value={form.position}>{form.position}</option>
                      )}
                    </select>
                    {!form.department && (
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
                      <option value="employee">Karyawan</option>
                      <option value="hrd">HRD</option>
                      <option value="admin">Admin</option>
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
                    {managers.filter(m => m.id !== editUser?.id).map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                    ))}
                  </select>
                </div>
                {!editUser && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <Mail size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.send_invitation}
                            onChange={e => setForm({ ...form, send_invitation: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm font-medium text-slate-700">Kirim email undangan</span>
                        </label>
                        <p className="text-xs text-slate-500 mt-1">Karyawan akan menerima email untuk mengatur password dan mengaktifkan akun</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">{editUser ? 'Simpan Perubahan' : 'Tambah Karyawan'}</button>
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
    </div>
  );
}
