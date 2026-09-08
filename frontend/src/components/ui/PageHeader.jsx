import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';

/**
 * Header halaman bergaya app mobile (lihat ProfileHeader di
 * lib/widgets/common_widgets.dart): foto latar bg-apk.jpg + overlay gelap,
 * sudut bawah membulat 28px, bilah merah di samping judul.
 */
export default function PageHeader({
  title,
  subtitle,
  showBack = false,
  avatar,           // { url, fallback, onPick, loading, showCamera }
  name,
  meta,             // baris kecil di bawah nama (departemen · jabatan)
  unread,           // angka badge notifikasi; undefined = ikon disembunyikan
  right,            // node tambahan di kanan atas
  children,         // konten ekstra di bawah header (mis. tab / statistik)
}) {
  const navigate = useNavigate();

  return (
    <div
      className="relative rounded-b-[28px] overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: 'url(/bg-apk.jpg)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/[0.65] to-black/40" />

      <div className="relative px-5 pt-4 pb-5 lg:px-8 lg:pt-6">
        {/* Baris atas: judul + aksi */}
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="text-white/90 hover:text-white transition-colors -ml-1"
              aria-label="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          {title ? (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="w-1 h-[18px] rounded bg-gradient-to-b from-[#EF5350] to-[#C62828] flex-shrink-0" />
              <h1 className="text-white font-extrabold text-base tracking-tight truncate">{title}</h1>
            </div>
          ) : (
            <div className="flex items-center text-white font-black italic text-lg tracking-tight flex-1">
              EV
              <img src="/iwaa.png" alt="" className="w-[22px] h-[22px] mx-[3px] object-contain" />
              RIWARE
            </div>
          )}

          {right}

          {unread !== undefined && (
            <Link
              to="/notifications"
              className="relative w-[38px] h-[38px] rounded-xl bg-white/20 border border-white/[0.12] flex items-center justify-center hover:bg-white/30 transition-colors flex-shrink-0"
              aria-label="Notifikasi"
            >
              <Bell size={19} className="text-white" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] bg-[#EF5350] rounded-full text-white text-[9px] font-bold flex items-center justify-center px-1">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )}
        </div>

        {subtitle && <p className="text-white/70 text-[11.5px] mt-1.5 ml-3.5">{subtitle}</p>}

        {/* Blok profil (opsional) */}
        {avatar && (
          <div className="mt-4 flex items-center gap-3.5">
            <div className="relative flex-shrink-0">
              <div className="w-[60px] h-[60px] rounded-full border-2 border-white shadow-lg overflow-hidden bg-gradient-to-br from-[#8B1F1F] to-[#EF5350] flex items-center justify-center">
                {avatar.url
                  ? <img src={avatar.url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-white font-black text-xl">{avatar.fallback}</span>}
              </div>
              {avatar.showCamera && (
                <label className={`absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md cursor-pointer hover:bg-slate-100 transition-colors ${avatar.loading ? 'opacity-60 pointer-events-none' : ''}`}>
                  {avatar.loading
                    ? <span className="w-3.5 h-3.5 border-2 border-[#8B1F1F] border-t-transparent rounded-full animate-spin" />
                    : <CameraGlyph />}
                  <input type="file" accept="image/*" onChange={avatar.onPick} className="hidden" disabled={avatar.loading} />
                </label>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-white text-lg font-black tracking-tight truncate">{name}</h2>
              {meta && <p className="text-white/70 text-[11px] truncate mt-0.5">{meta}</p>}
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

function CameraGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B1F1F" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
