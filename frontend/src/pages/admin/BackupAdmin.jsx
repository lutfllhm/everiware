import { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Download, FileText, Users, Clock, Calendar, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const backupItems = [
  { key: 'attendance', label: 'Data Absensi', desc: 'Semua rekap absensi karyawan', icon: Clock, iconCls: 'bg-sky-100 text-sky-600' },
  { key: 'employees', label: 'Data Karyawan', desc: 'Daftar semua akun karyawan', icon: Users, iconCls: 'bg-slate-100 text-slate-600' },
  { key: 'leaves', label: 'Data Perizinan', desc: 'Semua pengajuan cuti & izin sakit', icon: Calendar, iconCls: 'bg-purple-100 text-purple-600' },
  { key: 'report_attendance', label: 'Laporan Absensi Bulan Ini', desc: 'Rekap absensi bulan berjalan', icon: FileText, iconCls: 'bg-teal-100 text-teal-600' },
  { key: 'report_leave', label: 'Laporan Perizinan Bulan Ini', desc: 'Rekap perizinan bulan berjalan', icon: FileText, iconCls: 'bg-amber-100 text-amber-600' },
];

export default function BackupAdmin() {
  const [loading, setLoading] = useState({});
  const [history, setHistory] = useState([]);

  const downloadCSV = (data, filename) => {
    if (!data || !data.length) { toast.error('Tidak ada data untuk diunduh'); return; }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row).map(v => {
        const val = v === null || v === undefined ? '' : String(v);
        return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    ).join('\n');
    const BOM = '\uFEFF'; // UTF-8 BOM agar Excel bisa baca karakter Indonesia
    const blob = new Blob([BOM + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBackup = async (key, label) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      let data = [];

      if (key === 'attendance') {
        const res = await api.get(`/attendance/all?limit=9999&month=${month}&year=${year}`);
        data = res.data.attendances.map(a => ({
          'Nama': a.user_name,
          'ID Karyawan': a.employee_id || '-',
          'Departemen': a.department || '-',
          'Tanggal': a.date,
          'Jam Masuk': a.check_in ? format(new Date(a.check_in), 'HH:mm:ss') : '-',
          'Jam Pulang': a.check_out ? format(new Date(a.check_out), 'HH:mm:ss') : '-',
          'Lokasi': a.location_name || '-',
          'Status': a.status,
        }));
      } else if (key === 'employees') {
        const res = await api.get('/users?limit=9999');
        data = res.data.users.map(u => ({
          'Nama': u.name,
          'Email': u.email,
          'No WA': u.phone || '-',
          'ID Karyawan': u.employee_id || '-',
          'Departemen': u.department || '-',
          'Jabatan': u.position || '-',
          'Role': u.role,
          'Tanggal Bergabung': u.join_date ? u.join_date.split('T')[0] : '-',
          'Status': u.is_active ? 'Aktif' : 'Nonaktif',
          'Jatah Cuti': u.total_days || 12,
          'Sisa Cuti': u.remaining_days ?? '-',
        }));
      } else if (key === 'leaves') {
        const res = await api.get('/leave/all');
        data = res.data.leaves.map(l => ({
          'Nama': l.user_name,
          'Departemen': l.department || '-',
          'Jenis': l.type === 'annual' ? 'Cuti Tahunan' : 'Izin Sakit',
          'Tanggal Mulai': l.start_date,
          'Tanggal Selesai': l.end_date,
          'Durasi (hari)': l.total_days,
          'Alasan': l.reason,
          'Status': l.status === 'approved' ? 'Disetujui' : l.status === 'rejected' ? 'Ditolak' : 'Menunggu',
          'Diproses Oleh': l.reviewer_name || '-',
          'Catatan': l.review_notes || '-',
          'Tanggal Pengajuan': l.created_at ? format(new Date(l.created_at), 'dd/MM/yyyy') : '-',
        }));
      } else if (key === 'report_attendance') {
        const res = await api.get(`/attendance/report?month=${month}&year=${year}`);
        data = res.data.report.map(r => ({
          'Nama': r.name,
          'ID Karyawan': r.employee_id || '-',
          'Departemen': r.department || '-',
          'Hadir': r.present_count,
          'Terlambat': r.late_count,
          'Tidak Hadir': r.absent_count,
          'Cuti': r.leave_count,
          'Sakit': r.sick_count,
          'Total Hari': r.total_days,
        }));
      } else if (key === 'report_leave') {
        const res = await api.get(`/leave/report?month=${month}&year=${year}`);
        data = res.data.report.map(r => ({
          'Nama': r.user_name,
          'Departemen': r.department || '-',
          'Jenis': r.type === 'annual' ? 'Cuti' : 'Sakit',
          'Tanggal Mulai': r.start_date,
          'Tanggal Selesai': r.end_date,
          'Durasi (hari)': r.total_days,
          'Alasan': r.reason,
        }));
      }

      downloadCSV(data, key);
      const entry = { key, label, time: new Date(), count: data.length, success: true };
      setHistory(prev => [entry, ...prev.slice(0, 9)]);
      toast.success(`✅ ${label} berhasil diunduh (${data.length} baris)`);
    } catch (err) {
      const entry = { key, label, time: new Date(), count: 0, success: false };
      setHistory(prev => [entry, ...prev.slice(0, 9)]);
      toast.error(`Gagal mengunduh ${label}`);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleBackupAll = async () => {
    toast('Mengunduh semua data...', { icon: '⏳' });
    for (const item of backupItems) {
      await handleBackup(item.key, item.label);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
            <Database size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Backup Database</h2>
            <p className="text-slate-500 text-sm">Unduh data aplikasi dalam format CSV</p>
          </div>
          <div className="ml-auto hidden sm:block">
            <span className="text-xs bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium">
              📅 {format(new Date(), 'MMMM yyyy', { locale: id })}
            </span>
          </div>
        </div>
      </div>

      {/* Backup All */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Backup Semua Data</h3>
            <p className="text-slate-500 text-sm mt-0.5">Unduh semua file sekaligus dalam satu klik</p>
          </div>
          <button onClick={handleBackupAll} className="btn-primary flex items-center gap-2 py-2.5 text-sm">
            <Download size={16} /> Unduh Semua
          </button>
        </div>
      </div>

      {/* Individual Backup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {backupItems.map((item, i) => (
          <motion.div key={item.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="card p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.iconCls}`}>
                <item.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 text-sm">{item.label}</h4>
                <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
              </div>
            </div>
            <button onClick={() => handleBackup(item.key, item.label)} disabled={loading[item.key]}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-colors disabled:opacity-50">
              {loading[item.key]
                ? <><Loader size={14} className="animate-spin" /> Mengunduh...</>
                : <><Download size={14} /> Unduh CSV</>
              }
            </button>
          </motion.div>
        ))}
      </div>

      {/* Download History */}
      {history.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 mb-4">Riwayat Unduhan</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  {h.success
                    ? <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                    : <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                  }
                  <div>
                    <div className="text-sm font-medium text-slate-900">{h.label}</div>
                    <div className="text-xs text-slate-400">{format(h.time, 'HH:mm:ss')} · {h.count} baris</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-lg font-medium border ${h.success ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {h.success ? 'Berhasil' : 'Gagal'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-blue-700 text-sm font-medium mb-1">ℹ️ Informasi Backup</p>
        <ul className="text-blue-600 text-xs space-y-1">
          <li>• File diunduh dalam format CSV yang bisa dibuka di Excel / Google Sheets</li>
          <li>• Data absensi & laporan mengambil data bulan berjalan</li>
          <li>• Data karyawan & perizinan mengambil semua data yang tersimpan</li>
          <li>• Lakukan backup secara rutin setiap akhir bulan</li>
        </ul>
      </div>
    </div>
  );
}
