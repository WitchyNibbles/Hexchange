import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast, type ToastEntry } from "../lib/toast";

export function ToastRail() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => toast.subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-rail" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}`}
          role="status"
          onClick={() => toast.dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  );
}
