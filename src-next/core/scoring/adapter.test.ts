import { describe, it, expect } from 'vitest';
import { adaptScoringContext } from './adapter';

describe('adaptScoringContext', () => {
  it('converts pipeline ctx to SequenceInput with itemized mults', () => {
    const fakeCtx = {
      combo: { id: 'full_house', tier: 5 },
      chips: 50,
      mult: 4,
      chain: { mult: 2 },
      total: 400,
      state: { round: { dice: [{ face: 6 }, { face: 6 }, { face: 6 }, { face: 5 }, { face: 5 }] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.faces).toEqual([6, 6, 6, 5, 5]);
    expect(input.comboLabel).toBe('FULL_HOUSE');
    expect(input.comboBonus).toBe(50 - 28);     // chips minus face sum = combo bonus
    expect(input.mults).toEqual([
      { label: 'mult', value: 4 },
      { label: 'chain', value: 2 },
    ]);
    expect(input.finalTotal).toBe(400);
  });

  it('omits chain mult when value is 1 (no chain bonus)', () => {
    const fakeCtx = {
      combo: { id: 'one_pair', tier: 1 },
      chips: 12,
      mult: 1.5,
      chain: { mult: 1 },
      total: 18,
      state: { round: { dice: [{ face: 4 }, { face: 4 }, { face: 1 }, { face: 1 }, { face: 2 }] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.mults).toEqual([{ label: 'mult', value: 1.5 }]);
  });

  it('filters faces by scoringOrder (held-only)', () => {
    // Dice [3, 5, 1, 6, 2]. scoringOrder [0, 4] → held faces [3, 2].
    // chips = combo.chips + sumHeld = 0 + 5 = 5; combo bonus = chips - sumHeld = 0.
    const fakeCtx = {
      combo: { id: 'chance', tier: 0 },
      chips: 5,
      mult: 1,
      chain: { mult: 1 },
      total: 5,
      state: { round: { dice: [{ face: 3 }, { face: 5 }, { face: 1 }, { face: 6 }, { face: 2 }], scoringOrder: [0, 4] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.faces).toEqual([3, 2]);
    expect(input.comboBonus).toBe(0);
  });

  it('preserves scoringOrder ordering (drag-reorder respected)', () => {
    // Dice [1, 2, 3, 4, 5]. scoringOrder [4, 1, 0] → held faces in order [5, 2, 1].
    const fakeCtx = {
      combo: { id: 'chance', tier: 0 },
      chips: 8,
      mult: 1,
      chain: { mult: 1 },
      total: 8,
      state: { round: { dice: [{ face: 1 }, { face: 2 }, { face: 3 }, { face: 4 }, { face: 5 }], scoringOrder: [4, 1, 0] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.faces).toEqual([5, 2, 1]);
  });

  it('falls back to all dice when scoringOrder absent (back-compat)', () => {
    const fakeCtx = {
      combo: { id: 'chance', tier: 0 },
      chips: 15,
      mult: 1,
      chain: { mult: 1 },
      total: 15,
      state: { round: { dice: [{ face: 1 }, { face: 2 }, { face: 3 }, { face: 4 }, { face: 5 }] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.faces).toEqual([1, 2, 3, 4, 5]);
  });

  it('emits dieIndices parallel to faces in scoringOrder', () => {
    // Held dice 3 and 4 (last two), in that order.
    const fakeCtx = {
      combo: { id: 'chance', tier: 0 },
      chips: 8,
      mult: 1,
      chain: { mult: 1 },
      total: 8,
      state: { round: { dice: [{ face: 1 }, { face: 2 }, { face: 3 }, { face: 6 }, { face: 2 }], scoringOrder: [3, 4] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.faces).toEqual([6, 2]);
    expect(input.dieIndices).toEqual([3, 4]);
  });

  it('dieIndices reflect drag-mutated scoringOrder', () => {
    const fakeCtx = {
      combo: { id: 'chance', tier: 0 },
      chips: 8,
      mult: 1,
      chain: { mult: 1 },
      total: 8,
      state: { round: { dice: [{ face: 1 }, { face: 2 }, { face: 3 }, { face: 4 }, { face: 5 }], scoringOrder: [4, 1, 0] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.faces).toEqual([5, 2, 1]);
    expect(input.dieIndices).toEqual([4, 1, 0]);
  });

  it('dieIndices fall back to natural order when scoringOrder absent', () => {
    const fakeCtx = {
      combo: { id: 'chance', tier: 0 },
      chips: 15,
      mult: 1,
      chain: { mult: 1 },
      total: 15,
      state: { round: { dice: [{ face: 1 }, { face: 2 }, { face: 3 }, { face: 4 }, { face: 5 }] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.dieIndices).toEqual([0, 1, 2, 3, 4]);
  });
});
