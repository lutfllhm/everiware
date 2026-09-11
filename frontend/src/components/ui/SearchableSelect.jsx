import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X } from 'lucide-react';

/**
 * Dropdown pengganti <select> untuk daftar yang panjang.
 *
 * Alasannya: popup <select> bawaan digambar browser — tingginya tidak bisa
 * dibatasi CSS, jadi daftar departemen yang panjang memanjang ke bawah sampai
 * menutupi layar. Di sini popup-nya elemen biasa, jadi bisa dikunci
 * max-height + scroll, dan sekalian dikasih kolom cari.
 *
 * Props:
 *   value, onChange(value)  — terkendali, sama seperti <select>
 *   options                 — array string, atau { value, label }
 *   placeholder             — teks saat belum ada pilihan
 *   searchPlaceholder       — teks di kolom cari
 *   disabled, className, id
 *   emptyLabel              — teks saat hasil pencarian kosong
 *   clearable               — tampilkan tombol hapus pilihan
 *   footer({ close, query }) — aksi pinned di bawah daftar, mis. "+ Tambah baru"
 *   searchThreshold         — kolom cari baru muncul kalau opsi >= ini (default 7)
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = '-- Pilih --',
  searchPlaceholder = 'Cari...',
  disabled = false,
  className = '',
  id,
  emptyLabel = 'Tidak ada hasil',
  clearable = false,
  footer,
  searchThreshold = 7,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const searchRef = useRef(null);

  // Samakan bentuk opsi supaya pemakaian string biasa tetap ringkas.
  const items = useMemo(
    () => options.map(o => (typeof o === 'object' && o !== null ? o : { value: o, label: String(o) })),
    [options]
  );

  const selected = items.find(o => o.value === value);
  const showSearch = items.length >= searchThreshold;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(o => o.label.toLowerCase().includes(q));
  }, [items, query]);

  // Popup pakai position:fixed + portal supaya tidak terpotong modal atau
  // container ber-overflow (form karyawan punya overflow-y-auto).
  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const MAX = 288;
    // Buka ke atas kalau ruang di bawah sempit tapi di atas lebih lega.
    const up = below < 200 && r.top > below;
    setRect({
      left: r.left,
      width: r.width,
      top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      maxH: Math.max(160, Math.min(MAX, (up ? r.top : below) - 12)),
    });
  }, []);

  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);

  useEffect(() => {
    if (!open) return;
    place();
    // Reposisi saat scroll/resize — capture:true supaya ikut container dalam.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
  }, [open, showSearch]);

  // Mulai sorot dari item yang sedang dipilih.
  useEffect(() => {
    if (!open) return;
    const i = shown.findIndex(o => o.value === value);
    setHighlight(i >= 0 ? i : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setHighlight(0); }, [query]);

  // Jaga item tersorot tetap terlihat saat navigasi keyboard.
  useEffect(() => {
    if (!open) return;
    popRef.current?.querySelector('[data-hl="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const pick = (opt) => { onChange(opt.value); close(); btnRef.current?.focus(); };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); btnRef.current?.focus(); return; }
    // Enter di dalam modal tidak boleh men-submit form karyawan.
    if (e.key === 'Enter') { e.preventDefault(); if (shown[highlight]) pick(shown[highlight]); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, shown.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); return; }
    if (e.key === 'Tab') close();
  };

  return (
    <>
      <button
        type="button"
        id={id}
        ref={btnRef}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`input-field text-sm flex items-center gap-2 text-left disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
      >
        <span className={`flex-1 min-w-0 truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {clearable && selected && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            title="Hapus pilihan"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <X size={13} />
          </span>
        )}
        <ChevronDown
          size={15}
          className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && rect && createPortal(
        <div
          ref={popRef}
          style={{ left: rect.left, width: rect.width, top: rect.top, bottom: rect.bottom }}
          className="fixed z-[60] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
        >
          {showSearch && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-400"
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto py-1" style={{ maxHeight: rect.maxH }}>
            {shown.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">{emptyLabel}</div>
            ) : shown.map((opt, i) => {
              const isSel = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-hl={i === highlight ? '1' : undefined}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(opt)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    i === highlight ? 'bg-slate-100' : ''
                  } ${isSel ? 'font-medium text-slate-900' : 'text-slate-600'}`}
                >
                  <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                  {isSel && <Check size={14} className="text-slate-900 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {footer && (
            <div className="border-t border-slate-100 p-1">
              {footer({ close, query })}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
