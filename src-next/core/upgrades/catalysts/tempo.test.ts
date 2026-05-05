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

  it('×1.5 mult at streak 1 (the 2nd ascending hand)', () => {
    const def = getAll().find((u) => u.id === 'tempo')!;
    expect(def.apply(makeCtx(1, 4)).mult).toBe(6);
  });

  it('×3.0 mult at streak 4 (caps)', () => {
    const def = getAll().find((u) => u.id === 'tempo')!;
    expect(def.apply(makeCtx(4, 4)).mult).toBe(12);
  });

  it('caps at ×3.0 even past streak 4', () => {
    const def = getAll().find((u) => u.id === 'tempo')!;
    expect(def.apply(makeCtx(10, 4)).mult).toBe(12);
  });
});
