import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function CursorAura() {
  const rawX = useMotionValue(-500);
  const rawY = useMotionValue(-500);

  // Soft spring — lags behind cursor for an ethereal float feel
  const x = useSpring(rawX, { stiffness: 72, damping: 20 });
  const y = useSpring(rawY, { stiffness: 72, damping: 20 });

  useEffect(() => {
    function onMove(e: MouseEvent) {
      rawX.set(e.clientX);
      rawY.set(e.clientY);
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [rawX, rawY]);

  return (
    <motion.div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        x,
        y,
        translateX: "-50%",
        translateY: "-50%",
        width: 420,
        height: 420,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(76,201,240,0.055) 0%, rgba(76,201,240,0.018) 40%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 2,
        mixBlendMode: "screen",
      }}
    />
  );
}
