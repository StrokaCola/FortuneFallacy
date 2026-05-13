import { describe, it, expect } from 'vitest';
import './silentWitness';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(opts: { owned: boolean; finalFaces: number[]; scoringOrder?: number[] }): PipelineCtx {
  const state = {
    run: { catalysts: opts.owned ? ['silent_witness'] : [] },
    round: { scoringOrder: opts.scoringOrder },
  } as unknown as GameState;
  return {
    state, chips: 0, mult: 2, total: 0, events: [], rng: mulberry32(0),
    sim: { finalFaces: opts.finalFaces } as any,
  };
}

describe('silent_witness catalyst', () => {
  const def = getAll().find((u) => u.id === 'silent_witness')!;

  it('does nothing when not owned', () => {
    const ctx = makeCtx({ owned: false, finalFaces: [3, 2, 4], scoringOrder: [0] });
    expect(def.apply(ctx).chips).toBe(0);
    expect(def.apply(ctx).mult).toBe(2);
  });

  it('fires when all unheld faces are even and ≥2 unheld', () => {
    // unheld = 2, 4 → all even, 2 dice → fire
    const ctx = makeCtx({ owned: true, finalFaces: [3, 2, 4], scoringOrder: [0] });
    const out = def.apply(ctx);
    expect(out.chips).toBe(10);
    expect(out.mult).toBeCloseTo(2.2);
  });

  it('skips when fewer than 2 unheld', () => {
    const ctx = makeCtx({ owned: true, finalFaces: [3, 2], scoringOrder: [0] });
    expect(def.apply(ctx).chips).toBe(0);
  });

  it('skips when any unheld face is odd', () => {
    const ctx = makeCtx({ owned: true, finalFaces: [3, 2, 3], scoringOrder: [0] });
    expect(def.apply(ctx).chips).toBe(0);
  });
});
