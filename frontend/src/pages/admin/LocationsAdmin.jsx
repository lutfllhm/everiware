import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, Edit, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons in React/Vite builds
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Helper component to update map center dynamically when props change
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

// Helper component to handle map clicks
function MapEventsHandler({ onChange }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationsAdmin() {
  const [locations, setLocations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius: 100 });
  const [gettingLoc, setGettingLoc] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [preventSearch, setPreventSearch] = useState(false);

  useEffect(() => {
    if (!showModal) {
      setSearchQuery('');
      setSearchResults([]);
      setPreventSearch(false);
    }
  }, [showModal]);

  // Debounced search logic for instant search suggestions
  const fetchGeocoding = async (q) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=id&limit=5`,
      {
        headers: {
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
        }
      }
    );
    return await response.json();
  };

  const getCleanedGeocodingResults = async (originalQuery) => {
    // 1. Coba pencarian asli terlebih dahulu
    let results = await fetchGeocoding(originalQuery);
    if (results.length > 0) return results;

    // 2. Bersihkan pola RT/RW khas Indonesia (OSM tidak mengindeks RT/RW)
    let cleanedQuery = originalQuery
      .replace(/rt\s*[\d\.\/]*\s*rw\s*[\d\.\/]*/gi, '')
      .replace(/rt\s*[\d\.]+/gi, '')
      .replace(/rw\s*[\d\.]+/gi, '')
      .replace(/rt\/rw/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Hapus koma berlebih di ujung/tengah jika ada akibat pembersihan
    cleanedQuery = cleanedQuery.replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();

    if (cleanedQuery !== originalQuery && cleanedQuery.length >= 3) {
      results = await fetchGeocoding(cleanedQuery);
      if (results.length > 0) return results;
    }

    // 3. Fallback: Hapus bagian pertama (biasanya nama toko/gedung kustom seperti "Iware official store")
    if (cleanedQuery.includes(',')) {
      const parts = cleanedQuery.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        const queryWithoutFirstPart = parts.slice(1).join(', ');
        if (queryWithoutFirstPart.length >= 3) {
          results = await fetchGeocoding(queryWithoutFirstPart);
          if (results.length > 0) return results;
        }

        // Coba lagi dengan hanya mengambil bagian jalan/jalan utama (bagian kedua saja)
        const streetOnly = parts[1];
        if (streetOnly && streetOnly.length >= 3) {
          results = await fetchGeocoding(streetOnly);
          if (results.length > 0) return results;
        }
      }
    }

    return [];
  };

  useEffect(() => {
    if (preventSearch) {
      setPreventSearch(false);
      return;
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchQuery.length < 3) return;

    const delayDebounceFn = setTimeout(() => {
      const triggerSearch = async () => {
        setSearching(true);
        try {
          const data = await getCleanedGeocodingResults(searchQuery);
          setSearchResults(data);
        } catch (err) {
          // Silent catch for background search to avoid disturbing user
        } finally {
          setSearching(false);
        }
      };
      triggerSearch();
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setPreventSearch(true);
    setSearching(true);
    try {
      const data = await getCleanedGeocodingResults(searchQuery);
      setSearchResults(data);
      if (data.length === 0) {
        toast.error('Lokasi tidak ditemukan. Coba hapus nama toko/gedung kustom.');
      }
    } catch (err) {
      toast.error('Gagal melakukan pencarian lokasi');
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = (result) => {
    const lat = parseFloat(result.lat).toFixed(8);
    const lon = parseFloat(result.lon).toFixed(8);
    setForm(prev => ({ ...prev, latitude: lat, longitude: lon }));
    setSearchResults([]);
    setPreventSearch(true);
    setSearchQuery(result.display_name);
  };

  useEffect(() => { fetchLocations(); }, []);

  const fetchLocations = async () => {
    try {
      const { data } = await api.get('/attendance/locations');
      setLocations(data.locations);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editLoc) {
        await api.put(`/attendance/locations/${editLoc.id}`, { ...form, is_active: editLoc.is_active });
        toast.success('Lokasi berhasil diperbarui');
      } else {
        await api.post('/attendance/locations', form);
        toast.success('Lokasi berhasil ditambahkan');
      }
      setShowModal(false);
      setEditLoc(null);
      setForm({ name: '', latitude: '', longitude: '', radius: 100 });
      fetchLocations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan lokasi');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus lokasi ini?')) return;
    try {
      await api.delete(`/attendance/locations/${id}`);
      toast.success('Lokasi berhasil dihapus');
      fetchLocations();
    } catch { toast.error('Gagal menghapus lokasi'); }
  };

  const handleToggle = async (loc) => {
    try {
      await api.put(`/attendance/locations/${loc.id}`, { ...loc, is_active: !loc.is_active });
      toast.success(`Lokasi ${!loc.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchLocations();
    } catch { toast.error('Gagal mengubah status'); }
  };

  const getCurrentLocation = () => {
    setGettingLoc(true);
    if (!navigator.geolocation) {
      toast.error('Browser Anda tidak mendukung Geolocation');
      setGettingLoc(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(8),
          longitude: pos.coords.longitude.toFixed(8)
        }));
        setGettingLoc(false);
        
        const accuracy = Math.round(pos.coords.accuracy);
        if (accuracy > 150) {
          toast(`📍 Lokasi didapatkan, tapi akurasi rendah (±${accuracy}m). Disarankan geser pin peta secara manual agar presisi.`, {
            icon: '⚠️',
            duration: 5000,
          });
        } else {
          toast.success(`📍 Lokasi berhasil didapatkan dengan presisi tinggi (±${accuracy}m)`);
        }
      },
      (err) => {
        let msg = 'Gagal mendapatkan lokasi';
        if (err.code === 1) msg = 'Izin akses lokasi ditolak';
        else if (err.code === 2) msg = 'Lokasi tidak tersedia (periksa GPS/Koneksi Anda)';
        else if (err.code === 3) msg = 'Waktu permintaan lokasi habis (timeout)';
        toast.error(msg);
        setGettingLoc(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const openEdit = (loc) => {
    setEditLoc(loc);
    setForm({ name: loc.name, latitude: loc.latitude, longitude: loc.longitude, radius: loc.radius });
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Lokasi Absensi</h3>
          <p className="text-slate-500 text-sm">Karyawan hanya bisa absen di area yang terdaftar</p>
        </div>
        <button onClick={() => { setEditLoc(null); setForm({ name: '', latitude: '', longitude: '', radius: 100 }); setShowModal(true); }}
          className="btn-primary py-2.5 flex items-center gap-2 text-sm">
          <Plus size={16} /> Tambah Lokasi
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="card p-12 text-center">
          <MapPin size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Belum ada lokasi absensi</p>
          <p className="text-slate-400 text-sm mt-1">Tambahkan lokasi agar karyawan bisa absen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((loc) => (
            <motion.div key={loc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${loc.is_active ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    <MapPin size={20} className={loc.is_active ? 'text-emerald-600' : 'text-slate-400'} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{loc.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium border ${loc.is_active ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {loc.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-sm text-slate-500 mb-4">
                <div>📍 {parseFloat(loc.latitude).toFixed(6)}, {parseFloat(loc.longitude).toFixed(6)}</div>
                <div>📏 Radius: {loc.radius} meter</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(loc)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${loc.is_active ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                  {loc.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {loc.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button onClick={() => openEdit(loc)} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors">
                  <Edit size={15} className="text-indigo-500" />
                </button>
                <button onClick={() => handleDelete(loc.id)} className="p-2 hover:bg-red-50 rounded-xl transition-colors">
                  <Trash2 size={15} className="text-red-500" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900">{editLoc ? 'Edit Lokasi' : 'Tambah Lokasi'}</h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Nama Lokasi *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field text-sm" required placeholder="Contoh: Kantor Pusat Jakarta" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Latitude *</label>
                    <input value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} className="input-field text-sm" required placeholder="-6.2088" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Longitude *</label>
                    <input value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} className="input-field text-sm" required placeholder="106.8456" />
                  </div>
                </div>
                <button type="button" onClick={getCurrentLocation} disabled={gettingLoc}
                  className="w-full py-2.5 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition-colors disabled:opacity-50">
                  {gettingLoc ? '📍 Mendapatkan lokasi...' : '📍 Gunakan Lokasi Saat Ini'}
                </button>

                {/* Leaflet Map Picker */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 block">Pilih Lokasi di Peta</label>
                  <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-200 relative z-10">
                    
                    {/* Floating Search Bar (Overlay) */}
                    <div className="absolute top-2 left-2 right-2 z-[1001] flex gap-1.5 bg-white/95 backdrop-blur-sm p-1.5 rounded-xl shadow-md border border-slate-200/80">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                        placeholder="Cari lokasi/alamat..."
                        className="flex-1 bg-transparent px-2.5 py-1 text-xs outline-none text-slate-800 placeholder-slate-400"
                      />
                      <button
                        type="button"
                        onClick={handleSearch}
                        disabled={searching}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 min-w-[55px]"
                      >
                        {searching ? '...' : 'Cari'}
                      </button>

                      {searchResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-[1010] max-h-40 overflow-y-auto divide-y divide-slate-100">
                          {searchResults.map((result) => (
                            <button
                              key={result.place_id}
                              type="button"
                              onClick={() => selectSearchResult(result)}
                              className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-indigo-50 transition-colors block truncate"
                              title={result.display_name}
                            >
                              📍 {result.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <MapContainer
                      center={[
                        isNaN(parseFloat(form.latitude)) ? -6.2088 : parseFloat(form.latitude),
                        isNaN(parseFloat(form.longitude)) ? 106.8456 : parseFloat(form.longitude)
                      ]}
                      zoom={15}
                      scrollWheelZoom={true}
                      zoomControl={false}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; Google Maps'
                        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                      />
                      <ZoomControl position="bottomright" />
                      <ChangeMapView
                        center={[
                          isNaN(parseFloat(form.latitude)) ? -6.2088 : parseFloat(form.latitude),
                          isNaN(parseFloat(form.longitude)) ? 106.8456 : parseFloat(form.longitude)
                        ]}
                      />
                      <MapEventsHandler
                        onChange={(lat, lng) => {
                          setForm(prev => ({
                            ...prev,
                            latitude: lat.toFixed(8),
                            longitude: lng.toFixed(8)
                          }));
                        }}
                      />
                      {!isNaN(parseFloat(form.latitude)) && !isNaN(parseFloat(form.longitude)) && (
                        <>
                          <Marker
                            position={[parseFloat(form.latitude), parseFloat(form.longitude)]}
                            draggable={true}
                            eventHandlers={{
                              dragend: (e) => {
                                const marker = e.target;
                                const position = marker.getLatLng();
                                setForm(prev => ({
                                  ...prev,
                                  latitude: position.lat.toFixed(8),
                                  longitude: position.lng.toFixed(8)
                                }));
                              }
                            }}
                          />
                          <Circle
                            center={[parseFloat(form.latitude), parseFloat(form.longitude)]}
                            radius={parseInt(form.radius) || 100}
                            pathOptions={{ color: '#4f46e5', fillColor: '#818cf8', fillOpacity: 0.2 }}
                          />
                        </>
                      )}
                    </MapContainer>
                  </div>
                  <p className="text-[10px] text-slate-400">Geser penanda (marker) biru atau klik peta untuk menentukan titik koordinat.</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Radius (meter) *</label>
                  <input type="number" value={form.radius} onChange={e => setForm({ ...form, radius: e.target.value })} className="input-field text-sm" required min={10} max={1000} />
                  <p className="text-xs text-slate-400 mt-1">Karyawan harus berada dalam radius ini untuk bisa absen</p>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">Batal</button>
                  <button type="submit" className="btn-primary flex-1 py-2.5 text-sm">{editLoc ? 'Simpan' : 'Tambah'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
