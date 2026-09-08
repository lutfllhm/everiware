import { ChevronRight } from 'lucide-react';

/**
 * Grup pengaturan bergaya app mobile (_SettingsSection di profile_screen.dart):
 * judul kecil kapital di atas, kartu putih radius 18 berisi baris-baris.
 */
export function SettingsSection({ title, children }) {
  return (
    <div>
      {title && (
        <p className="pl-1 pb-2 pt-3 text-[11px] font-bold text-stone-400 tracking-[0.08em]">
          {title}
        </p>
      )}
      <div className="bg-white rounded-[18px] border border-[#E7E5E4] overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.03)]">
        {children}
      </div>
    </div>
  );
}

/** Satu baris di dalam SettingsSection. */
export function SettingsRow({
  icon: Icon,
  iconColor = '#8B1F1F',
  iconBg = 'rgba(139,31,31,0.06)',
  title,
  subtitle,
  onClick,
  trailing,          // node pengganti chevron (mis. toggle)
  expanded,          // konten yang muncul di bawah baris saat terbuka
  titleColor,
  isLast = false,
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div>
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`w-full flex items-center gap-3.5 px-[18px] py-3 text-left ${
          onClick ? 'hover:bg-stone-50 active:bg-stone-100 transition-colors' : ''
        }`}
      >
        <span
          className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={18} style={{ color: iconColor }} />
        </span>

        <span className="flex-1 min-w-0">
          <span
            className="block font-bold text-sm truncate"
            style={{ color: titleColor || '#1C1917' }}
          >
            {title}
          </span>
          {subtitle && (
            <span className="block text-[11px] text-stone-400 truncate mt-0.5">{subtitle}</span>
          )}
        </span>

        {trailing !== undefined
          ? trailing
          : <ChevronRight size={20} className="text-stone-400 flex-shrink-0" />}
      </Tag>

      {expanded}

      {!isLast && <div className="h-px bg-[#F5F5F4] ml-[70px]" />}
    </div>
  );
}
