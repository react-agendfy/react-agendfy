import { useEffect, useState } from "react";

/**
 * Re-renders the caller once a minute (aligned to the minute) while
 * `enabled` — enough for the current-time line to move.
 */
export function useMinuteTick(enabled = true): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setTick((t) => t + 1);
      interval = setInterval(() => setTick((t) => t + 1), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [enabled]);
  return tick;
}
