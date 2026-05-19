import { describe, it, expect } from 'vitest';
import { adaptScoringContext } from './adapter';

describe('adaptScoringContext', () => {
  it('converts pipeline ctx to SequenceInput with baseMult and no ctx.mult in mults', () => {
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
    // comboBonus = ctx.chips - faceSum - modChipsTotal (no events, modChipsTotal=0)
    expect(input.comboBonus).toBe(50 - 28);
    // baseMult from combo definition (full_house mult = 8)
    expect(input.baseMult).toBe(8);
    // upgrades empty — no events
    expect(input.upgrades).toEqual([]);
    // mults: only chain (ctx.mult moved to upgrade-beat path)
    expect(input.mults).toEqual([{ label: 'chain', value: 2 }]);
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
    // no chain, no ctx.mult in mults → empty
    expect(input.mults).toEqual([]);
    // baseMult from one_pair definition (mult = 2)
    expect(input.baseMult).toBe(2);
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

  it('extracts upgrade events into upgrades array and adjusts comboBonus', () => {
    // Die mod adds +10 chips, +3 mult. Catalyst adds 0 chips, +5 mult.
    const fakeCtx = {
      combo: { id: 'three_kind', tier: 3 },
      chips: 55,   // faceSum=9 + combo.chips=30 + mod chips=10 + chance=6 => but simpler:
      mult: 10,
      chain: { mult: 1 },
      total: 550,
      events: [
        { type: 'onUpgradeTriggered', payload: { id: 'mod:scoreBonus@0', phase: 5, deltaChips: 10, deltaMult: 0 } },
        { type: 'onUpgradeTriggered', payload: { id: 'mod:multBonus@1', phase: 5, deltaChips: 0, deltaMult: 3 } },
        { type: 'onUpgradeTriggered', payload: { id: 'solar_flare', phase: 5, deltaChips: 0, deltaMult: 5 } },
        { type: 'onModFired', payload: { dieIdx: 0, modId: 'scoreBonus', faceValue: 3 } },
      ],
      state: { round: { dice: [{ face: 3 }, { face: 3 }, { face: 3 }, { face: 2 }, { face: 1 }], scoringOrder: [0, 1, 2] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    // faceSum = 3+3+3 = 9. modChipsTotal = 10. comboBonus = 55 - 9 - 10 = 36 (= combo.chips=30 + combo float)
    expect(input.comboBonus).toBe(55 - 9 - 10);
    // upgrades: only the onUpgradeTriggered events with non-zero deltas.
    // Wave T Theater (Batch G) — entries also carry sourceType/sourceId
    // (+ optional dieIdx) so the theater layer can attribute floaters.
    expect(input.upgrades).toEqual([
      { label: 'mod:scoreBonus@0', chipDelta: 10, multDelta: 0, tint: undefined, sourceType: 'mod', sourceId: 'scoreBonus', dieIdx: 0 },
      { label: 'mod:multBonus@1', chipDelta: 0, multDelta: 3, tint: undefined, sourceType: 'mod', sourceId: 'multBonus', dieIdx: 1 },
      { label: 'solar_flare', chipDelta: 0, multDelta: 5, tint: undefined, sourceType: 'catalyst', sourceId: 'solar_flare', dieIdx: undefined },
    ]);
    // mults: chain=1 omitted → empty
    expect(input.mults).toEqual([]);
    // baseMult from three_kind definition (mult = 5)
    expect(input.baseMult).toBe(5);
  });

  it('classifies upgrade event ids into theater attribution metadata', () => {
    // Wave T Theater (Batch G) — verifies the full id-form taxonomy
    // documented in core/upgrades/eventId.ts:
    //   plain catalyst       → catalyst, sourceId
    //   catalyst@N           → catalyst, sourceId, dieIdx=N
    //   edition:foil@catalyst → catalyst, sourceId
    //   mod:loaded@N         → mod, sourceId, dieIdx=N
    //   resonance:pairId     → resonance, sourceId
    const fakeCtx = {
      combo: { id: 'chance', tier: 0 },
      chips: 100,
      mult: 1,
      chain: { mult: 1 },
      total: 100,
      events: [
        { type: 'onUpgradeTriggered', payload: { id: 'lodestone', phase: 5, deltaChips: 8, deltaMult: 0 } },
        { type: 'onUpgradeTriggered', payload: { id: 'gilding_press@2', phase: 5, deltaChips: 5, deltaMult: 0 } },
        { type: 'onUpgradeTriggered', payload: { id: 'edition:foil@stratifier', phase: 5, deltaChips: 4, deltaMult: 0 } },
        { type: 'onUpgradeTriggered', payload: { id: 'mod:loaded@3', phase: 5, deltaChips: 6, deltaMult: 0 } },
        { type: 'onUpgradeTriggered', payload: { id: 'resonance:symphony', phase: 5, deltaChips: 0, deltaMult: 2 } },
      ],
      state: { round: { dice: [{ face: 1 }], scoringOrder: [0] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.upgrades?.[0]).toMatchObject({ sourceType: 'catalyst', sourceId: 'lodestone' });
    expect(input.upgrades?.[1]).toMatchObject({ sourceType: 'catalyst', sourceId: 'gilding_press', dieIdx: 2 });
    expect(input.upgrades?.[2]).toMatchObject({ sourceType: 'catalyst', sourceId: 'stratifier' });
    expect(input.upgrades?.[3]).toMatchObject({ sourceType: 'mod', sourceId: 'loaded', dieIdx: 3 });
    expect(input.upgrades?.[4]).toMatchObject({ sourceType: 'resonance', sourceId: 'symphony' });
  });

  it('marks patience_counter events with magenta tint', () => {
    const fakeCtx = {
      combo: { id: 'chance', tier: 0 },
      chips: 10,
      mult: 4,
      chain: { mult: 1 },
      total: 40,
      events: [
        { type: 'onUpgradeTriggered', payload: { id: 'patience_counter', phase: 5, deltaChips: 0, deltaMult: 3 } },
      ],
      state: { round: { dice: [{ face: 5 }, { face: 5 }], scoringOrder: [0, 1] } },
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.upgrades?.[0]?.tint).toBe('magenta');
  });
});
