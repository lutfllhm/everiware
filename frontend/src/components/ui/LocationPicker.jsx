import { useEffect, useRef, useState } from 'react';
import { Search, MapPin, X } from 'lucide-react';

// Fix Leaflet default icon path issue dengan Vite
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function LocationPicker({ lat, lng, radius, onChange, onClose }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const initLat = lat ? parseFloat(lat) : -7.2575;
  const initLng = lng ? parseFloat(lng) : 112.7521;
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: true }).setView([initLat, initLng], 16);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Marker awal
    const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
    markerRef.current = marker;

    // Circle radius
    const circle = L.circle([initLat, initLng], {
      radius: parseInt(radius) || 100,
      color: '#1e293b',
      fillColor: '#1e293b',
      fillOpacity: 0.1,
      weight: 2,
    }).addTo(map);
    circleRef.current = circle;

    // Klik peta → pindah marker
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      onChange(lat.toFixed(8), lng.toFixed(8));
    });

    // Drag marker
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      circle.setLatLng([lat, lng]);
      onChange(lat.toFixed(8), lng.toFixed(8));
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update circle radius saat radius berubah
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(parseInt(radius) || 100);
    }
  }, [radius]);

  // Update marker saat lat/lng berubah dari luar (misal: gunakan lokasi saat ini)
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !lat || !lng) return;
    const newLat = parseFloat(lat);
    const newLng = parseFloat(lng);
    markerRef.current.setLatLng([newLat, newLng]);
    circleRef.current?.setLatLng([newLat, newLng]);
    mapInstanceRef.current.setView([newLat, newLng], 16);
  }, [lat, lng]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=5&countrycodes=id`,
        { headers: { 'Accept-Language': 'id' } }
      );
      const data = await res.json();
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    markerRef.current?.setLatLng([lat, lng]);
    circleRef.current?.setLatLng([lat, lng]);
    mapInstanceRef.current?.setView([lat, lng], 17);
    onChange(lat.toFixed(8), lng.toFixed(8));
    setSearchResults([]);
    setSearch(result.display_name.split(',')[0]);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama tempat, jalan, kota..."
              className="input-field pl-9 py-2.5 text-sm w-full"
            />
          </div>
          <button type="submit" disabled={searching}
            className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
            {searching ? '...' : 'Cari'}
          </button>
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-[9999] overflow-hidden">
            {searchResults.map((r) => (
              <button key={r.place_id} type="button" onClick={() => selectResult(r)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700 line-clamp-2">{r.display_name}</span>
                </div>
              </button>
            ))}
            <button type="button" onClick={() => setSearchResults([])}
              className="w-full text-center py-2 text-xs text-slate-400 hover:bg-slate-50">
              Tutup
            </button>
          </div>
        )}
      </form>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200" style={{ height: '320px' }}>
        <div ref={mapRef} className="w-full h-full" />
        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-slate-600 shadow-sm z-[400]">
          🖱️ Klik peta atau geser marker untuk pilih lokasi
        </div>
      </div>
    </div>
  );
}
