import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { toast, type ToastEntry } from "../lib/toast";

const kindIcon: Record<string, string> = {
  info: "✦",
  success: "✓",
  warning: "△",
  error: "✕",
};

export function ToastRail() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  useEffect(() => toast.subscribe(setToasts), []);

  return createPortal(
    <div className="toast-rail" role="region" aria-label="Notifications" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast-${t.kind}`}
            role="status"
            onClick={() => toast.dismiss(t.id)}
            initial={{ opacity: 0, x: 40, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.88, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
          >
            <span className="toast-icon">{kindIcon[t.kind] ?? "◈"}</span>
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
