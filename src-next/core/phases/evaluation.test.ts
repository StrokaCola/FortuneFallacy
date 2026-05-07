import { describe, it, expect } from 'vitest';
import { evaluation } from './evaluation';
import type { PipelineCtx } from '../pipeline/types';
import type { GameState } from '../../state/store';
import { mulberry32 } from '../rng';

function makeCtx(
  faces: number[],
  scoringOrder: number[] | undefined,
  opts: { constellationId?: string; catalysts?: string[]; comboLevels?: Record<string, number> } = {},
): PipelineCtx {
  const state = {
    run: {
      seed: 1, shards: 0, ante: 1, goalIdx: 0,
      constellationId: opts.constellationId ?? 'lyra',
      catalysts: opts.catalysts ?? [],
      vouchers: [], consumables: [], handsPlayed: 0, compoundingStacks: 0,
      comboLevels: opts.comboLevels ?? {},
    },
    round: { scoringOrder, diceMods: [] },
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

describe('evaluation phase — held-only base scoring', () => {
  it('uses only scoringOrder-indexed faces for sumFaces', () => {
    // Dice: [3, 5, 1, 6, 2]. scoringOrder [0, 4] (held d0=3 and d4=2).
    // sumFaces = 3 + 2 = 5 (NOT 17). Combo on [3,2] is 'chance' (0 chips, 1 mult).
    // chips = 0 + 5 = 5.
    const ctx = makeCtx([3, 5, 1, 6, 2], [0, 4]);
    const out = evaluation(ctx);
    expect(out.chips).toBe(5);
    expect(out.combo?.scoringFaces).toEqual([3, 2]);
  });

  it('detects pair only on held dice (not on rolled but unlocked dupes)', () => {
    // Dice: [3, 3, 1, 1, 2]. scoringOrder [0, 4] (only d0=3 and d4=2 held).
    // Combo should be 'chance' (no pair among held faces).
    const ctx = makeCtx([3, 3, 1, 1, 2], [0, 4]);
    const out = evaluation(ctx);
    expect(out.combo?.id).toBe('chance');
  });

  it('detects pair on held when both held faces match', () => {
    // Dice: [3, 5, 1, 3, 2]. scoringOrder [0, 3] (both held = 3).
    const ctx = makeCtx([3, 5, 1, 3, 2], [0, 3]);
    const out = evaluation(ctx);
    expect(out.combo?.id).toBe('one_pair');
    expect(out.combo?.scoringFaces).toEqual([3, 3]);
  });

  it('zero held dice → zero chips + zero mult-baseline', () => {
    const ctx = makeCtx([6, 6, 6, 6, 6], []);
    const out = evaluation(ctx);
    expect(out.chips).toBe(0);
    expect(out.mult).toBe(1); // high-card mult on zero faces; degenerate but stable
    expect(out.combo?.scoringFaces).toEqual([]);
  });

  it('falls back to all faces when scoringOrder is undefined (back-compat)', () => {
    const ctx = makeCtx([1, 2, 3, 4, 5], undefined);
    const out = evaluation(ctx);
    // Straight 1-5: 5-card straight. Chips for 5-straight should be set; sumFaces=15.
    expect(out.combo?.scoringFaces).toEqual([1, 2, 3, 4, 5]);
  });

  it('preserves order of held faces per scoringOrder', () => {
    // Dice: [1, 2, 3, 4, 5]. scoringOrder [4, 1, 0] → held faces in order = [5, 2, 1].
    const ctx = makeCtx([1, 2, 3, 4, 5], [4, 1, 0]);
    const out = evaluation(ctx);
    expect(out.combo?.scoringFaces).toEqual([5, 2, 1]);
  });

  it('filters out-of-range scoringOrder indices defensively', () => {
    const ctx = makeCtx([1, 2, 3, 4, 5], [0, 99, 2]);
    const out = evaluation(ctx);
    expect(out.combo?.scoringFaces).toEqual([1, 3]);
  });
});

describe('evaluation phase — captain-crew (Argo)', () => {
  it('captain rides catalyst mult, crew adds flat chips', () => {
    // Argo, three d20s rolled [12, 7, 3]. captain = 12, crew = 7+3 = 10.
    // catalysts: [a, b] → catMult = 1 + 1.0*2 = 3.0.
    // chips = 12*3.0 + 10 = 46. mult stays 1 so chain math still scales it.
    const ctx = makeCtx([12, 7, 3], [0, 1, 2], {
      constellationId: 'argo',
      catalysts: ['x', 'y'],
    });
    const out = evaluation(ctx);
    expect(out.combo?.id).toBe('argo_captain');
    expect(out.combo?.tier).toBe(0);
    expect(out.chips).toBe(46);
    expect(out.mult).toBe(1);
    expect(out.combo?.scoringFaces).toEqual([12, 7, 3]);
  });

  it('zero catalysts → captain mult is 1, score = sum of faces', () => {
    // chips = captain*1 + crew = 12 + 10 = 22.
    const ctx = makeCtx([12, 7, 3], [0, 1, 2], { constellationId: 'argo' });
    const out = evaluation(ctx);
    expect(out.chips).toBe(22);
  });

  it('single die: captain = the die, crew = 0', () => {
    // Only one die scored: chips = 20*3.0 + 0 = 60 with two catalysts.
    const ctx = makeCtx([20, 5, 1], [0], {
      constellationId: 'argo',
      catalysts: ['x', 'y'],
    });
    const out = evaluation(ctx);
    expect(out.chips).toBe(60);
  });
});

describe('evaluation phase — galaxy combo levels', () => {
  it('Three of a Kind at level 4 adds +80 chips and +8 mult to base', () => {
    // Base Three of a Kind: chips=30, mult=5. Whirlpool per level: +20 chips, +2 mult.
    // At lvl 4: baseChips = 30 + 80 = 110, baseMult = 5 + 8 = 13.
    // Held faces: [3,3,3]. sumFaces = 9. ctx.chips = baseChips + sumFaces = 119.
    const ctx = makeCtx([3, 3, 3, 1, 6], [0, 1, 2], { comboLevels: { three_kind: 4 } });
    const out = evaluation(ctx);
    expect(out.combo?.id).toBe('three_kind');
    expect(out.combo?.baseChips).toBe(110);
    expect(out.combo?.baseMult).toBe(13);
    expect(out.chips).toBe(119);
    expect(out.mult).toBe(13);
  });

  it('level 0 leaves base values untouched (back-compat)', () => {
    // No comboLevels at all. Three of a Kind base: 30 chips, 5 mult.
    const ctx = makeCtx([3, 3, 3, 1, 6], [0, 1, 2]);
    const out = evaluation(ctx);
    expect(out.combo?.baseChips).toBe(30);
    expect(out.combo?.baseMult).toBe(5);
  });

  it('only the matched combo gets its level bonus (other combo levels ignored)', () => {
    // Two Pair on [4,4,5,5,1]. Levels set on five_kind and chance — should NOT apply.
    const ctx = makeCtx([4, 4, 5, 5, 1], [0, 1, 2, 3], {
      comboLevels: { five_kind: 99, chance: 99, two_pair: 0 },
    });
    const out = evaluation(ctx);
    expect(out.combo?.id).toBe('two_pair');
    expect(out.combo?.baseChips).toBe(20); // unchanged
    expect(out.combo?.baseMult).toBe(3);   // unchanged
  });

  it('Five of a Kind at level 1: +40 chips, +4 mult', () => {
    const ctx = makeCtx([6, 6, 6, 6, 6], [0, 1, 2, 3, 4], { comboLevels: { five_kind: 1 } });
    const out = evaluation(ctx);
    expect(out.combo?.id).toBe('five_kind');
    expect(out.combo?.baseChips).toBe(140); // 100 + 40
    expect(out.combo?.baseMult).toBe(24);   // 20 + 4
  });
});
