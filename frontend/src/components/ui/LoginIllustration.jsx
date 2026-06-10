export default function LoginIllustration() {
  return (
    <svg viewBox="0 0 400 420" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-sm">

      {/* ── Background circle ── */}
      <circle cx="200" cy="220" r="170" fill="#f1f5f9" />
      <circle cx="200" cy="220" r="130" fill="#e8edf5" />

      {/* ── Floor / shadow ── */}
      <ellipse cx="200" cy="370" rx="110" ry="14" fill="#cbd5e1" opacity="0.5" />

      {/* ── Body (person standing) ── */}
      {/* Legs */}
      <rect x="175" y="300" width="22" height="65" rx="11" fill="#475569" />
      <rect x="203" y="300" width="22" height="65" rx="11" fill="#334155" />
      {/* Shoes */}
      <rect x="168" y="355" width="32" height="14" rx="7" fill="#1e293b" />
      <rect x="200" y="355" width="32" height="14" rx="7" fill="#0f172a" />

      {/* Torso */}
      <rect x="162" y="200" width="76" height="110" rx="20" fill="#3b82f6" />
      {/* Shirt detail */}
      <rect x="185" y="200" width="30" height="110" rx="0" fill="#2563eb" opacity="0.3" />
      {/* Collar */}
      <path d="M185 200 L200 220 L215 200" fill="#1d4ed8" />

      {/* Left arm — down */}
      <rect x="138" y="205" width="26" height="70" rx="13" fill="#3b82f6" transform="rotate(-8 138 205)" />
      {/* Left hand */}
      <circle cx="148" cy="278" r="12" fill="#fbbf24" />

      {/* Right arm — holding phone up */}
      <rect x="236" y="190" width="26" height="80" rx="13" fill="#3b82f6" transform="rotate(15 236 190)" />
      {/* Right hand */}
      <circle cx="258" cy="268" r="12" fill="#fbbf24" />

      {/* ── Phone in hand ── */}
      <rect x="240" y="130" width="52" height="88" rx="10" fill="#1e293b" transform="rotate(10 240 130)" />
      <rect x="244" y="136" width="44" height="76" rx="8" fill="#0f172a" transform="rotate(10 244 136)" />
      <rect x="246" y="138" width="40" height="72" rx="7" fill="#f8fafc" transform="rotate(10 246 138)" />

      {/* Phone screen content */}
      <rect x="248" y="140" width="40" height="14" rx="7" fill="#1e293b" transform="rotate(10 248 140)" />
      {/* Check icon on screen */}
      <circle cx="272" cy="175" r="12" fill="#dcfce7" transform="rotate(10 272 175)" />
      <path d="M266 175 L270 179 L278 170" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(10 272 175)" />
      {/* Time text on screen */}
      <rect x="254" y="192" width="28" height="4" rx="2" fill="#94a3b8" transform="rotate(10 254 192)" />
      <rect x="258" y="199" width="20" height="3" rx="1.5" fill="#cbd5e1" transform="rotate(10 258 199)" />

      {/* ── Head ── */}
      <circle cx="200" cy="165" r="38" fill="#fbbf24" />
      {/* Hair */}
      <path d="M162 155 C162 130 238 130 238 155 L238 148 C238 120 162 120 162 148 Z" fill="#1e293b" />
      {/* Eyes */}
      <circle cx="188" cy="162" r="5" fill="#1e293b" />
      <circle cx="212" cy="162" r="5" fill="#1e293b" />
      <circle cx="190" cy="160" r="2" fill="white" />
      <circle cx="214" cy="160" r="2" fill="white" />
      {/* Smile */}
      <path d="M188 175 Q200 185 212 175" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Ear */}
      <ellipse cx="162" cy="168" rx="6" ry="8" fill="#f59e0b" />
      <ellipse cx="238" cy="168" rx="6" ry="8" fill="#f59e0b" />

      {/* ── Floating badges ── */}
      {/* Location badge */}
      <g transform="translate(60, 140)">
        <rect x="0" y="0" width="80" height="32" rx="16" fill="white" style={{filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.10))'}} />
        <circle cx="20" cy="16" r="10" fill="#dbeafe" />
        <text x="20" y="20" fontSize="10" textAnchor="middle">📍</text>
        <rect x="36" y="10" width="34" height="5" rx="2.5" fill="#1e293b" />
        <rect x="36" y="18" width="24" height="4" rx="2" fill="#94a3b8" />
      </g>

      {/* Time badge */}
      <g transform="translate(270, 80)">
        <rect x="0" y="0" width="90" height="32" rx="16" fill="white" style={{filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.10))'}} />
        <circle cx="20" cy="16" r="10" fill="#fef9c3" />
        <text x="20" y="20" fontSize="10" textAnchor="middle">⏰</text>
        <rect x="36" y="10" width="40" height="5" rx="2.5" fill="#1e293b" />
        <rect x="36" y="18" width="28" height="4" rx="2" fill="#94a3b8" />
      </g>

      {/* Success badge */}
      <g transform="translate(50, 280)">
        <rect x="0" y="0" width="96" height="36" rx="18" fill="white" style={{filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.10))'}} />
        <circle cx="22" cy="18" r="11" fill="#dcfce7" />
        <path d="M16 18 L20 22 L28 13" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="40" y="11" width="42" height="5" rx="2.5" fill="#16a34a" />
        <rect x="40" y="20" width="30" height="4" rx="2" fill="#86efac" />
      </g>

      {/* Sparkles */}
      <text x="320" y="160" fontSize="18" opacity="0.6">✨</text>
      <text x="55" y="200" fontSize="14" opacity="0.5">⭐</text>
      <text x="340" y="300" fontSize="16" opacity="0.5">✨</text>
    </svg>
  );
}
