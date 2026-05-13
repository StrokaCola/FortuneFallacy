import { describe, it, expect } from 'vitest';
import './chainReaction';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(opts: { owned: boolean; collisionCount: number; mult?: number }): PipelineCtx {
  const state = { run: { catalysts: opts.owned ? ['chain_reaction'] : [] }, round: {} } as unknown as GameState;
  return {
    state, chips: 0, mult: opts.mult ?? 4, total: 0, events: [], rng: mulberry32(0),
    sim: { collisionCount: opts.collisionCount, finalFaces: [] } as any,
  };
}

describe('chain_reaction catalyst', () => {
  const def = getAll().find((u) => u.id === 'chain_reaction')!;

  it('does nothing when not owned', () => {
    expect(def.apply(makeCtx({ owned: false, collisionCount: 20 })).mult).toBe(4);
  });

  it('fires x1.5 mult at threshold', () => {
    expect(def.apply(makeCtx({ owned: true, collisionCount: 15 })).mult).toBeCloseTo(6);
  });

  it('skips below threshold', () => {
    expect(def.apply(makeCtx({ owned: true, collisionCount: 14 })).mult).toBe(4);
  });
});
