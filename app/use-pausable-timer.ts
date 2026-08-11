import { useEffect, useRef } from "react";

export function getRemainingTime(
  remainingMs: number,
  startedAtMs: number,
  nowMs: number,
): number {
  return Math.max(0, remainingMs - Math.max(0, nowMs - startedAtMs));
}

export function usePausableTimeout(
  callback: () => void,
  delayMs: number,
  running: boolean,
  timerKey: string | number | null,
) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<number | null>(null);
  const timingRef = useRef({
    key: timerKey,
    delayMs,
    remainingMs: delayMs,
    startedAtMs: null as number | null,
  });
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const timing = timingRef.current;
    if (timing.key !== timerKey || timing.delayMs !== delayMs) {
      timing.key = timerKey;
      timing.delayMs = delayMs;
      timing.remainingMs = delayMs;
      timing.startedAtMs = null;
    }
    if (!running || timerKey === null) return;

    timing.startedAtMs = performance.now();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      timing.startedAtMs = null;
      timing.remainingMs = delayMs;
      callbackRef.current();
    }, timing.remainingMs);

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      if (timing.startedAtMs !== null) {
        timing.remainingMs = getRemainingTime(
          timing.remainingMs,
          timing.startedAtMs,
          performance.now(),
        );
      }
      timing.startedAtMs = null;
    };
  }, [delayMs, running, timerKey]);
}

export function usePausableInterval(
  callback: () => void,
  delayMs: number,
  running: boolean,
) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<number | null>(null);
  const timingRef = useRef({
    delayMs,
    remainingMs: delayMs,
    startedAtMs: null as number | null,
  });
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const timing = timingRef.current;
    if (timing.delayMs !== delayMs) {
      timing.delayMs = delayMs;
      timing.remainingMs = delayMs;
      timing.startedAtMs = null;
    }
    if (!running) return;

    let cancelled = false;
    const schedule = (waitMs: number) => {
      timing.startedAtMs = performance.now();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        timing.startedAtMs = null;
        timing.remainingMs = delayMs;
        callbackRef.current();
        if (!cancelled) schedule(delayMs);
      }, waitMs);
    };
    schedule(timing.remainingMs);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      if (timing.startedAtMs !== null) {
        timing.remainingMs = getRemainingTime(
          timing.remainingMs,
          timing.startedAtMs,
          performance.now(),
        );
      }
      timing.startedAtMs = null;
    };
  }, [delayMs, running]);
}
