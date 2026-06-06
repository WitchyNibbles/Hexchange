interface SkeletonProps {
  height?: string | number;
  width?: string | number;
  borderRadius?: string;
}

export function Skeleton({ height = "1rem", width = "100%", borderRadius = "0.5rem" }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ height, width, borderRadius }}
      aria-hidden="true"
    />
  );
}

const LINE_WIDTHS = ["88%", "72%", "94%", "66%", "80%"] as const;

interface SkeletonPanelProps {
  lines?: number;
  titleHeight?: string;
  heroHeight?: string;
}

export function SkeletonPanel({ lines = 3, titleHeight = "1.15rem", heroHeight }: SkeletonPanelProps) {
  return (
    <div className="skeleton-panel">
      <Skeleton height={titleHeight} width="42%" />
      {heroHeight && <Skeleton height={heroHeight} width="56%" borderRadius="0.75rem" />}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="0.85rem" width={LINE_WIDTHS[i % LINE_WIDTHS.length]} />
      ))}
    </div>
  );
}
