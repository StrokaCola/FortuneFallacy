// Module-level toast queue store. Singleton because every component
// in the app needs to be able to push without prop-drilling and the
// host needs to read without context (it lives at the App root and
// can just consume the store).
//
// The state lives outside React; `useToastQueue()` subscribes via
// `useSyncExternalStore` so render updates are batched correctly.
// Tests can construct an isolated queue with `createQueue()` to
// avoid singleton pollution.

import { reduce, initialState, type QueueAction } from './reducer';
import type { QueueState, ToastDescriptor } from './types';

export type QueueHandle = {
  getState(): QueueState;
  subscribe(listener: () => void): () => void;
  dispatch(action: QueueAction): void;
  // Convenience: enqueue a descriptor with `now = Date.now()`.
  push<TData>(desc: ToastDescriptor<TData>): void;
  // Convenience: dismiss a visible toast by id.
  dismiss(id: string): void;
  // Convenience: drive a TICK. The host calls this on a rAF/timer.
  tick(): void;
  // Test-only: reset to the empty state.
  _reset(): void;
};

export function createQueue(): QueueHandle {
  let state: QueueState = initialState;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const fn of listeners) {
      try { fn(); } catch (e) { console.warn('[toastQueue] listener error:', e); }
    }
  };

  const dispatch = (action: QueueAction): void => {
    const next = reduce(state, action);
    if (next === state) return;
    state = next;
    notify();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispatch,
    push(desc) {
      dispatch({ type: 'PUSH', descriptor: desc as ToastDescriptor, now: Date.now() });
    },
    dismiss(id) {
      dispatch({ type: 'DISMISS', id });
    },
    tick() {
      dispatch({ type: 'TICK', now: Date.now() });
    },
    _reset() {
      state = initialState;
      notify();
    },
  };
}

// Default singleton — production consumers should reach for this.
export const toastQueue: QueueHandle = createQueue();

/**
 * Enqueue a toast. Convenience wrapper around the singleton's `push`.
 * Generic over `TData` so callers get type-checked merge functions.
 */
export function pushToast<TData>(desc: ToastDescriptor<TData>): void {
  toastQueue.push(desc);
}
