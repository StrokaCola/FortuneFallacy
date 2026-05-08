import { describe, it, expect, beforeAll } from 'vitest';
import { upgrades } from './upgrades';
import '../upgrades/catalysts/compoundingBias';
import { initialRoundSlice } from '../../state/slices/round';
import type { PipelineCtx } from '../pipeline/types';
import type { GameState } from '../../state/store';
import { mulberry32 } from '../rng';

function makeCtx(overrides: {
  blindId?: string;
  isBoss?: boolean;
  firstHandPlayed?: boolean;
  handsLeft?: number;
  handsMax?: number;
  catalysts?: string[];
  compoundingStacks?: number;
}): PipelineCtx {
  const state = {
    run: {
      catalysts: overrides.catalysts ?? [],
      compoundingStacks: overrides.compoundingStacks ?? 0,
      diceMods: [],
    },
    round: {
      isBoss: overrides.isBoss ?? false,
      blindId: overrides.blindId ?? null,
      handsLeft: overrides.handsLeft ?? 3,
      handsMax: overrides.handsMax ?? 3,
      firstHandPlayed: overrides.firstHandPlayed ?? false,
    },
  } as unknown as GameState;
  return {
    state,
    chips: 50,
    mult: 4,
    total: 0,
    events: [],
    rng: mulberry32(0),
    sim: {
      finalFaces: [],
      restPositions: [],
      settleMs: [],
      peakVelocity: 0,
      collisionCount: 0,
      bounceHeights: [],
    } as unknown as PipelineCtx['sim'],
  };
}

describe('upgrades phase — Eris first-hand gate (firstHandPlayed)', () => {
  beforeAll(() => {
    // catalysts auto-register on import
  });

  it('blocks catalysts on first hand when Eris active and firstHandPlayed=false', () => {
    const ctx = makeCtx({
      isBoss: true,
      blindId: 'eris',
      firstHandPlayed: false,
      catalysts: ['compounding_bias'],
      compoundingStacks: 2,
    });
    const out = upgrades(ctx);
    // compounding_bias would multiply mult by 1.10; blocked → mult unchanged
    expect(out.mult).toBe(4);
  });

  it('allows catalysts after first hand played when Eris active', () => {
    const ctx = makeCtx({
      isBoss: true,
      blindId: 'eris',
      firstHandPlayed: true,
      catalysts: ['compounding_bias'],
      compoundingStacks: 2,
    });
    const out = upgrades(ctx);
    // compounding_bias bonus = 4 * (1 + 2*0.10) = 4.8
    expect(out.mult).toBeCloseTo(4.8, 5);
  });

  it('roll_token-safe: handsLeft === handsMax does not retrigger Eris block once firstHandPlayed=true', () => {
    // Scenario: player on hand 2, plays roll_token consumable, handsLeft bumps to 3 == handsMax.
    // Old check (handsLeft === handsMax) would falsely re-block. New flag must not.
    const ctx = makeCtx({
      isBoss: true,
      blindId: 'eris',
      firstHandPlayed: true,
      handsLeft: 3,
      handsMax: 3,
      catalysts: ['compounding_bias'],
      compoundingStacks: 1,
    });
    const out = upgrades(ctx);
    // 4 * (1 + 0.10) = 4.4; if blocked would stay 4
    expect(out.mult).toBeCloseTo(4.4, 5);
  });

  it('non-Eris boss with firstHandPlayed=false does not block catalysts', () => {
    const ctx = makeCtx({
      isBoss: false,
      blindId: null as unknown as string,
      firstHandPlayed: false,
      catalysts: ['compounding_bias'],
      compoundingStacks: 2,
    });
    const out = upgrades(ctx);
    expect(out.mult).toBeCloseTo(4.8, 5);
  });
});

function makeModCtx(faces: number[], diceMods: string[][], scoringOrder: number[]): PipelineCtx {
  const state = {
    run: { seed: 1, shards: 0, ante: 1, goalIdx: 0, catalysts: [], vouchers: [], consumables: [], ownedMods: [], diceMods, handsPlayed: 0, compoundingStacks: 0 },
    round: {
      ...initialRoundSlice(),
      scoringOrder,
    },
    shop: { open: false, offers: [], rerollCost: 5 },
    meta: { playerName: '', unlocks: [], highScores: [] },
    ui: { screen: 'round' as const, paused: false },
  } as unknown as GameState;
  return {
    state,
    chips: 0,
    mult: 1,
    total: 0,
    events: [],
    rng: mulberry32(0),
    sim: {
      finalFaces: faces,
      restPositions: [],
      settleMs: [],
      peakVelocity: 0,
      collisionCount: 0,
      bounceHeights: [],
    } as unknown as PipelineCtx['sim'],
  };
}

describe('applyModScoring with scoringOrder', () => {
  it('iterates dice in scoringOrder', () => {
    // 5 dice. Only die 0 has Amplify (+2 chips). scoringOrder [2,0,1,3,4].
    const ctx = makeModCtx([4, 5, 6, 1, 1], [['amplify'], [], [], [], []], [2, 0, 1, 3, 4]);
    const out = upgrades(ctx);
    // Amplify fires exactly once (only die 0 has it). chips = 0 + 2 = 2.
    expect(out.chips).toBe(2);
  });

  it('does not iterate dice not in scoringOrder', () => {
    // Dice 0,1,2 all have Amplify but scoringOrder is [0] — only die 0 fires.
    const ctx = makeModCtx([4, 5, 6, 1, 1], [['amplify'], ['amplify'], ['amplify'], [], []], [0]);
    const out = upgrades(ctx);
    // Only die 0's Amplify fires: chips = 0 + 2 = 2.
    expect(out.chips).toBe(2);
  });

  it('fires all mods when scoringOrder is full natural order', () => {
    // All 5 dice have Amplify; scoringOrder is natural [0,1,2,3,4].
    const ctx = makeModCtx([1, 2, 3, 4, 5], [['amplify'], ['amplify'], ['amplify'], ['amplify'], ['amplify']], [0, 1, 2, 3, 4]);
    const out = upgrades(ctx);
    // 5 × +2 chips = 10.
    expect(out.chips).toBe(10);
  });

  it('filters out-of-range indices in scoringOrder defensively', () => {
    // scoringOrder contains index 99 which does not exist; only index 0 is valid.
    const ctx = makeModCtx([3], [['amplify']], [0, 99]);
    const out = upgrades(ctx);
    expect(out.chips).toBe(2);
  });

  it('vanguard fires +5 chips only when its die is at position 0', () => {
    // Die 0 has Vanguard. scoringOrder [0,1,2,3,4] → die 0 is first → fires.
    const first = makeModCtx([3, 3, 3, 3, 3], [['vanguard'], [], [], [], []], [0, 1, 2, 3, 4]);
    expect(upgrades(first).chips).toBe(5);
    // scoringOrder [4,1,2,3,0] → die 0 is last → does NOT fire.
    const last = makeModCtx([3, 3, 3, 3, 3], [['vanguard'], [], [], [], []], [4, 1, 2, 3, 0]);
    expect(upgrades(last).chips).toBe(0);
  });

  it('capstone fires +10 chips only when its die is at the last position', () => {
    // Die 0 has Capstone. scoringOrder [4,1,2,3,0] → die 0 is last → fires.
    const last = makeModCtx([3, 3, 3, 3, 3], [['capstone'], [], [], [], []], [4, 1, 2, 3, 0]);
    expect(upgrades(last).chips).toBe(10);
    // scoringOrder [0,1,2,3,4] → die 0 is first → does NOT fire.
    const first = makeModCtx([3, 3, 3, 3, 3], [['capstone'], [], [], [], []], [0, 1, 2, 3, 4]);
    expect(upgrades(first).chips).toBe(0);
  });

  it('conduit fires +1 mult per prior die (chainMult × pos)', () => {
    // Die 0 has Conduit. scoringOrder [4,1,2,3,0] → die 0 is at pos 4 → +4 mult.
    const lastPos = makeModCtx([3, 3, 3, 3, 3], [['conduit'], [], [], [], []], [4, 1, 2, 3, 0]);
    const lastOut = upgrades(lastPos);
    expect(lastOut.mult).toBe(1 + 4); // base 1 + 4 from chainMult
    // scoringOrder [0,1,2,3,4] → die 0 is at pos 0 → no mult bonus.
    const firstPos = makeModCtx([3, 3, 3, 3, 3], [['conduit'], [], [], [], []], [0, 1, 2, 3, 4]);
    expect(upgrades(firstPos).mult).toBe(1);
  });
});
