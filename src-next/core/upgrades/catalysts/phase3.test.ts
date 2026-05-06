import { describe, it, expect } from 'vitest';
import './pairDynamo';
import './tripletEngine';
import './magnitude';
import './primePact';
import './evenKeeled';
import './oddVoice';
import './usurer';
import './levelsLevy';
import './allBand';
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
  comboLevels?: Record<string, number>;
  allBandUsed?: boolean;
};

function makeCtx(opts: CtxOpts = {}): PipelineCtx {
  const faces = opts.faces ?? [1, 2, 3, 4, 5];
  const state = {
    run: {
      shards: opts.shards ?? 0,
      comboLevels: opts.comboLevels ?? {},
    },
    round: {
      scoringOrder: opts.scoringOrder ?? faces.map((_, i) => i),
      allBandUsedThisRound: opts.allBandUsed ?? false,
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

describe('pair_dynamo (One Pair → +5 mult)', () => {
  it('adds +5 mult on one_pair', () => {
    const ctx = makeCtx({ combo: { id: 'one_pair', tier: 1, baseChips: 10, baseMult: 2, scoringFaces: [3, 3] }, mult: 2 });
    expect(findCat('pair_dynamo').apply(ctx).mult).toBe(7);
  });

  it('no-op on other combos', () => {
    const ctx = makeCtx({ combo: { id: 'two_pair', tier: 2, baseChips: 20, baseMult: 3, scoringFaces: [] }, mult: 3 });
    expect(findCat('pair_dynamo').apply(ctx).mult).toBe(3);
  });
});

describe('triplet_engine (Three of a Kind → mult ×1.75)', () => {
  it('multiplies mult by 1.75 on three_kind', () => {
    const ctx = makeCtx({ combo: { id: 'three_kind', tier: 3, baseChips: 30, baseMult: 5, scoringFaces: [] }, mult: 4 });
    expect(findCat('triplet_engine').apply(ctx).mult).toBe(7);
  });

  it('no-op on other combos', () => {
    const ctx = makeCtx({ combo: { id: 'one_pair', tier: 1, baseChips: 10, baseMult: 2, scoringFaces: [] }, mult: 4 });
    expect(findCat('triplet_engine').apply(ctx).mult).toBe(4);
  });
});

describe('magnitude (Large Straight → chips ×2, mult ×1.5)', () => {
  it('applies both multipliers on lg_straight', () => {
    const ctx = makeCtx({ combo: { id: 'lg_straight', tier: 6, baseChips: 40, baseMult: 7, scoringFaces: [] }, chips: 50, mult: 4 });
    const out = findCat('magnitude').apply(ctx);
    expect(out.chips).toBe(100);
    expect(out.mult).toBe(6);
  });

  it('no-op on small straights', () => {
    const ctx = makeCtx({ combo: { id: 'sm_straight', tier: 4, baseChips: 30, baseMult: 5, scoringFaces: [] }, chips: 40, mult: 5 });
    const out = findCat('magnitude').apply(ctx);
    expect(out.chips).toBe(40);
    expect(out.mult).toBe(5);
  });
});

describe('prime_pact (each scoring 2/3/5 → +2 chips)', () => {
  it('counts only primes in the scoring set', () => {
    const ctx = makeCtx({ faces: [2, 3, 4, 5, 6], scoringOrder: [0, 1, 3], chips: 10 });
    // Primes in scoring: 2, 3, 5 = 3 primes → +6 chips.
    expect(findCat('prime_pact').apply(ctx).chips).toBe(16);
  });

  it('no-op when no primes in scoring set', () => {
    const ctx = makeCtx({ faces: [4, 6, 4, 6, 4], chips: 10 });
    expect(findCat('prime_pact').apply(ctx).chips).toBe(10);
  });
});

describe('even_keeled (all even → chips ×1.5)', () => {
  it('triggers when every scoring face is even', () => {
    const ctx = makeCtx({ faces: [2, 4, 6, 1, 1], scoringOrder: [0, 1, 2], chips: 100 });
    expect(findCat('even_keeled').apply(ctx).chips).toBe(150);
  });

  it('no-op when any scoring face is odd', () => {
    const ctx = makeCtx({ faces: [2, 3, 4, 1, 1], scoringOrder: [0, 1, 2], chips: 100 });
    expect(findCat('even_keeled').apply(ctx).chips).toBe(100);
  });

  it('no-op on empty scoring set (degenerate hand)', () => {
    const ctx = makeCtx({ faces: [2, 4, 6], scoringOrder: [], chips: 100 });
    expect(findCat('even_keeled').apply(ctx).chips).toBe(100);
  });
});

describe('odd_voice (all odd → mult ×1.5)', () => {
  it('triggers when every scoring face is odd', () => {
    const ctx = makeCtx({ faces: [1, 3, 5, 2, 2], scoringOrder: [0, 1, 2], mult: 4 });
    expect(findCat('odd_voice').apply(ctx).mult).toBe(6);
  });

  it('no-op when any scoring face is even', () => {
    const ctx = makeCtx({ faces: [1, 3, 5, 2, 2], scoringOrder: [0, 1, 2, 3], mult: 4 });
    expect(findCat('odd_voice').apply(ctx).mult).toBe(4);
  });
});

describe('usurer (each shard above 10 → +1 mult)', () => {
  it('grants +1 mult per shard above 10', () => {
    const ctx = makeCtx({ shards: 15, mult: 5 });
    expect(findCat('usurer').apply(ctx).mult).toBe(10);
  });

  it('no-op at or below 10 shards', () => {
    expect(findCat('usurer').apply(makeCtx({ shards: 10, mult: 5 })).mult).toBe(5);
    expect(findCat('usurer').apply(makeCtx({ shards: 0, mult: 5 })).mult).toBe(5);
  });
});

describe('levels_levy (each combo level on played hand → +1 mult)', () => {
  it('adds mult equal to the played combo level', () => {
    const ctx = makeCtx({
      combo: { id: 'three_kind', tier: 3, baseChips: 110, baseMult: 13, scoringFaces: [] },
      comboLevels: { three_kind: 4, five_kind: 99 },
      mult: 5,
    });
    expect(findCat('levels_levy').apply(ctx).mult).toBe(9);
  });

  it('no-op at level 0', () => {
    const ctx = makeCtx({
      combo: { id: 'three_kind', tier: 3, baseChips: 30, baseMult: 5, scoringFaces: [] },
      mult: 5,
    });
    expect(findCat('levels_levy').apply(ctx).mult).toBe(5);
  });
});

describe('all_band (legendary — once per round, tier up)', () => {
  it('Three of a Kind tier-up adds chips delta and mult delta from raw COMBOS', () => {
    // three_kind raw: 30/5; sm_straight raw: 30/5 — same chips, same mult
    // (next tier IS Small Straight, which has same raw values). Use Two
    // Pair tier-up to a meaningful tier: two_pair (20/3) → three_kind (30/5).
    const ctx = makeCtx({
      combo: { id: 'two_pair', tier: 2, baseChips: 20, baseMult: 3, scoringFaces: [] },
      chips: 100,
      mult: 5,
    });
    const out = findCat('all_band').apply(ctx);
    expect(out.chips).toBe(110); // +10 chips (30-20)
    expect(out.mult).toBe(7);    // +2 mult (5-3)
    expect(out.state.round.allBandUsedThisRound).toBe(true);
  });

  it('skips when already used this round', () => {
    const ctx = makeCtx({
      combo: { id: 'two_pair', tier: 2, baseChips: 20, baseMult: 3, scoringFaces: [] },
      chips: 100,
      mult: 5,
      allBandUsed: true,
    });
    const out = findCat('all_band').apply(ctx);
    expect(out.chips).toBe(100);
    expect(out.mult).toBe(5);
  });

  it('no-op at Five of a Kind (top tier, no next)', () => {
    const ctx = makeCtx({
      combo: { id: 'five_kind', tier: 8, baseChips: 100, baseMult: 20, scoringFaces: [] },
      chips: 200,
      mult: 25,
    });
    const out = findCat('all_band').apply(ctx);
    expect(out.chips).toBe(200);
    expect(out.mult).toBe(25);
    expect(out.state.round.allBandUsedThisRound).toBe(false);
  });
});
