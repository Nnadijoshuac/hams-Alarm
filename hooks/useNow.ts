import { useEffect, useState } from 'react';

/** Current time, re-rendering every `intervalMs` (aligned to the next tick). */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(() => {
      setNow(Date.now());
      interval = setInterval(() => setNow(Date.now()), intervalMs);
    }, intervalMs - (Date.now() % intervalMs));
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, [intervalMs, active]);
  return now;
}
