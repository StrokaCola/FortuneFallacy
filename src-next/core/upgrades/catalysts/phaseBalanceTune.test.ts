// Tests for the 2026-05-08 balance pack — verify each new catalyst
// produces the documented chips/mult delta on a representative ctx.
// Mirrors the structure of phase3.test.ts.
import { describe, it, expect } from 'vitest';
import './luckyStreak';
import './faceValue';
import './firstStrike';
import './momentum';
import './diceMaster';
import './prismLens';
import './streakSeeker';
import './novaBurst';
import './highRoller';
import './royalFlush';
import './economyEngine';
import './eclipsePact';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

type CtxOpts = {
  faces?: number[];
  scoringOrder?: number[];
  chips?: number;
  mult?: number;
  combo?: { id: string; tier: number; baseChips: number; baseMult: number; scoringFaces: number[] } | null;
  shards?: number;
  ante?: number;
  handsPlayed?: number;
  compoundingStacks?: number;
  firstHandPlayed?: boolean;
  catalysts?: string[];
};

function makeCtx(opts: CtxOpts = {}): PipelineCtx {
  const faces = opts.faces ?? [1, 2, 3, 4, 5];
  const state = {
    run: {
      shards: opts.shards ?? 0,
      ante: opts.ante ?? 1,
      handsPlayed: opts.handsPlayed ?? 0,
      compoundingStacks: opts.compoundingStacks ?? 0,
      catalysts: opts.catalysts ?? [],
    },
    round: {
      scoringOrder: opts.scoringOrder ?? faces.map((_, i) => i),
      firstHandPlayed: opts.firstHandPlayed ?? false,
    },
  } as unknown as GameState;
  const ctx: PipelineCtx = {
    state,
    sim: { finalFaces: faces } as unknown as PipelineCtx['sim'],
    chips: opts.chips ?? 0,
    mult: opts.mult ?? 1,
    total: 0,
    events: [],
    rng: mulberry32(0),
  };
  if (opts.combo !== null) {
    ctx.combo = opts.combo ?? { id: 'chance', tier: 0, baseChips: 0, baseMult: 1, scoringFaces: [] };
  }
  return ctx;
}

const findCat = (id: string) => getAll().find((u) => u.id === id)!;

describe('lucky_streak (first scoring hand of round → +30 chips, +3 mult)', () => {
  it('fires when no hand has scored yet this round', () => {
    const ctx = makeCtx({ chips: 10, mult: 2, firstHandPlayed: false });
    const out = findCat('lucky_streak').apply(ctx);
    expect(out.chips).toBe(40);
    expect(out.mult).toBe(5);
  });
  it('no-op after firstHandPlayed', () => {
    const ctx = makeCtx({ chips: 10, mult: 2, firstHandPlayed: true });
    const out = findCat('lucky_streak').apply(ctx);
    expect(out.chips).toBe(10);
    expect(out.mult).toBe(2);
  });
});

describe('face_value (each scoring 4 → +3 chips, +1 mult)', () => {
  it('counts only scoring 4s', () => {
    const ctx = makeCtx({ faces: [4, 4, 4, 1, 2], scoringOrder: [0, 1, 2], chips: 0, mult: 1 });
    const out = findCat('face_value').apply(ctx);
    expect(out.chips).toBe(9);
    expect(out.mult).toBe(4);
  });
  it('no-op when no 4s score', () => {
    const ctx = makeCtx({ faces: [1, 2, 3, 5, 6], chips: 5, mult: 2 });
    const out = findCat('face_value').apply(ctx);
    expect(out.chips).toBe(5);
    expect(out.mult).toBe(2);
  });
});

describe('first_strike (first hand of run → +50 chips, +5 mult)', () => {
  it('fires on hand 0 of run', () => {
    const ctx = makeCtx({ chips: 0, mult: 1, handsPlayed: 0 });
    const out = findCat('first_strike').apply(ctx);
    expect(out.chips).toBe(50);
    expect(out.mult).toBe(6);
  });
  it('no-op after the first hand', () => {
    const ctx = makeCtx({ chips: 0, mult: 1, handsPlayed: 1 });
    const out = findCat('first_strike').apply(ctx);
    expect(out.chips).toBe(0);
    expect(out.mult).toBe(1);
  });
});

describe('momentum (stacks × 0.4 multiplicative on mult)', () => {
  it('5 stacks → mult ×3.0 (1 + 5*0.4)', () => {
    const ctx = makeCtx({ mult: 10, compoundingStacks: 5 });
    expect(findCat('momentum').apply(ctx).mult).toBeCloseTo(30, 5);
  });
  it('no-op at 0 stacks', () => {
    const ctx = makeCtx({ mult: 10, compoundingStacks: 0 });
    expect(findCat('momentum').apply(ctx).mult).toBe(10);
  });
});

describe('dice_master (no-op pipeline; effect lives in stakeContext)', () => {
  it('apply is identity', () => {
    const ctx = makeCtx({ chips: 10, mult: 2 });
    const out = findCat('dice_master').apply(ctx);
    expect(out.chips).toBe(10);
    expect(out.mult).toBe(2);
  });
});

describe('prism_lens (any non-chance combo → +25 chips, ×1.5 mult)', () => {
  it('fires on one_pair', () => {
    const ctx = makeCtx({
      combo: { id: 'one_pair', tier: 1, baseChips: 10, baseMult: 2, scoringFaces: [] },
      chips: 50, mult: 4,
    });
    const out = findCat('prism_lens').apply(ctx);
    expect(out.chips).toBe(75);
    expect(out.mult).toBe(6);
  });
  it('no-op on chance', () => {
    const ctx = makeCtx({ combo: { id: 'chance', tier: 0, baseChips: 0, baseMult: 1, scoringFaces: [] }, chips: 50, mult: 4 });
    const out = findCat('prism_lens').apply(ctx);
    expect(out.chips).toBe(50);
    expect(out.mult).toBe(4);
  });
});

describe('streak_seeker (every 4th hand of run → ×2 mult)', () => {
  it('fires on hand 4 (handsPlayed=3, since +1 = 4)', () => {
    const ctx = makeCtx({ mult: 5, handsPlayed: 3 });
    expect(findCat('streak_seeker').apply(ctx).mult).toBe(10);
  });
  it('no-op on hand 5', () => {
    const ctx = makeCtx({ mult: 5, handsPlayed: 4 });
    expect(findCat('streak_seeker').apply(ctx).mult).toBe(5);
  });
});

describe('nova_burst (mult × (1 + ante × 0.4))', () => {
  it('ante 1 → ×1.4', () => {
    const ctx = makeCtx({ mult: 10, ante: 1 });
    expect(findCat('nova_burst').apply(ctx).mult).toBeCloseTo(14, 5);
  });
  it('ante 4 → ×2.6', () => {
    const ctx = makeCtx({ mult: 10, ante: 4 });
    expect(findCat('nova_burst').apply(ctx).mult).toBeCloseTo(26, 5);
  });
});

describe('high_roller (each scoring 5/6 → +2 chips, +1 mult)', () => {
  it('counts 5s and 6s', () => {
    const ctx = makeCtx({ faces: [5, 6, 6, 1, 2], scoringOrder: [0, 1, 2], chips: 0, mult: 1 });
    const out = findCat('high_roller').apply(ctx);
    expect(out.chips).toBe(6);
    expect(out.mult).toBe(4);
  });
  it('no-op when none of those score', () => {
    const ctx = makeCtx({ faces: [1, 2, 3, 4, 4], chips: 0, mult: 1 });
    const out = findCat('high_roller').apply(ctx);
    expect(out.chips).toBe(0);
    expect(out.mult).toBe(1);
  });
});

describe('royal_flush (five_kind / lg_straight → +200 chips, ×2 mult)', () => {
  it('fires on five_kind', () => {
    const ctx = makeCtx({
      combo: { id: 'five_kind', tier: 8, baseChips: 100, baseMult: 20, scoringFaces: [] },
      chips: 100, mult: 5,
    });
    const out = findCat('royal_flush').apply(ctx);
    expect(out.chips).toBe(300);
    expect(out.mult).toBe(10);
  });
  it('fires on lg_straight', () => {
    const ctx = makeCtx({
      combo: { id: 'lg_straight', tier: 6, baseChips: 50, baseMult: 10, scoringFaces: [] },
      chips: 0, mult: 2,
    });
    const out = findCat('royal_flush').apply(ctx);
    expect(out.chips).toBe(200);
    expect(out.mult).toBe(4);
  });
  it('no-op on lower combos', () => {
    const ctx = makeCtx({
      combo: { id: 'three_kind', tier: 3, baseChips: 30, baseMult: 5, scoringFaces: [] },
      chips: 30, mult: 5,
    });
    const out = findCat('royal_flush').apply(ctx);
    expect(out.chips).toBe(30);
    expect(out.mult).toBe(5);
  });
});

describe('economy_engine (each held shard → +0.1 mult)', () => {
  it('15 shards → +1.5 mult', () => {
    const ctx = makeCtx({ mult: 5, shards: 15 });
    expect(findCat('economy_engine').apply(ctx).mult).toBeCloseTo(6.5, 5);
  });
  it('no-op at 0 shards', () => {
    const ctx = makeCtx({ mult: 5, shards: 0 });
    expect(findCat('economy_engine').apply(ctx).mult).toBe(5);
  });
});

describe('eclipse_pact (every scoring hand → +50 chips, +5 mult)', () => {
  it('always fires', () => {
    const ctx = makeCtx({ chips: 0, mult: 1 });
    const out = findCat('eclipse_pact').apply(ctx);
    expect(out.chips).toBe(50);
    expect(out.mult).toBe(6);
  });
});
