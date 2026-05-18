import { describe, it, expect } from 'vitest';
import './ironSix';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(faces: number[], scoringOrder?: number[], mult = 1): PipelineCtx {
  const state = {
    run: {},
    round: { scoringOrder: scoringOrder ?? faces.map((_, i) => i) },
  } as unknown as GameState;
  return {
    state,
    sim: { finalFaces: faces } as unknown as PipelineCtx['sim'],
    chips: 0,
    mult,
    total: 0,
    events: [],
    rng: mulberry32(0),
  };
}

describe('iron_six catalyst', () => {
  it('returns ctx unchanged when no scoring 6s', () => {
    const def = getAll().find((u) => u.id === 'iron_six')!;
    expect(def.apply(makeCtx([1, 2, 3, 4, 5], undefined, 4)).mult).toBe(4);
  });

  it('adds +2 mult per scoring 6 (post-audit buff: was +1)', () => {
    const def = getAll().find((u) => u.id === 'iron_six')!;
    // 3 sixes × 2 mult each = +6, on base 4 → 10.
    expect(def.apply(makeCtx([6, 6, 6, 1, 1], undefined, 4)).mult).toBe(10);
  });

  it('only counts 6s in the scoring set (respects scoringOrder)', () => {
    const def = getAll().find((u) => u.id === 'iron_six')!;
    // Two 6s exist, but only one is in scoringOrder. 1 × 2 = +2, base 4 → 6.
    expect(def.apply(makeCtx([6, 6, 1, 1, 1], [0, 2, 3], 4)).mult).toBe(6);
  });
});
