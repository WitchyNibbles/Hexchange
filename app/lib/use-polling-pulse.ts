import { startTransition, useEffect, useRef, useState } from "react";

export function usePollingPulse<T>(
  loader: () => Promise<T>,
  initialValue: T,
  baseIntervalMs = 15000,
): { value: T; isPulsing: boolean; loading: boolean } {
  const [value, setValue] = useState<T>(initialValue);
  const [isPulsing, setIsPulsing] = useState(false);
  const [loading, setLoading] = useState(true);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;
    let failureCount = 0;

    const triggerPulse = () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      setIsPulsing(true);
      pulseTimerRef.current = setTimeout(() => {
        if (!cancelled) setIsPulsing(false);
      }, 800);
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = Math.min(baseIntervalMs * Math.pow(2, failureCount), 60_000);
      timeoutId = window.setTimeout(() => {
        void load();
      }, delay);
    };

    const load = async () => {
      try {
        const next = await loader();
        if (cancelled) return;
        failureCount = 0;
        triggerPulse();
        startTransition(() => {
          setValue(next);
          setLoading(false);
        });
      } catch {
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
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [baseIntervalMs, loader]);

  return { value, isPulsing, loading };
}
