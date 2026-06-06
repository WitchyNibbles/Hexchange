import { startTransition, useEffect, useState } from "react";

export function usePollingJson<T>(
  loader: () => Promise<T>,
  initialValue: T,
  baseIntervalMs = 15000,
): { value: T; loading: boolean } {
  const [value, setValue] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;
    let failureCount = 0;

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = Math.min(baseIntervalMs * Math.pow(2, failureCount), 60_000);
      timeoutId = window.setTimeout(() => { void load(); }, delay);
    };

    const load = async () => {
      try {
        const next = await loader();
        if (cancelled) return;
        failureCount = 0;
        startTransition(() => {
          setValue(next);
          setLoading(false);
        });
      } catch {
        // Keep the last good snapshot so the observatory stays readable.
        if (!cancelled) {
          failureCount = Math.min(failureCount + 1, 5);
          setLoading(false);
        }
      }
      scheduleNext();
    };

    void load();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [baseIntervalMs, loader]);

  return { value, loading };
}
