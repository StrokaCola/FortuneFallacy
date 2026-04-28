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
});
