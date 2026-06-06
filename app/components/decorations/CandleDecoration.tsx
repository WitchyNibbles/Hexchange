export function CandleDecoration() {
  return (
    <svg
      width="28"
      height="64"
      viewBox="0 0 28 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Soft glow halo behind flame */}
      <ellipse cx="14" cy="13" rx="10" ry="9" fill="rgba(251,191,36,0.07)" />

      {/* Flame group — CSS flicker animation */}
      <g className="candle-flame-svg">
        {/* Outer flame — orange */}
        <path
          d="M14 14 C10 11, 8 5, 12 2 C12.8 1, 15.2 1, 16 2 C20 5, 18 11, 14 14 Z"
          fill="rgba(249,115,22,0.82)"
        />
        {/* Mid flame — amber */}
        <path
          d="M14 13 C11.5 10, 10 6, 13 3 C13.6 2.3, 14.4 2.3, 15 3 C18 6, 16.5 10, 14 13 Z"
          fill="rgba(251,191,36,0.95)"
        />
        {/* Inner flame — pale yellow */}
        <path
          d="M14 11 C12.5 9, 12 6.5, 13.5 4.5 C13.8 4, 14.2 4, 14.5 4.5 C16 6.5, 15.5 9, 14 11 Z"
          fill="rgba(254,240,138,0.95)"
        />
        {/* White-hot core */}
        <ellipse cx="14" cy="7.5" rx="1.6" ry="2.5" fill="rgba(255,255,255,0.8)" />
      </g>

      {/* Wick */}
      <line
        x1="14" y1="14" x2="14" y2="17"
        stroke="rgba(100,80,60,0.75)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* Candle body */}
      <rect x="10" y="16" width="8" height="42" rx="1.5" fill="rgba(245,248,255,0.9)" />
      {/* Right highlight stripe */}
      <rect x="17" y="16" width="1.4" height="42" rx="0.7" fill="rgba(255,255,255,0.55)" />
      {/* Left shadow stripe */}
      <rect x="10" y="16" width="1.4" height="42" rx="0.7" fill="rgba(0,0,20,0.07)" />
      {/* Wax drip detail */}
      <path
        d="M18 19 Q20 24 19.5 32"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Holder */}
      <ellipse cx="14" cy="59" rx="9" ry="3" fill="rgba(180,185,215,0.28)" />
      <rect x="10" y="57" width="8" height="3" rx="1" fill="rgba(180,185,215,0.18)" />
    </svg>
  );
}
