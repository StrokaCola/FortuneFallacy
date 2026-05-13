import { describe, it, expect } from 'vitest';
import './unseenChorus';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(opts: { owned: boolean; finalFaces: number[]; scoringOrder?: number[] }): PipelineCtx {
  const state = {
    run: { catalysts: opts.owned ? ['unseen_chorus'] : [] },
    round: { scoringOrder: opts.scoringOrder },
  } as unknown as GameState;
  return {
    state, chips: 0, mult: 2, total: 0, events: [], rng: mulberry32(0),
    sim: { finalFaces: opts.finalFaces } as any,
  };
}

describe('unseen_chorus catalyst', () => {
  const def = getAll().find((u) => u.id === 'unseen_chorus')!;

  it('does nothing when not owned', () => {
    const ctx = makeCtx({ owned: false, finalFaces: [1, 2, 3, 4], scoringOrder: [0] });
    expect(def.apply(ctx).mult).toBe(2);
  });

  it('fires on 3+ distinct unheld faces', () => {
    // unheld = 2, 3, 4 → all distinct
    const ctx = makeCtx({ owned: true, finalFaces: [1, 2, 3, 4], scoringOrder: [0] });
    expect(def.apply(ctx).mult).toBeCloseTo(3);
  });

  it('skips when fewer than 3 unheld', () => {
    const ctx = makeCtx({ owned: true, finalFaces: [1, 2, 3], scoringOrder: [0] });
    expect(def.apply(ctx).mult).toBe(2);
  });

  it('skips when any duplicate among unheld', () => {
    const ctx = makeCtx({ owned: true, finalFaces: [1, 2, 2, 4], scoringOrder: [0] });
    expect(def.apply(ctx).mult).toBe(2);
  });
});
