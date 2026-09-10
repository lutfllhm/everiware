import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail, Phone, Building, Briefcase, Calendar, MapPin, IdCard, ShieldCheck, FileSignature } from 'lucide-react';
import api from '../../api/axios';
import UserAvatar from '../../components/ui/UserAvatar';

const ROLE_LABELS = {
  employee: 'Karyawan', gm: 'General Manager', spv: 'SPV/PIC',
  hrd: 'HRD', admin: 'Admin', superadmin: 'Superadmin',
};

const fmtDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Satu baris data — dipakai berulang di kartu-kartu di bawah.
function Row({ icon: Icon, label, value, to }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-400">{label}</div>
        {to ? (
          <Link to={to} className="text-sm font-medium text-slate-900 hover:underline break-words">
            {value || '-'}
          </Link>
        ) : (
          <div className="text-sm font-medium text-slate-900 break-words">{value || '-'}</div>
        )}
      </div>
    </div>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/users/${id}`);
        if (!cancelled) setUser(data.user);
      } catch (err) {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div className="card text-center py-16 text-slate-400">Memuat data karyawan...</div>;
  }

  if (notFound || !user) {
    return (
      <div className="card text-center py-16">
        <div className="font-semibold text-slate-900 text-sm">Karyawan tidak ditemukan</div>
        <p className="text-sm text-slate-400 mt-1.5">Data mungkin sudah dihapus.</p>
        <button onClick={() => navigate('/admin/employees?all=1')} className="btn-primary mt-5 py-2 px-4 text-sm">
          Kembali ke Daftar Karyawan
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/admin/employees?all=1"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ChevronLeft size={15} /> Daftar Karyawan
      </Link>

      {/* Identitas */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <UserAvatar name={user.name} avatar={user.avatar} size="xl" />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-900 text-lg truncate">{user.name}</h2>
            <p className="text-sm text-slate-500 mt-0.5 truncate">{user.position || 'Tanpa jabatan'}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className={user.is_active ? 'badge-success' : 'badge-danger'}>
                {user.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
              <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                {ROLE_LABELS[user.role] || user.role}
              </span>
              {!user.is_verified && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Belum aktivasi
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Kepegawaian */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-1">Kepegawaian</h3>
          <div className="divide-y divide-slate-100">
            <Row icon={IdCard} label="ID Karyawan" value={user.employee_id} />
            {/* Departemen & jabatan mengarah ke halaman pengelolanya */}
            <Row icon={Building} label="Departemen" value={user.department} to="/admin/departments" />
            <Row icon={Briefcase} label="Jabatan" value={user.position} to="/admin/departments" />
            <Row icon={Calendar} label="Tanggal Bergabung" value={fmtDate(user.join_date)} />
            <Row icon={MapPin} label="Lokasi Penempatan" value={user.location_name} />
          </div>
        </div>

        {/* Kontak */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-1">Kontak & Akun</h3>
          <div className="divide-y divide-slate-100">
            <Row icon={Mail} label="Email" value={user.email} />
            <Row icon={Phone} label="Telepon" value={user.phone} />
            <Row icon={ShieldCheck} label="Wajah Terdaftar" value={user.face_registered ? 'Sudah' : 'Belum'} />
            <Row
              icon={Calendar}
              label="Jatah Cuti Tahun Ini"
              value={`${user.remaining_days ?? '-'} / ${user.total_days ?? 12} hari`}
            />
          </div>
        </div>

        {/* Status hubungan kerja */}
        <div className="card p-5 md:col-span-2">
          <h3 className="font-semibold text-slate-900 text-sm mb-1">Status Hubungan Kerja</h3>
          <div className="grid gap-x-6 sm:grid-cols-2 divide-slate-100">
            <Row icon={FileSignature} label="Penempatan" value={user.penempatan} />
            <Row icon={Building} label="Instansi" value={user.instansi} />
            <Row icon={ShieldCheck} label="SKCK" value={user.has_skck ? 'Ada' : 'Tidak ada'} />
            <Row icon={ShieldCheck} label="Form Jobs" value={user.has_formjobs ? 'Ada' : 'Tidak ada'} />
          </div>
        </div>
      </div>
    </div>
  );
}
