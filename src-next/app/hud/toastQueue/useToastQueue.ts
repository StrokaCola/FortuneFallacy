// React hook + tick driver for the toast queue. Component-side code
// reads visible toasts via `useToastQueue()`; the host component
// owns the rAF that calls `tick()` on the singleton.

import { useEffect, useSyncExternalStore } from 'react';
import { toastQueue } from './queue';
import type { QueueState } from './types';

/**
 * Subscribe to the queue's visible/pending state. Re-renders when
 * either changes. Designed for the ToastHost component but safe to
 * use anywhere a component needs to react to queue state (e.g., a
 * "you have N notifications" hub badge).
 */
export function useToastQueue(): QueueState {
  return useSyncExternalStore(
    toastQueue.subscribe,
    toastQueue.getState,
    toastQueue.getState,
  );
}

/**
 * Starts a ticker that drives the queue's TICK action at a steady
 * cadence. Returns a cleanup that stops the ticker.
 *
 * The cadence is intentionally coarser than rAF — the queue's time
 * resolution only needs to be ~50ms to satisfy the 600ms throttle
 * window and the typical 800-4000ms toast durations. Coarser ticks
 * mean fewer wakeups on mobile (battery), and the host re-renders
 * only when something actually changed (because `dispatch` no-ops
 * the state update when `reduce` returns the same reference).
 */
export function useToastTicker(): void {
  useEffect(() => {
    // Tick once immediately so a push made before mount can promote
    // without waiting up to the first interval.
    toastQueue.tick();
    const id = window.setInterval(() => toastQueue.tick(), 100);
    return () => window.clearInterval(id);
  }, []);
}
