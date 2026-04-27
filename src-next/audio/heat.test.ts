import { describe, it, expect } from 'vitest';
import { smoothstep, selectTension, type TensionInputs } from './heat';
import { selectTensionFromState } from '../state/selectors';

describe('smoothstep', () => {
  it('returns 0 below edge0', () => {
    expect(smoothstep(0, 0.5, 1)).toBe(0);
  });
  it('returns 1 above edge1', () => {
    expect(smoothstep(2, 0.5, 1)).toBe(1);
  });
  it('is monotonic in the interior', () => {
    const a = smoothstep(0.6, 0.5, 1);
    const b = smoothstep(0.8, 0.5, 1);
    expect(b).toBeGreaterThan(a);
  });
});

describe('selectTension', () => {
  const base: TensionInputs = { score: 0, target: 1000, handsLeft: 4, handsTotal: 4, scoring: false };

  it('returns 0 when score === target (cleared)', () => {
    expect(selectTension({ ...base, score: 1000 })).toBe(0);
  });

  it('returns near 1 when far behind on last hand', () => {
    expect(selectTension({ ...base, score: 100, handsLeft: 1 })).toBeGreaterThan(0.85);
  });

  it('is monotonic non-increasing as score rises (with same handsLeft)', () => {
    const t1 = selectTension({ ...base, score: 200, handsLeft: 2 });
    const t2 = selectTension({ ...base, score: 800, handsLeft: 2 });
    expect(t2).toBeLessThanOrEqual(t1);
  });

  it('rises as handsLeft drops at fixed score gap', () => {
    const t4 = selectTension({ ...base, score: 500, handsLeft: 4 });
    const t1 = selectTension({ ...base, score: 500, handsLeft: 1 });
    expect(t1).toBeGreaterThan(t4);
  });

  it('returns 1.0 while scoring is true regardless of inputs', () => {
    expect(selectTension({ ...base, score: 1000, scoring: true })).toBe(1);
  });

  it('returns 0 with non-positive target', () => {
    expect(selectTension({ ...base, target: 0 })).toBe(0);
  });

  it('clamps to 1 when score is negative (Soft Bust state)', () => {
    expect(selectTension({ ...base, score: -100 })).toBe(1);
  });
});

describe('selectTensionFromState', () => {
  it('reads round.score / round.target / round.handsLeft / handsMax / scoring', () => {
    const state = {
      round: { score: 500, target: 1000, handsLeft: 2, handsMax: 4, scoring: false },
    } as unknown as Parameters<typeof selectTensionFromState>[0];
    const t = selectTensionFromState(state);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
  });
  it('returns 1 if state.round.scoring is true', () => {
    const state = {
      round: { score: 1000, target: 1000, handsLeft: 4, handsMax: 4, scoring: true },
    } as unknown as Parameters<typeof selectTensionFromState>[0];
    expect(selectTensionFromState(state)).toBe(1);
  });
});
