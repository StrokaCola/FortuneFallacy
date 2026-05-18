import { describe, it, expect } from 'vitest';
import './tempo';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(streak: number, mult = 4): PipelineCtx {
  const state = { run: { tempoStreak: streak } } as unknown as GameState;
  return { state, chips: 0, mult, total: 0, events: [], rng: mulberry32(0) };
}

describe('tempo catalyst', () => {
  it('returns ctx unchanged when streak = 0', () => {
    const def = getAll().find((u) => u.id === 'tempo')!;
    expect(def.apply(makeCtx(0, 4)).mult).toBe(4);
  });

  it('×1.4 mult at streak 1 (the 2nd ascending hand)', () => {
    const def = getAll().find((u) => u.id === 'tempo')!;
    // 2026-05-18 balance audit: 0.4 per streak (was 0.5)
    expect(def.apply(makeCtx(1, 5)).mult).toBeCloseTo(5 * 1.4);
  });

  it('×3.4 mult at streak 6 (just under cap)', () => {
    const def = getAll().find((u) => u.id === 'tempo')!;
    expect(def.apply(makeCtx(6, 5)).mult).toBeCloseTo(5 * 3.4);
  });

  it('caps at ×3.5 (post-audit cap)', () => {
    const def = getAll().find((u) => u.id === 'tempo')!;
    // 1 + 0.4 * streak crosses 3.5 at streak = 6.25
    expect(def.apply(makeCtx(7, 4)).mult).toBeCloseTo(14); // 4 * 3.5
    expect(def.apply(makeCtx(20, 4)).mult).toBeCloseTo(14);
  });
});
