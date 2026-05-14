// Toast queue types — the shape of a single notification request and
// the queue state. Kept in their own file so the pure reducer + the
// React layer can share them without circular imports.
//
// Design:
// - `id` is a unique per-push identifier; the host uses it as the
//   React key so animations restart when a slot rebinds to a new
//   toast.
// - `key` is an OPTIONAL grouping key. When a new push arrives with
//   a key that already exists in the queue (visible or pending), the
//   `merge` reducer is invoked to fold the two descriptors into one.
//   Without `key`, each push is its own toast.
// - `priority` orders pending pops. Same priority → FIFO.
// - `data` is the descriptor's structured payload, typed by `TData`.
//   The `render` function reads from it; the `merge` function returns
//   a new `TData`.
//
// Why split data from render: the reducer is pure and easy to test if
// it never touches React, and merges that produce new descriptors
// don't need to rebuild render functions on every fold.

import type { ReactNode } from 'react';

export type ToastPriority = 'critical' | 'high' | 'normal' | 'low';

export const PRIORITY_RANK: Record<ToastPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export type ToastDescriptor<TData = unknown> = {
  id: string;
  key?: string;
  priority: ToastPriority;
  durationMs: number;
  data: TData;
  render: (data: TData) => ReactNode;
  // Called when a new push with the same `key` arrives while another
  // descriptor is still pending or visible. Returns the merged `data`;
  // the host keeps the original descriptor's id, render, and priority.
  merge?: (incoming: TData, current: TData) => TData;
};

// Visible toasts carry a `shownAt` timestamp (ms since epoch) so the
// reducer can decide when to expire them.
export type VisibleToast = ToastDescriptor & { shownAt: number };

export type QueueState = {
  visible: VisibleToast[];
  pending: ToastDescriptor[];
  // Timestamp of the last promotion from pending → visible. Drives
  // the inter-toast throttle so rapid bursts read sequentially.
  // Initialized to -Infinity so the very first promotion bypasses the
  // throttle without a special-case branch in the reducer.
  lastPromotionAt: number;
};

export const EMPTY_STATE: QueueState = Object.freeze({
  visible: [],
  pending: [],
  lastPromotionAt: Number.NEGATIVE_INFINITY,
});

// Tunables — chosen to match the studio review's recommendation
// ("max 2 visible at once, throttle to 1 per ~600ms, priority field,
// group same-type"). Exported so tests and host can read the same
// values.
export const QUEUE_LIMITS = {
  MAX_VISIBLE: 2,
  MIN_PROMOTION_INTERVAL_MS: 600,
} as const;
