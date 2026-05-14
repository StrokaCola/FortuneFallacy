// Pure toast-queue reducer. All state transitions are functions
// `(state, action) => state` so the React layer can drive them
// without smuggling React state into the logic.
//
// Three actions:
//   PUSH    — enqueue a new toast (or merge into an existing one)
//   TICK    — advance time: expire visible, promote pending
//   DISMISS — remove a specific visible toast immediately
//
// Important invariants:
//   - `visible.length <= MAX_VISIBLE` (2 by default).
//   - At most one promotion per TICK, regardless of headroom — that
//     keeps the inter-toast throttle observable. Multiple slots become
//     free → multiple ticks promote them, one per `MIN_PROMOTION_INTERVAL_MS`.
//   - Pending is sorted by priority on every PUSH so the next pop is
//     always the highest-priority one. Same priority is FIFO via
//     stable Array.prototype.sort.

import {
  type QueueState,
  type ToastDescriptor,
  type VisibleToast,
  EMPTY_STATE,
  PRIORITY_RANK,
  QUEUE_LIMITS,
} from './types';

export type QueueAction =
  | { type: 'PUSH'; descriptor: ToastDescriptor; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'DISMISS'; id: string };

export function reduce(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'PUSH':
      return reducePush(state, action.descriptor, action.now);
    case 'TICK':
      return reduceTick(state, action.now);
    case 'DISMISS':
      return reduceDismiss(state, action.id);
    default:
      return state;
  }
}

function reducePush(state: QueueState, incoming: ToastDescriptor, now: number): QueueState {
  // Same-key collision: try to merge into the FIRST descriptor with
  // matching key (search visible first, then pending). The found
  // descriptor's `merge` is preferred; falls back to the incoming
  // descriptor's merge so the caller can decide the policy.
  if (incoming.key) {
    const vi = state.visible.findIndex((v) => v.key === incoming.key);
    if (vi >= 0) {
      const cur = state.visible[vi]!;
      const merge = cur.merge ?? incoming.merge;
      if (merge) {
        const merged: VisibleToast = {
          ...cur,
          data: merge(incoming.data, cur.data),
          // Reset the visible clock so the merged toast gets the
          // full duration from the moment of the latest push.
          shownAt: now,
        };
        const visible = state.visible.slice();
        visible[vi] = merged;
        return { ...state, visible };
      }
      // No merge function — incoming replaces in place (keeps the
      // visible slot but adopts the incoming descriptor).
      const visible = state.visible.slice();
      visible[vi] = { ...incoming, shownAt: now };
      return { ...state, visible };
    }
    const pi = state.pending.findIndex((p) => p.key === incoming.key);
    if (pi >= 0) {
      const cur = state.pending[pi]!;
      const merge = cur.merge ?? incoming.merge;
      const next: ToastDescriptor = merge
        ? { ...cur, data: merge(incoming.data, cur.data) }
        : incoming;
      const pending = state.pending.slice();
      pending[pi] = next;
      return { ...state, pending: sortByPriority(pending) };
    }
  }

  // No collision: append to pending, sorted by priority.
  const pending = sortByPriority([...state.pending, incoming]);
  return { ...state, pending };
}

function reduceTick(state: QueueState, now: number): QueueState {
  // 1. Expire any visible toast whose duration has elapsed.
  const stillVisible = state.visible.filter((v) => now - v.shownAt < v.durationMs);
  const expiredCount = state.visible.length - stillVisible.length;

  // 2. Promote at most one pending toast per tick, subject to the
  //    inter-toast throttle. The throttle window is bypassed when the
  //    promotion comes after an expiration (i.e., empty slots that
  //    just became free) — that prevents a long-duration toast from
  //    locking out the next one for far longer than needed.
  let visible = stillVisible;
  let pending = state.pending;
  let lastPromotionAt = state.lastPromotionAt;

  const hasHeadroom = visible.length < QUEUE_LIMITS.MAX_VISIBLE;
  // `lastPromotionAt` is initialised to -Infinity so the first-ever
  // promotion always clears the throttle. Expiry events also bypass —
  // a freshly-freed slot should fill immediately, not wait out the
  // window from the previous promotion.
  const throttleClear = expiredCount > 0
    || now - state.lastPromotionAt >= QUEUE_LIMITS.MIN_PROMOTION_INTERVAL_MS;

  if (hasHeadroom && throttleClear && pending.length > 0) {
    const next = pending[0]!;
    pending = pending.slice(1);
    visible = [...visible, { ...next, shownAt: now }];
    lastPromotionAt = now;
  }

  if (visible === state.visible && pending === state.pending && lastPromotionAt === state.lastPromotionAt) {
    return state;
  }
  return { visible, pending, lastPromotionAt };
}

function reduceDismiss(state: QueueState, id: string): QueueState {
  const idx = state.visible.findIndex((v) => v.id === id);
  if (idx < 0) return state;
  const visible = state.visible.slice();
  visible.splice(idx, 1);
  return { ...state, visible };
}

// Stable priority sort: rank ascending (critical = 0 wins), same rank
// preserves insertion order via Array.prototype.sort stability.
function sortByPriority(pending: ToastDescriptor[]): ToastDescriptor[] {
  return pending
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const pr = PRIORITY_RANK[a.p.priority] - PRIORITY_RANK[b.p.priority];
      return pr !== 0 ? pr : a.i - b.i;
    })
    .map(({ p }) => p);
}

export const initialState: QueueState = EMPTY_STATE;
