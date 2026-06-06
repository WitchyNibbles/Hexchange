import { useEffect, useRef } from "react";
import { animate } from "framer-motion";

interface Props {
  value: number;
  format?: (n: number) => string;
}

export function AnimatedNumber({ value, format }: Props) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);
  const fmtRef = useRef(format);
  fmtRef.current = format;

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const from = prevValue.current;
    prevValue.current = value;
    if (from === value) return;

    const fmt = fmtRef.current ?? ((n: number) => n.toFixed(2));
    const controls = animate(from, value, {
      duration: 0.72,
      ease: "easeOut",
      onUpdate(latest) {
        el.textContent = fmt(latest);
      },
    });
    return () => controls.stop();
  }, [value]);

  const fmt = format ?? ((n: number) => n.toFixed(2));
  return <span ref={spanRef}>{fmt(value)}</span>;
}
