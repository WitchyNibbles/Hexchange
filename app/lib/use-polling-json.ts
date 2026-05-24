import { startTransition, useEffect, useState } from "react";

export function usePollingJson<T>(loader: () => Promise<T>, initialValue: T, intervalMs = 15000): T {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await loader();
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setValue(next);
        });
      } catch {
        // Keep the last good snapshot so the observatory stays readable.
      }
    };

    void load();
    const handle = window.setInterval(() => {
      void load();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [intervalMs, loader]);

  return value;
}
