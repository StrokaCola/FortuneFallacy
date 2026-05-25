// Shared SFX scheduler. Wraps setTimeout so deferred sfxPlay calls can be
// cancelled when the context they belong to ends — e.g. a chord stack
// scheduled at cross-target+150ms should NOT fire if the round ended at
// cross-target+50ms.
//
// Each scheduler instance owns its own pending-timeout set, so the
// scoring router's queue is independent from the audioBridge's
// round-bound queue. Callers register an unsubscribe in their teardown
// path to drain in-flight timers.
//
// 2026-05-22 — introduced to fix the "sounds queued during a round
// continue playing after the round has ended" report.
export type SfxScheduler = {
  /** Schedule fn() to run after ms. Tracked for cancellation. */
  schedule: (fn: () => void, ms: number) => void;
  /** Cancel every pending timer in this scheduler's queue. */
  cancelAll: () => void;
  /** Number of in-flight timers — exposed for tests + diagnostics. */
  pendingCount: () => number;
};

export function makeSfxScheduler(): SfxScheduler {
  const pending = new Set<ReturnType<typeof setTimeout>>();
  return {
    schedule(fn, ms) {
      const id = setTimeout(() => {
        pending.delete(id);
        fn();
      }, ms);
      pending.add(id);
    },
    cancelAll() {
      for (const id of pending) clearTimeout(id);
      pending.clear();
    },
    pendingCount() {
      return pending.size;
    },
  };
}
