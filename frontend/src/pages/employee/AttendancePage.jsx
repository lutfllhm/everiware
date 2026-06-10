import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X } from 'lucide-react';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function AttendancePage() {
  const [todayAtt, setTodayAtt] = useState(null);
  const [workInfo, setWorkInfo] = useState(null);
  const [activePermits, setActivePermits] = useState([]);
  const [permissionSettings, setPermissionSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [mode, setMode] = useState(null); // 'in' | 'out'
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const webcamRef = useRef(null);

  const fetchToday = async () => {
    try {
      const { data } = await api.get('/attendance/today');
      setTodayAtt(data.attendance);
      setWorkInfo(data.work_info);
      setActivePermits(data.active_permits || []);
      setPermissionSettings(data.permission_settings || {});
    } catch {}
  };

  useEffect(() => { fetchToday(); }, []);

  const getLocation = () => {
    setGettingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGettingLocation(false);
      },
      (err) => {
        setLocationError('Tidak bisa mendapatkan lokasi. Pastikan GPS aktif dan izin lokasi diberikan.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const startAttendance = (type) => {
    setMode(type);
    setShowCamera(true);
    setCapturedPhoto(null);
    getLocation();
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) setCapturedPhoto(imageSrc);
  }, [webcamRef]);

  const submitAttendance = async () => {
    if (!capturedPhoto) return toast.error('Ambil foto selfie terlebih dahulu');
    if (!location) return toast.error('Lokasi belum didapatkan. Tunggu sebentar.');

    setLoading(true);
    try {
      // Convert base64 to blob
      const res = await fetch(capturedPhoto);
      const blob = await res.blob();
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('photo', file);
      formData.append('latitude', location.lat);
      formData.append('longitude', location.lng);

      const endpoint = mode === 'in' ? '/attendance/check-in' : '/attendance/check-out';
      const { data } = await api.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

      toast.success(data.message);
      setShowCamera(false);
      setCapturedPhoto(null);
      fetchToday();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Absensi gagal');
    } finally { setLoading(false); }
  };

  const permitTypeLabels = {
    late_permission: { label: 'Izin Terlambat', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    early_leave: { label: 'Izin Pulang Cepat', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    leave_office: { label: 'Izin Keluar Kantor', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  };

  const statusConfig = {
    present: { label: 'Hadir', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
    late: { label: 'Terlambat', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    absent: { label: 'Tidak Hadir', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    leave: { label: 'Cuti', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    sick: { label: 'Sakit', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  };

  const hasLatePermission = activePermits.some(p => p.leave_type_code === 'late_permission');
  const hasEarlyLeave = activePermits.some(p => p.leave_type_code === 'early_leave');
  const hasLeaveOffice = activePermits.some(p => p.leave_type_code === 'leave_office');

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 rounded-2xl p-6 text-white">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <h2 className="text-xl font-bold mb-1">Absensi Harian</h2>
        <p className="text-slate-400 text-sm">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}</p>
      </div>

      {/* Active Permits Banner */}
      {activePermits.length > 0 && (
        <div className="space-y-2">
          {activePermits.map((permit, idx) => {
            const pType = permitTypeLabels[permit.leave_type_code] || { label: 'Izin', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' };
            let message = '';
            if (permit.leave_type_code === 'late_permission') {
              message = `Check-in diizinkan hingga ${permissionSettings.late_permission_max_time || '11:00'} WIB`;
            } else if (permit.leave_type_code === 'early_leave') {
              message = `Check-out diizinkan mulai ${permissionSettings.early_leave_min_time || '13:00'} WIB`;
            } else if (permit.leave_type_code === 'leave_office') {
              message = 'Izin keluar kantor aktif hari ini';
            }
            return (
              <div key={idx} className={`border rounded-2xl p-4 ${pType.bg}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                    <Clock size={20} className={pType.color} />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${pType.color}`}>{pType.label} Aktif</p>
                    <p className="text-xs text-slate-600 mt-0.5">{message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Today Status */}
      <div className="card p-5">
        <h3 className="font-bold text-slate-900 mb-4">Status Hari Ini</h3>
        {todayAtt ? (
          <div className={`border rounded-2xl p-4 ${statusConfig[todayAtt.status]?.bg || 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`font-bold text-lg ${statusConfig[todayAtt.status]?.color}`}>
                {todayAtt.status === 'present' && hasLatePermission
                  ? 'Hadir (dengan Izin Terlambat)'
                  : statusConfig[todayAtt.status]?.label || 'Hadir'}
              </span>
              <CheckCircle className="text-emerald-500" size={24} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">Jam Masuk</div>
                <div className="font-bold text-slate-900 text-lg">
                  {todayAtt.check_in ? format(new Date(todayAtt.check_in), 'HH:mm') : '--:--'}
                </div>
              </div>
              <div className="bg-white rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">Jam Pulang</div>
                <div className="font-bold text-slate-900 text-lg">
                  {todayAtt.check_out ? format(new Date(todayAtt.check_out), 'HH:mm') : '--:--'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50 rounded-2xl">
            <Clock size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500">Belum ada absensi hari ini</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => startAttendance('in')}
          disabled={!!todayAtt?.check_in}
          className={`p-5 rounded-2xl font-bold text-white transition-all active:scale-95 ${
            todayAtt?.check_in
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 shadow-lg shadow-slate-300'
          }`}>
          <Clock size={28} className="mb-2" />
          <div>Absen Masuk</div>
          <div className="text-xs opacity-60 font-normal mt-0.5">{todayAtt?.check_in ? 'Sudah absen' : 'Tap untuk absen'}</div>
        </button>
        <button
          onClick={() => startAttendance('out')}
          disabled={!todayAtt?.check_in || !!todayAtt?.check_out}
          className={`p-5 rounded-2xl font-bold text-white transition-all active:scale-95 ${
            !todayAtt?.check_in || todayAtt?.check_out
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500 shadow-lg shadow-slate-300'
          }`}>
          <Clock size={28} className="mb-2" />
          <div>Absen Pulang</div>
          <div className="text-xs opacity-60 font-normal mt-0.5">{todayAtt?.check_out ? 'Sudah absen' : 'Tap untuk absen'}</div>
        </button>
      </div>

      {/* Info */}
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <MapPin size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-slate-900 text-sm">Syarat Absensi</p>
            <ul className="text-slate-500 text-xs mt-1 space-y-1">
              <li>• Harus berada di area lokasi kerja yang ditentukan</li>
              <li>• Wajib selfie foto saat absensi</li>
              <li>• Pastikan GPS aktif di perangkat kamu</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Info Jam Kerja Hari Ini */}
      {workInfo && (
        <div className={`card p-4 border-l-4 ${workInfo.is_saturday ? 'border-l-amber-400 bg-amber-50' : 'border-l-slate-300'}`}>
          <div className="flex items-center gap-3">
            <Clock size={18} className={workInfo.is_saturday ? 'text-amber-600' : 'text-slate-500'} />
            <div>
              <p className={`font-semibold text-sm ${workInfo.is_saturday ? 'text-amber-800' : 'text-slate-800'}`}>
                {workInfo.is_saturday ? '📅 Hari Sabtu — Setengah Hari' : '📅 Jam Kerja Hari Ini'}
              </p>
              <p className={`text-xs mt-0.5 ${workInfo.is_saturday ? 'text-amber-700' : 'text-slate-500'}`}>
                Masuk: <strong>{workInfo.start_time}</strong> · Pulang: <strong>{workInfo.end_time}</strong> WIB
                {workInfo.is_saturday && ' (lebih awal dari hari biasa)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Camera Header */}
            <div className="flex items-center justify-between p-4 pt-safe">
              <button onClick={() => { setShowCamera(false); setCapturedPhoto(null); }} className="p-2 rounded-full bg-white/20 text-white">
                <X size={20} />
              </button>
              <h3 className="text-white font-bold">{mode === 'in' ? 'Absen Masuk' : 'Absen Pulang'}</h3>
              <div className="w-10" />
            </div>

            {/* Camera View */}
            <div className="flex-1 relative">
              {!capturedPhoto ? (
                <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user', width: 720, height: 1280 }}
                  className="w-full h-full object-cover" />
              ) : (
                <img src={capturedPhoto} alt="selfie" className="w-full h-full object-cover" />
              )}

              {/* Overlay guide */}
              {!capturedPhoto && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-80 border-4 border-white/50 rounded-3xl" />
                </div>
              )}
            </div>

            {/* Location Status */}
            <div className="p-4 bg-black/50">
              {gettingLocation ? (
                <div className="flex items-center gap-2 text-white text-sm">
                  <RefreshCw size={14} className="animate-spin" /> Mendapatkan lokasi...
                </div>
              ) : locationError ? (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={14} /> {locationError}
                </div>
              ) : location ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <MapPin size={14} /> Lokasi didapatkan (akurasi: {Math.round(location.accuracy)}m)
                </div>
              ) : null}
            </div>

            {/* Camera Controls */}
            <div className="p-6 pb-safe bg-black flex items-center justify-center gap-6">
              {!capturedPhoto ? (
                <button onClick={capture} className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform">
                  <Camera size={32} className="text-slate-900" />
                </button>
              ) : (
                <>
                  <button onClick={() => setCapturedPhoto(null)} className="flex-1 py-3 rounded-2xl bg-white/20 text-white font-medium">
                    Ulangi
                  </button>
                  <button onClick={submitAttendance} disabled={loading || !location}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white font-bold disabled:opacity-50">
                    {loading ? 'Memproses...' : 'Kirim Absensi'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



