export default function RegisterIllustration() {
  return (
    <svg viewBox="0 0 400 420" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-sm">

      {/* ── Background ── */}
      <circle cx="200" cy="220" r="170" fill="#f0fdf4" />
      <circle cx="200" cy="220" r="130" fill="#dcfce7" />

      {/* ── Floor shadow ── */}
      <ellipse cx="200" cy="370" rx="110" ry="14" fill="#86efac" opacity="0.4" />

      {/* ── Legs ── */}
      <rect x="175" y="300" width="22" height="65" rx="11" fill="#475569" />
      <rect x="203" y="300" width="22" height="65" rx="11" fill="#334155" />
      {/* Shoes */}
      <rect x="168" y="355" width="32" height="14" rx="7" fill="#1e293b" />
      <rect x="200" y="355" width="32" height="14" rx="7" fill="#0f172a" />

      {/* ── Torso — green shirt ── */}
      <rect x="162" y="200" width="76" height="110" rx="20" fill="#16a34a" />
      <rect x="185" y="200" width="30" height="110" rx="0" fill="#15803d" opacity="0.3" />
      <path d="M185 200 L200 220 L215 200" fill="#166534" />

      {/* ── Left arm — raised, holding document ── */}
      <rect x="130" y="185" width="26" height="80" rx="13" fill="#16a34a" transform="rotate(-20 130 185)" />
      <circle cx="122" cy="262" r="12" fill="#fbbf24" />

      {/* Document in left hand */}
      <rect x="80" y="200" width="52" height="66" rx="8" fill="white" style={{filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.12))'}} />
      <rect x="88" y="212" width="36" height="4" rx="2" fill="#e2e8f0" />
      <rect x="88" y="220" width="28" height="4" rx="2" fill="#e2e8f0" />
      <rect x="88" y="228" width="32" height="4" rx="2" fill="#e2e8f0" />
      <rect x="88" y="236" width="20" height="4" rx="2" fill="#e2e8f0" />
      {/* Checkmark on document */}
      <circle cx="106" cy="254" r="10" fill="#dcfce7" />
      <path d="M100 254 L104 258 L112 249" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* ── Right arm — waving ── */}
      <rect x="238" y="195" width="26" height="75" rx="13" fill="#16a34a" transform="rotate(25 238 195)" />
      <circle cx="272" cy="265" r="12" fill="#fbbf24" />

      {/* ── Head ── */}
      <circle cx="200" cy="165" r="38" fill="#fbbf24" />
      {/* Hair — different style */}
      <path d="M162 150 C162 122 238 122 238 150 L238 140 C238 115 162 115 162 140 Z" fill="#92400e" />
      <path d="M162 150 C155 145 152 135 158 128" stroke="#92400e" strokeWidth="8" strokeLinecap="round" />
      <path d="M238 150 C245 145 248 135 242 128" stroke="#92400e" strokeWidth="8" strokeLinecap="round" />
      {/* Eyes — happy squint */}
      <path d="M183 160 Q188 155 193 160" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M207 160 Q212 155 217 160" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Big smile */}
      <path d="M185 175 Q200 190 215 175" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Cheeks */}
      <circle cx="183" cy="175" r="7" fill="#f87171" opacity="0.35" />
      <circle cx="217" cy="175" r="7" fill="#f87171" opacity="0.35" />
      {/* Ears */}
      <ellipse cx="162" cy="168" rx="6" ry="8" fill="#f59e0b" />
      <ellipse cx="238" cy="168" rx="6" ry="8" fill="#f59e0b" />

      {/* ── Floating badges ── */}
      {/* Welcome badge */}
      <g transform="translate(255, 110)">
        <rect x="0" y="0" width="110" height="36" rx="18" fill="white" style={{filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.10))'}} />
        <circle cx="22" cy="18" r="11" fill="#dcfce7" />
        <text x="22" y="22" fontSize="11" textAnchor="middle">🎉</text>
        <rect x="40" y="11" width="56" height="5" rx="2.5" fill="#16a34a" />
        <rect x="40" y="20" width="40" height="4" rx="2" fill="#86efac" />
      </g>

      {/* Email badge */}
      <g transform="translate(40, 130)">
        <rect x="0" y="0" width="96" height="36" rx="18" fill="white" style={{filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.10))'}} />
        <circle cx="22" cy="18" r="11" fill="#dbeafe" />
        <text x="22" y="22" fontSize="11" textAnchor="middle">📧</text>
        <rect x="40" y="11" width="42" height="5" rx="2.5" fill="#1e293b" />
        <rect x="40" y="20" width="30" height="4" rx="2" fill="#94a3b8" />
      </g>

      {/* OTP badge */}
      <g transform="translate(270, 280)">
        <rect x="0" y="0" width="100" height="36" rx="18" fill="white" style={{filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.10))'}} />
        <circle cx="22" cy="18" r="11" fill="#fef9c3" />
        <text x="22" y="22" fontSize="11" textAnchor="middle">🔐</text>
        <rect x="40" y="11" width="46" height="5" rx="2.5" fill="#1e293b" />
        <rect x="40" y="20" width="32" height="4" rx="2" fill="#94a3b8" />
      </g>

      {/* Sparkles */}
      <text x="50" y="290" fontSize="18" opacity="0.6">🌟</text>
      <text x="330" y="170" fontSize="14" opacity="0.5">✨</text>
      <text x="340" y="340" fontSize="16" opacity="0.5">🎊</text>
    </svg>
  );
}
