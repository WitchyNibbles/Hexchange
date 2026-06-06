export type ToastKind = "info" | "success" | "error" | "warning";

export interface ToastEntry {
  id: string;
  message: string;
  kind: ToastKind;
}

type Listener = (toasts: ToastEntry[]) => void;

const AUTO_DISMISS_MS = 4000;

let queue: ToastEntry[] = [];
const listeners = new Set<Listener>();

function notify() {
  const snapshot = [...queue];
  listeners.forEach((l) => l(snapshot));
}

export const toast = {
  show(message: string, kind: ToastKind = "info") {
    const id = `${Date.now()}-${Math.random()}`;
    queue = [...queue, { id, message, kind }];
    notify();
    setTimeout(() => toast.dismiss(id), AUTO_DISMISS_MS);
  },

  dismiss(id: string) {
    queue = queue.filter((t) => t.id !== id);
    notify();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
