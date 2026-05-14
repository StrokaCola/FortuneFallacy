import { describe, it, expect } from 'vitest';
import { reduce, initialState } from './reducer';
import { QUEUE_LIMITS } from './types';
import type { ToastDescriptor } from './types';

const noopRender = () => null;

function makeToast(opts: Partial<ToastDescriptor> & { id: string }): ToastDescriptor {
  return {
    id: opts.id,
    key: opts.key,
    priority: opts.priority ?? 'normal',
    durationMs: opts.durationMs ?? 1000,
    data: opts.data ?? {},
    render: opts.render ?? noopRender,
    merge: opts.merge,
  };
}

describe('toast queue reducer', () => {
  describe('PUSH', () => {
    it('appends a single push to pending', () => {
      const s = reduce(initialState, { type: 'PUSH', descriptor: makeToast({ id: 'a' }), now: 0 });
      expect(s.pending).toHaveLength(1);
      expect(s.visible).toHaveLength(0);
    });

    it('sorts pending by priority on push', () => {
      let s = initialState;
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'a', priority: 'normal' }), now: 0 });
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'b', priority: 'critical' }), now: 0 });
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'c', priority: 'high' }), now: 0 });
      expect(s.pending.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    });

    it('preserves FIFO within same priority', () => {
      let s = initialState;
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'a', priority: 'normal' }), now: 0 });
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'b', priority: 'normal' }), now: 0 });
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'c', priority: 'normal' }), now: 0 });
      expect(s.pending.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    });

    it('merges into a pending descriptor with the same key', () => {
      const merge = (a: { amt: number }, b: { amt: number }) => ({ amt: a.amt + b.amt });
      let s = initialState;
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'a', key: 'shards', data: { amt: 5 }, merge: merge as ToastDescriptor['merge'] }), now: 0 });
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'b', key: 'shards', data: { amt: 3 }, merge: merge as ToastDescriptor['merge'] }), now: 0 });
      expect(s.pending).toHaveLength(1);
      expect((s.pending[0]!.data as { amt: number }).amt).toBe(8);
    });

    it('merges into a visible descriptor with the same key, resetting its visible clock', () => {
      const merge = (a: { amt: number }, b: { amt: number }) => ({ amt: a.amt + b.amt });
      let s = initialState;
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'a', key: 'shards', data: { amt: 5 }, merge: merge as ToastDescriptor['merge'] }), now: 0 });
      s = reduce(s, { type: 'TICK', now: 100 });
      expect(s.visible).toHaveLength(1);
      const firstShown = s.visible[0]!.shownAt;
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'b', key: 'shards', data: { amt: 3 }, merge: merge as ToastDescriptor['merge'] }), now: 800 });
      expect(s.visible).toHaveLength(1);
      expect((s.visible[0]!.data as { amt: number }).amt).toBe(8);
      expect(s.visible[0]!.shownAt).toBeGreaterThan(firstShown);
    });

    it('replaces in place when same-key has no merge function', () => {
      let s = initialState;
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'a', key: 'k', data: { v: 1 } }), now: 0 });
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'b', key: 'k', data: { v: 2 } }), now: 0 });
      expect(s.pending).toHaveLength(1);
      expect(s.pending[0]!.id).toBe('b');
      expect((s.pending[0]!.data as { v: number }).v).toBe(2);
    });
  });

  describe('TICK', () => {
    it('promotes pending → visible respecting MAX_VISIBLE', () => {
      let s = initialState;
      // Long durationMs (10s) so nothing expires inside the test window.
      // We only want to observe the cap behaviour here; expiry semantics
      // are exercised by the separate "expires" test.
      for (let i = 0; i < 4; i++) {
        s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: `t${i}`, durationMs: 10_000 }), now: 0 });
      }
      // Each TICK promotes at most one. After 2 ticks at sufficient
      // intervals we should see MAX_VISIBLE visible toasts.
      s = reduce(s, { type: 'TICK', now: 0 });
      expect(s.visible.map((v) => v.id)).toEqual(['t0']);
      s = reduce(s, { type: 'TICK', now: QUEUE_LIMITS.MIN_PROMOTION_INTERVAL_MS + 1 });
      expect(s.visible.map((v) => v.id)).toEqual(['t0', 't1']);
      // A third tick can't promote — already at cap. visible stays
      // [t0, t1]; pending stays [t2, t3].
      s = reduce(s, { type: 'TICK', now: 1_500 });
      expect(s.visible.map((v) => v.id)).toEqual(['t0', 't1']);
      expect(s.pending.map((p) => p.id)).toEqual(['t2', 't3']);
    });

    it('throttles back-to-back promotions to MIN_PROMOTION_INTERVAL_MS', () => {
      let s = initialState;
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'a' }), now: 0 });
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'b' }), now: 0 });
      s = reduce(s, { type: 'TICK', now: 0 });
      expect(s.visible.map((v) => v.id)).toEqual(['a']);
      // Too soon to promote `b`.
      s = reduce(s, { type: 'TICK', now: 50 });
      expect(s.visible.map((v) => v.id)).toEqual(['a']);
      // Past the throttle window.
      s = reduce(s, { type: 'TICK', now: QUEUE_LIMITS.MIN_PROMOTION_INTERVAL_MS + 10 });
      expect(s.visible.map((v) => v.id)).toEqual(['a', 'b']);
    });

    it('bypasses the throttle when a slot just became free via expiry', () => {
      // Two-toast minimum that demonstrates the bypass: push a + b
      // both with a short duration, promote a, then immediately after
      // a expires (well before the regular throttle window would have
      // elapsed) verify that b gets to promote.
      let s = initialState;
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'a', durationMs: 300 }), now: 0 });
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'b', durationMs: 300 }), now: 0 });
      s = reduce(s, { type: 'TICK', now: 0 });
      expect(s.visible.map((v) => v.id)).toEqual(['a']);
      // 400ms later: a has expired (durationMs=300). The regular
      // throttle would block (400ms < 600ms since a's promotion at 0).
      // The expiry-frees-a-slot bypass should still let b promote.
      s = reduce(s, { type: 'TICK', now: 400 });
      expect(s.visible.map((v) => v.id)).toEqual(['b']);
    });

    it('expires visible toasts after their durationMs', () => {
      let s = initialState;
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'a', durationMs: 1000 }), now: 0 });
      s = reduce(s, { type: 'TICK', now: 0 });
      expect(s.visible).toHaveLength(1);
      s = reduce(s, { type: 'TICK', now: 500 });
      expect(s.visible).toHaveLength(1);
      s = reduce(s, { type: 'TICK', now: 1_001 });
      expect(s.visible).toHaveLength(0);
    });
  });

  describe('DISMISS', () => {
    it('removes a visible toast by id', () => {
      let s = initialState;
      s = reduce(s, { type: 'PUSH', descriptor: makeToast({ id: 'a' }), now: 0 });
      s = reduce(s, { type: 'TICK', now: 0 });
      expect(s.visible).toHaveLength(1);
      s = reduce(s, { type: 'DISMISS', id: 'a' });
      expect(s.visible).toHaveLength(0);
    });

    it('no-ops when id is not visible', () => {
      const s = reduce(initialState, { type: 'DISMISS', id: 'ghost' });
      expect(s).toBe(initialState);
    });
  });
});
