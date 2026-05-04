import { describe, it, expect } from 'vitest';
import './quorum';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';

function makeCtx(comboId: string, lastComboId: string | null, comboStreak = 1, chips = 100, mult = 4): PipelineCtx {
  const state = {
    run: { lastComboId, comboStreak },
  } as unknown as GameState;
  return {
    state,
    chips,
    mult,
    total: 0,
    events: [],
    combo: { id: comboId, tier: 1, baseChips: 0, baseMult: 1, scoringFaces: [] },
    rng: () => 0,
  };
}

describe('quorum catalyst', () => {
  it('returns ctx unchanged when combo type differs from previous', () => {
    const def = getAll().find((u) => u.id === 'quorum')!;
    const next = def.apply(makeCtx('one_pair', 'two_pair', 1, 100, 4));
    expect(next.chips).toBe(100);
    expect(next.mult).toBe(4);
  });

  it('×1.5 chips when combo matches (2nd in a row)', () => {
    const def = getAll().find((u) => u.id === 'quorum')!;
    const next = def.apply(makeCtx('one_pair', 'one_pair', 1, 100, 4));
    expect(next.chips).toBe(150);
    expect(next.mult).toBe(4);
  });

  it('×1.5 chips AND ×1.5 mult on 3rd in a row', () => {
    const def = getAll().find((u) => u.id === 'quorum')!;
    const next = def.apply(makeCtx('full_house', 'full_house', 2, 100, 4));
    expect(next.chips).toBe(150);
    expect(next.mult).toBe(6);
  });

  it('returns ctx unchanged on first hand of run (no combo history)', () => {
    const def = getAll().find((u) => u.id === 'quorum')!;
    const next = def.apply(makeCtx('one_pair', null, 0, 100, 4));
    expect(next.chips).toBe(100);
  });
});
