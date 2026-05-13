import { describe, it, expect } from 'vitest';
import './reservoir';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(opts: { owned: boolean; finalFaces: number[]; scoringOrder?: number[] }): PipelineCtx {
  const state = {
    run: { catalysts: opts.owned ? ['reservoir'] : [] },
    round: { scoringOrder: opts.scoringOrder },
  } as unknown as GameState;
  return {
    state, chips: 0, mult: 1, total: 0, events: [], rng: mulberry32(0),
    sim: { finalFaces: opts.finalFaces } as any,
  };
}

describe('reservoir catalyst', () => {
  const def = getAll().find((u) => u.id === 'reservoir')!;

  it('does nothing when not owned', () => {
    expect(def.apply(makeCtx({ owned: false, finalFaces: [3, 4, 5], scoringOrder: [] })).chips).toBe(0);
  });

  it('sums all unheld face values', () => {
    // unheld faces 4 + 5 = 9
    expect(def.apply(makeCtx({ owned: true, finalFaces: [3, 4, 5], scoringOrder: [0] })).chips).toBe(9);
  });

  it('no-op when nothing unheld', () => {
    expect(def.apply(makeCtx({ owned: true, finalFaces: [3, 4], scoringOrder: [0, 1] })).chips).toBe(0);
  });
});
