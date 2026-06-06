import type { CSSProperties } from "react";

interface CatSvgProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function CatSvg({ size = 56, className, style }: CatSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* Face — large round */}
      <circle cx="28" cy="32" r="22" fill="currentColor" />
      {/* Left ear outer */}
      <polygon points="9,18 5,2 20,16" fill="currentColor" />
      {/* Left ear inner — pink */}
      <polygon points="10.5,17 7.5,5 17.5,15" fill="rgba(255,160,200,0.55)" />
      {/* Right ear outer */}
      <polygon points="47,18 51,2 36,16" fill="currentColor" />
      {/* Right ear inner — pink */}
      <polygon points="45.5,17 48.5,5 38.5,15" fill="rgba(255,160,200,0.55)" />
      {/* Left eye — large accent-coloured iris */}
      <circle cx="19" cy="31" r="7.5" fill="rgba(76,201,240,0.92)" />
      <circle cx="19.5" cy="31.5" r="4.2" fill="#02060f" />
      <circle cx="21.2" cy="29.5" r="1.6" fill="white" />
      <circle cx="19" cy="33" r="0.7" fill="rgba(255,255,255,0.55)" />
      {/* Right eye */}
      <circle cx="37" cy="31" r="7.5" fill="rgba(76,201,240,0.92)" />
      <circle cx="37.5" cy="31.5" r="4.2" fill="#02060f" />
      <circle cx="39.2" cy="29.5" r="1.6" fill="white" />
      <circle cx="37" cy="33" r="0.7" fill="rgba(255,255,255,0.55)" />
      {/* Nose — small pink triangle */}
      <polygon points="26.5,37 28,39.5 29.5,37 28,36" fill="rgba(255,160,200,0.85)" />
      {/* Mouth — kawaii W shape */}
      <path
        d="M25.5 40 Q28 42.5 30.5 40"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      <line
        x1="28" y1="39.5" x2="28" y2="41"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Whiskers left */}
      <line x1="6" y1="36" x2="20" y2="37" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" />
      <line x1="5" y1="38.5" x2="20" y2="38.5" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" />
      {/* Whiskers right */}
      <line x1="36" y1="37" x2="50" y2="36" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" />
      <line x1="36" y1="38.5" x2="51" y2="38.5" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" />
    </svg>
  );
}
