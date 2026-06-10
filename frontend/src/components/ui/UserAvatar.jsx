// Reusable avatar component — shows photo if available, else initials
export default function UserAvatar({ name, avatar, size = 'md' }) {
  const sizeMap = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-9 h-9 text-sm',
    xl: 'w-12 h-12 text-base',
  };
  const cls = sizeMap[size] || sizeMap.md;

  return (
    <div className={`${cls} rounded-lg bg-gradient-to-br from-slate-700 to-slate-500 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden`}>
      {avatar
        ? <img src={`/uploads/avatar/${avatar}`} alt={name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
        : null}
      <span style={{ display: avatar ? 'none' : 'flex' }} className="w-full h-full items-center justify-center">
        {name?.[0]?.toUpperCase()}
      </span>
    </div>
  );
}
