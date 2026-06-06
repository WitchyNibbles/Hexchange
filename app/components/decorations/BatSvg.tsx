import type { CSSProperties } from "react";

interface BatSvgProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function BatSvg({ size = 80, className, style }: BatSvgProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.525)}
      viewBox="0 0 80 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* Left wing — smooth single bezier, no scallops */}
      <path
        d="M28 26 C20 18, 8 16, 2 24 C2 30, 14 33, 28 30 Z"
        fill="currentColor"
      />
      {/* Right wing — mirror */}
      <path
        d="M52 26 C60 18, 72 16, 78 24 C78 30, 66 33, 52 30 Z"
        fill="currentColor"
      />
      {/* Body — chubby oval */}
      <ellipse cx="40" cy="27" rx="14" ry="11" fill="currentColor" />
      {/* Left ear */}
      <path d="M33 18 L30 8 L38 17 Z" fill="currentColor" />
      {/* Right ear */}
      <path d="M47 18 L50 8 L42 17 Z" fill="currentColor" />
      {/* Left eye — big and round */}
      <circle cx="35" cy="26" r="4.8" fill="rgba(255,255,255,0.96)" />
      <circle cx="35.5" cy="26.5" r="2.6" fill="#02060f" />
      <circle cx="36.8" cy="25" r="1.1" fill="white" />
      {/* Right eye */}
      <circle cx="45" cy="26" r="4.8" fill="rgba(255,255,255,0.96)" />
      <circle cx="45.5" cy="26.5" r="2.6" fill="#02060f" />
      <circle cx="46.8" cy="25" r="1.1" fill="white" />
      {/* Tiny cute nose */}
      <ellipse cx="40" cy="31" rx="1.5" ry="1" fill="rgba(255,200,220,0.7)" />
    </svg>
  );
}
