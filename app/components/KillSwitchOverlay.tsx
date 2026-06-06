import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { killSwitchEvents } from "../lib/kill-switch-events";

export function KillSwitchOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    killSwitchEvents.register(() => {
      setVisible(true);
      setTimeout(() => setVisible(false), 1200);
    });
    return () => killSwitchEvents.unregister();
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.18, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          style={{
            position: "fixed",
            inset: 0,
            background: "radial-gradient(ellipse at center, rgba(248,113,113,0.0) 30%, rgba(180,20,20,0.55) 100%)",
            pointerEvents: "none",
            zIndex: 8999,
          }}
          aria-hidden
        />
      )}
    </AnimatePresence>
  );
}
