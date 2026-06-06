interface IconProps {
  size?: number;
}

export function ObservatoryIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <line x1="8" y1="1.5" x2="8" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="8" y1="11.5" x2="8" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="1.5" y1="8" x2="4.5" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="11.5" y1="8" x2="14.5" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SpellbookIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 3h5v10H2V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9 3h5v10H9V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 3.8C7.28 7.8 7.4 10.6 7 12.2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.55" />
      {/* 4-pointed sparkle on right page */}
      <path d="M11.5 5.2L12 6.5L13.3 7L12 7.5L11.5 8.8L11 7.5L9.7 7L11 6.5Z" fill="currentColor" opacity="0.82" />
    </svg>
  );
}

export function LedgerIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="2" width="11" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="5" y1="5.5" x2="11.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="5" y1="8" x2="11.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="5" y1="10.5" x2="9" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
