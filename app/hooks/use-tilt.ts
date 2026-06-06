import { useRef } from "react";
import { useMotionValue, useSpring } from "framer-motion";

const TILT_MAX = 7;
const SPRING = { stiffness: 240, damping: 26 };

export function useTilt() {
  const ref = useRef<HTMLElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateY = useSpring(rawX, SPRING);
  const rotateX = useSpring(rawY, SPRING);

  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    rawX.set(dx * TILT_MAX);
    rawY.set(-dy * TILT_MAX);
  }

  function onMouseLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return {
    ref,
    style: { transformPerspective: 900, rotateX, rotateY } as const,
    onMouseMove,
    onMouseLeave,
  };
}
