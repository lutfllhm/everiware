import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, X, Building, Briefcase, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';

export default function DepartmentsAdmin() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const { user } = useAuthStore();
  const canEdit = user?.role !== 'hrd';

  // Modal state
  const [deptModal, setDeptModal] = useState(null);   // null | 'add' | dept object (edit)
  const [posModal, setPosModal]   = useState(null);   // null | { dept } (add) | { dept, pos } (edit)
  const [deleteModal, setDeleteModal] = useState(null); // { type: 'dept'|'pos', item }

  const [deptForm, setDeptForm] = useState({ name: '', description: '' });
  const [posForm, setPosForm]   = useState({ name: '', description: '' });

  useEffect(() => { fetchDepartments(); }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/departments/all');
      setDepartments(data.departments);
    } catch {} finally { setLoading(false); }
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // ── DEPARTMENT CRUD ──────────────────────────────────────────────────────────
  const openAddDept = () => {
    setDeptForm({ name: '', description: '' });
    setDeptModal('add');
  };

  const openEditDept = (dept) => {
    setDeptForm({ name: dept.name, description: dept.description || '' });
    setDeptModal(dept);
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    try {
      if (deptModal === 'add') {
        await api.post('/departments', deptForm);
        toast.success('Departemen berhasil ditambahkan');
      } else {
        await api.put(`/departments/${deptModal.id}`, { ...deptForm, is_active: deptModal.is_active });
        toast.success('Departemen berhasil diperbarui');
      }
      setDeptModal(null);
      fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan departemen');
    }
  };

  const handleDeleteDept = async () => {
    try {
      await api.delete(`/departments/${deleteModal.item.id}`);
      toast.success('Departemen berhasil dihapus');
      setDeleteModal(null);
      fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus departemen');
    }
  };

  // ── POSITION CRUD ────────────────────────────────────────────────────────────
  const openAddPos = (dept) => {
    setPosForm({ name: '', description: '' });
    setPosModal({ dept });
  };

  const openEditPos = (dept, pos) => {
    setPosForm({ name: pos.name, description: pos.description || '' });
    setPosModal({ dept, pos });
  };

  const handleSavePos = async (e) => {
    e.preventDefault();
    try {
      if (posModal.pos) {
        await api.put(`/departments/positions/${posModal.pos.id}`, { ...posForm, is_active: posModal.pos.is_active });
        toast.success('Jabatan berhasil diperbarui');
      } else {
        await api.post('/departments/positions', { department_id: posModal.dept.id, ...posForm });
        toast.success('Jabatan berhasil ditambahkan');
      }
      setPosModal(null);
      fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan jabatan');
    }
  };

  const handleDeletePos = async () => {
    try {
      await api.delete(`/departments/positions/${deleteModal.item.id}`);
      toast.success('Jabatan berhasil dihapus');
      setDeleteModal(null);
      fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus jabatan');
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-400">Memuat data...</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">{departments.length} departemen terdaftar</p>
        {canEdit && (
          <button onClick={openAddDept} className="btn-primary py-2.5 flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Departemen
          </button>
        )}
      </div>

      {/* List */}
      {departments.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <Building size={40} className="mx-auto mb-3 opacity-30" />
          <p>Belum ada departemen. Tambahkan departemen pertama.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map(dept => (
            <div key={dept.id} className="card overflow-hidden">
              {/* Dept Header */}
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => toggleExpand(dept.id)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                  {expanded[dept.id]
                    ? <ChevronDown size={16} className="text-slate-500" />
                    : <ChevronRight size={16} className="text-slate-500" />}
                </button>
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building size={18} className="text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{dept.name}</span>
                    {!dept.is_active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Nonaktif</span>}
                  </div>
                  {dept.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{dept.description}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{dept.positions?.length || 0} jabatan</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canEdit && (
                    <button onClick={() => openEditDept(dept)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Edit departemen">
                      <Edit size={15} className="text-slate-500" />
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => setDeleteModal({ type: 'dept', item: dept })} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Hapus departemen">
                      <Trash2 size={15} className="text-red-500" />
                    </button>
                  )}
                </div>
              </div>

              {/* Positions */}
              <AnimatePresence>
                {expanded[dept.id] && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-100">
                    <div className="p-4 pt-3 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Jabatan / Posisi</span>
                        {canEdit && (
                          <button onClick={() => openAddPos(dept)} className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
                            <Plus size={12} /> Tambah Jabatan
                          </button>
                        )}
                      </div>

                      {dept.positions?.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2 text-center">Belum ada jabatan di departemen ini</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dept.positions.map(pos => (
                            <div key={pos.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl group">
                              <Briefcase size={14} className="text-slate-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-slate-700 font-medium">{pos.name}</span>
                                  {!pos.is_active && <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">Nonaktif</span>}
                                </div>
                                {pos.description && <p className="text-xs text-slate-400 truncate">{pos.description}</p>}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {canEdit && (
                                  <button onClick={() => openEditPos(dept, pos)} className="p-1 hover:bg-white rounded-lg transition-colors">
                                    <Edit size={13} className="text-slate-500" />
                                  </button>
                                )}
                                {canEdit && (
                                  <button onClick={() => setDeleteModal({ type: 'pos', item: pos })} className="p-1 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={13} className="text-red-400" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Modal Departemen */}
      <AnimatePresence>
        {deptModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeptModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900 text-lg">
                  {deptModal === 'add' ? 'Tambah Departemen' : 'Edit Departemen'}
                </h3>
                <button onClick={() => setDeptModal(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleSaveDept} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Nama Departemen *</label>
                  <input value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                    className="input-field" required placeholder="Contoh: IT, Finance, HR..." />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Deskripsi</label>
                  <input value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                    className="input-field" placeholder="Opsional" />
                </div>
                {deptModal !== 'add' && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <input type="checkbox" id="dept-active" checked={deptModal.is_active}
                      onChange={e => setDeptModal({ ...deptModal, is_active: e.target.checked })}
                      className="accent-slate-900 w-4 h-4" />
                    <label htmlFor="dept-active" className="text-sm text-slate-700 cursor-pointer">Departemen aktif</label>
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setDeptModal(null)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">
                    {deptModal === 'add' ? 'Tambah' : 'Simpan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Jabatan */}
      <AnimatePresence>
        {posModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPosModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {posModal.pos ? 'Edit Jabatan' : 'Tambah Jabatan'}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">{posModal.dept.name}</p>
                </div>
                <button onClick={() => setPosModal(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleSavePos} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Nama Jabatan *</label>
                  <input value={posForm.name} onChange={e => setPosForm({ ...posForm, name: e.target.value })}
                    className="input-field" required placeholder="Contoh: Staff, Senior Staff, Manager..." />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Deskripsi</label>
                  <input value={posForm.description} onChange={e => setPosForm({ ...posForm, description: e.target.value })}
                    className="input-field" placeholder="Opsional" />
                </div>
                {posModal.pos && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <input type="checkbox" id="pos-active" checked={posModal.pos.is_active}
                      onChange={e => setPosModal({ ...posModal, pos: { ...posModal.pos, is_active: e.target.checked } })}
                      className="accent-slate-900 w-4 h-4" />
                    <label htmlFor="pos-active" className="text-sm text-slate-700 cursor-pointer">Jabatan aktif</label>
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setPosModal(null)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">
                    {posModal.pos ? 'Simpan' : 'Tambah'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
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
                  <h3 className="font-bold text-slate-900">
                    Hapus {deleteModal.type === 'dept' ? 'Departemen' : 'Jabatan'}
                  </h3>
                  <p className="text-sm text-slate-500">{deleteModal.item.name}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-5">
                {deleteModal.type === 'dept'
                  ? 'Semua jabatan dalam departemen ini juga akan dihapus. Pastikan tidak ada karyawan yang menggunakan departemen ini.'
                  : 'Pastikan tidak ada karyawan yang menggunakan jabatan ini.'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal(null)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                <button onClick={deleteModal.type === 'dept' ? handleDeleteDept : handleDeletePos}
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



