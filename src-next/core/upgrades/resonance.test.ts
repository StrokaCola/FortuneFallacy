import { describe, it, expect } from 'vitest';
import { applyResonances } from './resonance';
import { activeResonances, pairsCompletedBy, RESONANCES } from '../../data/resonances';
import { Phase, type PipelineCtx } from '../pipeline/types';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';
import { initialMetaSlice } from '../../state/slices/meta';
import { initialUiSlice } from '../../state/slices/ui';
import { initialShopSlice } from '../../state/slices/shop';
import type { GameState } from '../../state/store';
import { mulberry32 } from '../rng';

function ctxWithCatalysts(catalysts: string[]): PipelineCtx {
  const state = {
    run: { ...initialRunSlice(), catalysts },
    round: initialRoundSlice(),
    shop: initialShopSlice(),
    meta: initialMetaSlice(),
    ui: initialUiSlice(),
    pingCount: 0,
  } as unknown as GameState;
  return {
    state,
    chips: 100,
    mult: 5,
    total: 0,
    events: [],
    rng: mulberry32(1),
  };
}

describe('applyResonances', () => {
  it('is a no-op when no pairs are owned', () => {
    const ctx = ctxWithCatalysts([]);
    const result = applyResonances(ctx);
    expect(result.chips).toBe(100);
    expect(result.mult).toBe(5);
    expect(result.events).toHaveLength(0);
  });

  it('is a no-op when only one half of a pair is owned', () => {
    const ctx = ctxWithCatalysts(['conductor']); // missing encore
    const result = applyResonances(ctx);
    expect(result.chips).toBe(100);
    expect(result.mult).toBe(5);
    expect(result.events).toHaveLength(0);
  });

  it('fires Symphony (Conductor + Encore) → +5 mult', () => {
    const ctx = ctxWithCatalysts(['conductor', 'encore']);
    const result = applyResonances(ctx);
    expect(result.mult).toBe(5 + 5); // baseline 5 + symphony 5
    expect(result.chips).toBe(100); // mult-only effect
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.payload).toMatchObject({
      id: 'resonance:symphony',
      phase: Phase.UPGRADES,
      deltaChips: 0,
      deltaMult: 5,
    });
  });

  it('fires Loaded Die (Six Bias + Iron Six) with both chips and mult', () => {
    const ctx = ctxWithCatalysts(['six_bias', 'iron_six']);
    const result = applyResonances(ctx);
    // Loaded Die: { both: chips 20, mult 2 }
    expect(result.chips).toBe(120);
    expect(result.mult).toBe(7);
    expect(result.events[0]?.payload).toMatchObject({
      id: 'resonance:loaded_die',
      deltaChips: 20,
      deltaMult: 2,
    });
  });

  it('fires multiple resonances when several pairs are simultaneously owned', () => {
    // Conductor+Encore=Symphony AND Six Bias+Iron Six=Loaded Die
    const ctx = ctxWithCatalysts(['conductor', 'encore', 'six_bias', 'iron_six']);
    const result = applyResonances(ctx);
    expect(result.events.length).toBe(2);
    const ids = new Set(result.events.map((e) => (e.payload as { id: string }).id));
    expect(ids.has('resonance:symphony')).toBe(true);
    expect(ids.has('resonance:loaded_die')).toBe(true);
  });

  it('does not double-fire when ctx.events already contains other upgrades', () => {
    const ctx = ctxWithCatalysts(['conductor', 'encore']);
    ctx.events.push({
      type: 'onUpgradeTriggered',
      payload: { id: 'stratifier', phase: Phase.UPGRADES, deltaChips: 10, deltaMult: 0 },
    });
    const result = applyResonances(ctx);
    expect(result.events.length).toBe(2); // 1 pre-existing + 1 resonance
    expect((result.events[0]?.payload as { id: string }).id).toBe('stratifier');
    expect((result.events[1]?.payload as { id: string }).id).toBe('resonance:symphony');
  });
});

describe('activeResonances', () => {
  it('returns empty when nothing matches', () => {
    expect(activeResonances([])).toEqual([]);
    expect(activeResonances(['stratifier'])).toEqual([]);
  });

  it('order-independent', () => {
    const a = activeResonances(['conductor', 'encore']);
    const b = activeResonances(['encore', 'conductor']);
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
  });
});

describe('pairsCompletedBy', () => {
  it('returns the pairs an offered catalyst would complete', () => {
    const pairs = pairsCompletedBy('encore', ['conductor']);
    expect(pairs.map((p) => p.id)).toContain('symphony');
  });

  it('returns empty when offering a catalyst already owned', () => {
    expect(pairsCompletedBy('encore', ['encore', 'conductor'])).toEqual([]);
  });

  it('returns empty when no partners are owned', () => {
    expect(pairsCompletedBy('encore', ['stratifier', 'six_bias'])).toEqual([]);
  });
});

describe('RESONANCES table', () => {
  it('all pair ids are unique', () => {
    const ids = new Set(RESONANCES.map((r) => r.id));
    expect(ids.size).toBe(RESONANCES.length);
  });

  it('each pair references distinct catalyst ids', () => {
    for (const r of RESONANCES) {
      expect(r.a).not.toBe(r.b);
    }
  });
});
