import { describe, it, expect } from 'vitest';
import './shadowCache';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(opts: { owned: boolean; finalFaces: number[]; scoringOrder?: number[]; chips?: number }): PipelineCtx {
  const state = {
    run: { catalysts: opts.owned ? ['shadow_cache'] : [] },
    round: { scoringOrder: opts.scoringOrder },
  } as unknown as GameState;
  return {
    state,
    chips: opts.chips ?? 0,
    mult: 1,
    total: 0,
    events: [],
    rng: mulberry32(0),
    sim: { finalFaces: opts.finalFaces } as any,
  };
}

describe('shadow_cache catalyst', () => {
  const def = getAll().find((u) => u.id === 'shadow_cache')!;

  it('does nothing when not owned', () => {
    const ctx = makeCtx({ owned: false, finalFaces: [6, 6, 6], scoringOrder: [] });
    expect(def.apply(ctx).chips).toBe(0);
  });

  it('pays +3 chips per unheld face ≥ 5', () => {
    // held=[0], unheld=[1,2] showing 6,5 → 2 high faces → +6
    const ctx = makeCtx({ owned: true, finalFaces: [3, 6, 5], scoringOrder: [0] });
    expect(def.apply(ctx).chips).toBe(6);
  });

  it('ignores low unheld faces', () => {
    const ctx = makeCtx({ owned: true, finalFaces: [6, 1, 2], scoringOrder: [0] });
    expect(def.apply(ctx).chips).toBe(0);
  });

  it('no-op when nothing unheld', () => {
    const ctx = makeCtx({ owned: true, finalFaces: [6, 5], scoringOrder: [0, 1] });
    expect(def.apply(ctx).chips).toBe(0);
  });
});
