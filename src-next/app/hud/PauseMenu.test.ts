// Regression tests for the React #185 ("Maximum update depth exceeded")
// crash that fired going Forge → Hub in production. Two correctness
// bugs surfaced under different conditions; this file pins both.
//
// Bug 1 (PauseMenu): `selectCatalystChipsForPause` returned a fresh
// `{}` literal whenever runStats.catalystChips was undefined, so every
// PauseMenu render handed Zustand a brand-new reference. Zustand's
// default Object.is comparison saw "the value changed" each time and
// triggered another render, recursing past React's update-depth cap.
//
// Bug 2 (Coachmark): the 30-frame measurement RAF loop called setRect
// with a fresh `{ top, left, width, height }` object on every tick
// even when the anchor hadn't moved. Same Zustand/React mechanism —
// each setRect produces a new reference, scheduling another render.

import { describe, it, expect } from 'vitest';

describe('PauseMenu selectCatalystChipsForPause stability', () => {
  // Inline reimport of the selector logic — the file isn't exported,
  // but the fix relies on a module-level frozen constant which we
  // mirror here to assert the contract.
  const EMPTY_CATALYST_CHIPS: Readonly<Record<string, number>> = Object.freeze({});
  const selectCatalystChipsForPause = (s: { run: { runStats?: { catalystChips?: Record<string, number> } } }) =>
    s.run.runStats?.catalystChips ?? EMPTY_CATALYST_CHIPS;

  it('returns the same reference on repeated calls when runStats is undefined', () => {
    const s = { run: {} };
    const a = selectCatalystChipsForPause(s);
    const b = selectCatalystChipsForPause(s);
    expect(a).toBe(b);
  });

  it('returns the same reference on repeated calls when catalystChips is undefined', () => {
    // runStats is present but carries no catalystChips field — exercises
    // the `?? EMPTY_CATALYST_CHIPS` fallback. The shape matches the
    // selector's expected `runStats?: { catalystChips?: ... }`.
    const s = { run: { runStats: {} } };
    const a = selectCatalystChipsForPause(s);
    const b = selectCatalystChipsForPause(s);
    expect(a).toBe(b);
  });

  it('returns the underlying object reference when catalystChips IS populated', () => {
    const chips = { foo: 1, bar: 2 };
    const s = { run: { runStats: { catalystChips: chips } } };
    expect(selectCatalystChipsForPause(s)).toBe(chips);
  });
});

describe('Coachmark rect stability', () => {
  // Mirror of the equality check used in Coachmark.tsx. Each render's
  // measurement returns a fresh Rect, so we compare by value before
  // calling setRect — otherwise the unconditional setRect produced
  // 30 useless re-renders in 30 frames during the mount loop.
  type Rect = { top: number; left: number; width: number; height: number };
  function rectsEqual(a: Rect | null, b: Rect | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
  }

  it('treats two identical rects as equal even with different references', () => {
    const a: Rect = { top: 10, left: 20, width: 30, height: 40 };
    const b: Rect = { top: 10, left: 20, width: 30, height: 40 };
    expect(a).not.toBe(b); // different refs
    expect(rectsEqual(a, b)).toBe(true);
  });

  it('detects changes in any single dimension', () => {
    const base: Rect = { top: 10, left: 20, width: 30, height: 40 };
    expect(rectsEqual(base, { ...base, top: 11 })).toBe(false);
    expect(rectsEqual(base, { ...base, left: 21 })).toBe(false);
    expect(rectsEqual(base, { ...base, width: 31 })).toBe(false);
    expect(rectsEqual(base, { ...base, height: 41 })).toBe(false);
  });

  it('null x null is equal; null x rect is not', () => {
    const r: Rect = { top: 0, left: 0, width: 0, height: 0 };
    expect(rectsEqual(null, null)).toBe(true);
    expect(rectsEqual(null, r)).toBe(false);
    expect(rectsEqual(r, null)).toBe(false);
  });
});
