import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Edit, Trash2, X, Users, CheckSquare, Square, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import UserAvatar from '../../components/ui/UserAvatar';

const emptyShift = { name: '', start_time: '08:00', end_time: '17:00', late_tolerance: 10, is_active: true };

export default function ShiftsAdmin() {
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState('shifts'); // shifts | assign
  const [showModal, setShowModal] = useState(false);
  const [editShift, setEditShift] = useState(null);
  const [form, setForm] = useState(emptyShift);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkShiftId, setBulkShiftId] = useState('');
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => { fetchShifts(); fetchAssignments(); fetchEmployees(); }, []);

  const fetchShifts = async () => {
    try { const { data } = await api.get('/shifts'); setShifts(data.shifts); } catch {}
  };
  const fetchAssignments = async () => {
    try { const { data } = await api.get('/shifts/assignments'); setAssignments(data.assignments); } catch {}
  };
  const fetchEmployees = async () => {
    try { const { data } = await api.get('/users?role=employee'); setEmployees(data.users); } catch {}
  };

  const openAdd = () => { setEditShift(null); setForm(emptyShift); setShowModal(true); };
  const openEdit = (s) => { setEditShift(s); setForm({ name: s.name, start_time: s.start_time?.substring(0,5), end_time: s.end_time?.substring(0,5), late_tolerance: s.late_tolerance, is_active: s.is_active }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editShift) {
        await api.put(`/shifts/${editShift.id}`, form);
        toast.success('Shift berhasil diperbarui');
      } else {
        await api.post('/shifts', form);
        toast.success('Shift berhasil ditambahkan');
      }
      setShowModal(false);
      fetchShifts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan shift');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus shift ini?')) return;
    try {
      await api.delete(`/shifts/${id}`);
      toast.success('Shift dihapus');
      fetchShifts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus');
    }
  };

  const toggleSelect = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === employees.length ? [] : employees.map(e => e.id));

  const handleBulkAssign = async () => {
    if (!selectedIds.length) return toast.error('Pilih minimal 1 karyawan');
    if (!bulkShiftId) return toast.error('Pilih shift terlebih dahulu');
    setBulkSaving(true);
    try {
      await api.post('/shifts/assign/bulk', { user_ids: selectedIds, shift_id: bulkShiftId, effective_date: bulkDate });
      toast.success(`Shift berhasil diatur untuk ${selectedIds.length} karyawan`);
      setSelectedIds([]);
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengatur shift');
    } finally { setBulkSaving(false); }
  };

  const getAssignment = (userId) => assignments.find(a => a.user_id === userId);

  return (
    <div className="space-y-4">
      {/* Tab */}
      <div className="flex bg-slate-100 rounded-2xl p-1 w-fit">
        {[{ key: 'shifts', label: 'Kelola Shift' }, { key: 'assign', label: 'Atur Shift Karyawan' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB SHIFTS ── */}
      {tab === 'shifts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openAdd} className="btn-primary py-2.5 flex items-center gap-2 text-sm">
              <Plus size={16} /> Tambah Shift
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map(s => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Clock size={18} className="text-slate-600" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                      <Edit size={14} className="text-slate-500" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-slate-900">{s.name}</h3>
                <p className="text-slate-500 text-sm mt-1">
                  {s.start_time?.substring(0,5)} – {s.end_time?.substring(0,5)}
                </p>
                <p className="text-slate-400 text-xs mt-1">Toleransi: {s.late_tolerance} menit</p>
                <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                  {s.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB ASSIGN ── */}
      {tab === 'assign' && (
        <div className="space-y-4">
          {/* Bulk assign bar */}
          <div className="card p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-40">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Shift</label>
              <select value={bulkShiftId} onChange={e => setBulkShiftId(e.target.value)} className="input-field py-2 text-sm">
                <option value="">Pilih shift...</option>
                {shifts.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.start_time?.substring(0,5)}-{s.end_time?.substring(0,5)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Berlaku Mulai</label>
              <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="input-field py-2 text-sm" />
            </div>
            <button onClick={handleBulkAssign} disabled={bulkSaving || !selectedIds.length}
              className="btn-primary py-2.5 flex items-center gap-2 text-sm disabled:opacity-50">
              <Save size={15} /> {bulkSaving ? 'Menyimpan...' : `Atur ${selectedIds.length || ''} Karyawan`}
            </button>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button onClick={toggleAll} className="text-slate-400 hover:text-slate-700">
                        {selectedIds.length === employees.length && employees.length > 0 ? <CheckSquare size={15} className="text-slate-900" /> : <Square size={15} />}
                      </button>
                    </th>
                    {['Karyawan', 'Departemen', 'Shift Saat Ini', 'Jam Kerja'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {employees.map(emp => {
                    const asgn = getAssignment(emp.id);
                    return (
                      <tr key={emp.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(emp.id) ? 'bg-slate-50' : ''}`}>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleSelect(emp.id)} className="text-slate-400 hover:text-slate-700">
                            {selectedIds.includes(emp.id) ? <CheckSquare size={15} className="text-slate-900" /> : <Square size={15} />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={emp.name} avatar={emp.avatar} size="md" />
                            <div>
                              <div className="font-medium text-slate-900 text-sm">{emp.name}</div>
                              <div className="text-xs text-slate-500">{emp.employee_id || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{emp.department || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${asgn?.shift_name ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                            {asgn?.shift_name || 'Shift Reguler (default)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {asgn?.start_time ? `${asgn.start_time.substring(0,5)} – ${asgn.end_time.substring(0,5)}` : '08:00 – 17:00'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Shift */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900 text-lg">{editShift ? 'Edit Shift' : 'Tambah Shift'}</h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Nama Shift *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="input-field text-sm" placeholder="Shift Pagi, Shift Malam..." required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Jam Masuk *</label>
                    <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
                      className="input-field text-sm" required />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Jam Pulang *</label>
                    <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
                      className="input-field text-sm" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Toleransi Terlambat (menit)</label>
                  <input type="number" value={form.late_tolerance} onChange={e => setForm({ ...form, late_tolerance: +e.target.value })}
                    className="input-field text-sm" min={0} max={60} />
                </div>
                {editShift && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                    <span className="text-sm text-slate-700">Shift aktif</span>
                  </label>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5 text-sm">
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
