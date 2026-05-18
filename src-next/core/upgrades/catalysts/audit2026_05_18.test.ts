// 2026-05-18 audit additions — unit tests for Piggy Bank, Runaway,
// Double or Nothing, Resonance Cascade, Leveling. Each test feeds a
// minimal PipelineCtx through the catalyst's apply and asserts the
// chips/mult/state delta. No registry tear-down between tests —
// each catalyst's `apply` is fetched by id and called directly.

import { describe, it, expect } from 'vitest';
import './piggyBank';
import './runaway';
import './doubleOrNothing';
import './resonanceCascade';
import './leveling';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import { Phase } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function findCat(id: string, phase: Phase = Phase.UPGRADES) {
  const cat = getAll().find((u) => u.id === id && u.phase === phase);
  if (!cat) throw new Error(`catalyst ${id} not found at phase ${phase}`);
  return cat;
}

function makeCtx(overrides: {
  chips?: number;
  mult?: number;
  state?: Partial<GameState>;
  combo?: PipelineCtx['combo'];
  sim?: PipelineCtx['sim'];
  rngSeed?: number;
} = {}): PipelineCtx {
  const state = {
    ...overrides.state,
    run: {
      shards: 0,
      catalysts: [],
      catalystStacks: {},
      constellationId: 'lyra',
      ...overrides.state?.run,
    },
    round: { ...overrides.state?.round },
  } as unknown as GameState;
  return {
    state,
    chips: overrides.chips ?? 0,
    mult: overrides.mult ?? 1,
    total: 0,
    events: [],
    rng: mulberry32(overrides.rngSeed ?? 1),
    combo: overrides.combo,
    sim: overrides.sim,
  };
}

describe('piggy_bank — chip-to-shard skim', () => {
  it('banks 10% of chips into shards (capped at +5)', () => {
    // 100 chips × 10% = 10, but per-hand cap is 5 → +5 total.
    const ctx = makeCtx({ chips: 100, state: { run: { shards: 5 } as GameState['run'] } });
    const out = findCat('piggy_bank').apply(ctx);
    expect(out.state.run.shards).toBe(10); // 5 + min(5, floor(100*0.10)) = 10
  });

  it('skim below cap: 40 chips → +4 shards', () => {
    const ctx = makeCtx({ chips: 40, state: { run: { shards: 0 } as GameState['run'] } });
    const out = findCat('piggy_bank').apply(ctx);
    expect(out.state.run.shards).toBe(4);
  });

  it('caps at +5 shards per hand', () => {
    const ctx = makeCtx({ chips: 1000 });
    const out = findCat('piggy_bank').apply(ctx);
    expect(out.state.run.shards).toBe(5);
  });

  it('no-op at zero chips', () => {
    const ctx = makeCtx({ chips: 0 });
    const out = findCat('piggy_bank').apply(ctx);
    expect(out.state.run.shards).toBe(0);
  });

  it('floors fractional skim — 9 chips → 0 shards', () => {
    const ctx = makeCtx({ chips: 9 });
    const out = findCat('piggy_bank').apply(ctx);
    expect(out.state.run.shards).toBe(0);
  });

  it('does NOT modify chips or mult', () => {
    const ctx = makeCtx({ chips: 100, mult: 5 });
    const out = findCat('piggy_bank').apply(ctx);
    expect(out.chips).toBe(100);
    expect(out.mult).toBe(5);
  });
});

describe('runaway — +0.10× mult per stack', () => {
  it('no-op with zero stacks', () => {
    const ctx = makeCtx({ mult: 4 });
    expect(findCat('runaway').apply(ctx).mult).toBe(4);
  });

  it('+0.10× mult per stack (multiplicative)', () => {
    const ctx = makeCtx({
      mult: 10,
      state: { run: { catalystStacks: { runaway: 5 } } as unknown as GameState['run'] },
    });
    expect(findCat('runaway').apply(ctx).mult).toBeCloseTo(15); // 10 × 1.5
  });
});

describe('double_or_nothing — seeded 50/50 gamble', () => {
  it('multiplies by 2 on a winning roll', () => {
    // mulberry32(100).next() = 0.2044 — below the 0.5 threshold, so the
    // win arm fires.
    const ctx = makeCtx({ mult: 10, rngSeed: 100 });
    expect(findCat('double_or_nothing').apply(ctx).mult).toBeCloseTo(20);
  });

  it('halves mult on a losing roll', () => {
    // mulberry32(5).next() = 0.6898 — above 0.5, lose arm.
    const ctx = makeCtx({ mult: 10, rngSeed: 5 });
    expect(findCat('double_or_nothing').apply(ctx).mult).toBeCloseTo(5);
  });

  it('produces same result on replay (seed determinism)', () => {
    const a = findCat('double_or_nothing').apply(makeCtx({ mult: 8, rngSeed: 42 })).mult;
    const b = findCat('double_or_nothing').apply(makeCtx({ mult: 8, rngSeed: 42 })).mult;
    expect(a).toBe(b);
  });
});

describe('resonance_cascade — collision stack apply', () => {
  it('no-op with zero stacks', () => {
    const ctx = makeCtx({ mult: 4 });
    expect(findCat('resonance_cascade').apply(ctx).mult).toBe(4);
  });

  it('+0.05× per stack (additive)', () => {
    const ctx = makeCtx({
      mult: 10,
      state: { run: { catalystStacks: { resonance_cascade: 8 } } as unknown as GameState['run'] },
    });
    expect(findCat('resonance_cascade').apply(ctx).mult).toBeCloseTo(10 + 0.4); // 8 × 0.05 = 0.4
  });

  it('full-cap stacks deliver +1.0× mult', () => {
    const ctx = makeCtx({
      mult: 10,
      state: { run: { catalystStacks: { resonance_cascade: 20 } } as unknown as GameState['run'] },
    });
    expect(findCat('resonance_cascade').apply(ctx).mult).toBeCloseTo(11);
  });
});

describe('resonance_cascade__inc — collision counting', () => {
  it('increments catalystStacks on collision pairs', () => {
    const ctx = makeCtx({
      state: {
        run: { catalysts: ['resonance_cascade'], catalystStacks: {} } as unknown as GameState['run'],
      },
      sim: { collisionPairs: [[0, 1], [2, 3]] } as unknown as PipelineCtx['sim'],
    });
    const out = findCat('resonance_cascade__inc', Phase.ON_COLLISION).apply(ctx);
    expect(out.state.run.catalystStacks?.['resonance_cascade']).toBe(2);
  });

  it('dedupes unordered pairs from rapier re-fires', () => {
    const ctx = makeCtx({
      state: {
        run: { catalysts: ['resonance_cascade'], catalystStacks: {} } as unknown as GameState['run'],
      },
      sim: { collisionPairs: [[0, 1], [1, 0], [0, 1]] } as unknown as PipelineCtx['sim'],
    });
    const out = findCat('resonance_cascade__inc', Phase.ON_COLLISION).apply(ctx);
    expect(out.state.run.catalystStacks?.['resonance_cascade']).toBe(1);
  });

  it('caps stack increments at 20', () => {
    const ctx = makeCtx({
      state: {
        run: {
          catalysts: ['resonance_cascade'],
          catalystStacks: { resonance_cascade: 19 },
        } as unknown as GameState['run'],
      },
      sim: { collisionPairs: [[0, 1], [2, 3], [4, 5]] } as unknown as PipelineCtx['sim'],
    });
    const out = findCat('resonance_cascade__inc', Phase.ON_COLLISION).apply(ctx);
    expect(out.state.run.catalystStacks?.['resonance_cascade']).toBe(20);
  });

  it('no-op when catalyst not owned', () => {
    const ctx = makeCtx({
      state: { run: { catalysts: [], catalystStacks: {} } as unknown as GameState['run'] },
      sim: { collisionPairs: [[0, 1]] } as unknown as PipelineCtx['sim'],
    });
    const out = findCat('resonance_cascade__inc', Phase.ON_COLLISION).apply(ctx);
    expect(out.state.run.catalystStacks?.['resonance_cascade']).toBeUndefined();
  });
});

describe('leveling — Triumvirate combo tier promotion', () => {
  function levelCtx(comboId: string, comboTier: number, constellation = 'triumvirate'): PipelineCtx {
    return makeCtx({
      state: { run: { constellationId: constellation } as unknown as GameState['run'] },
      combo: { id: comboId, tier: comboTier, baseChips: 10, baseMult: 1, scoringFaces: [3, 3, 1] },
    });
  }

  it('promotes chance → one_pair', () => {
    const out = findCat('leveling').apply(levelCtx('chance', 0));
    expect(out.combo?.id).toBe('one_pair');
    expect(out.combo?.tier).toBe(1);
  });

  it('promotes one_pair → two_pair', () => {
    const out = findCat('leveling').apply(levelCtx('one_pair', 1));
    expect(out.combo?.id).toBe('two_pair');
    expect(out.combo?.tier).toBe(2);
  });

  it('promotes three_kind → sm_straight', () => {
    const out = findCat('leveling').apply(levelCtx('three_kind', 3));
    expect(out.combo?.id).toBe('sm_straight');
    expect(out.combo?.tier).toBe(4);
  });

  it('does not promote sm_straight (above gate)', () => {
    const out = findCat('leveling').apply(levelCtx('sm_straight', 4));
    expect(out.combo?.id).toBe('sm_straight');
  });

  it('no-op on non-Triumvirate constellation', () => {
    const out = findCat('leveling').apply(levelCtx('one_pair', 1, 'lyra'));
    expect(out.combo?.id).toBe('one_pair');
  });
});
