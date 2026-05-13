import { describe, it, expect } from 'vitest';
import './kindredClatter';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(opts: {
  owned: boolean;
  finalFaces: number[];
  collisionPairs?: Array<[number, number]>;
  mult?: number;
}): PipelineCtx {
  const state = { run: { catalysts: opts.owned ? ['kindred_clatter'] : [] }, round: {} } as unknown as GameState;
  return {
    state, chips: 0, mult: opts.mult ?? 0, total: 0, events: [], rng: mulberry32(0),
    sim: {
      finalFaces: opts.finalFaces,
      collisionCount: opts.collisionPairs?.length ?? 0,
      collisionPairs: opts.collisionPairs,
    } as any,
  };
}

describe('kindred_clatter catalyst', () => {
  const def = getAll().find((u) => u.id === 'kindred_clatter')!;

  it('does nothing when not owned', () => {
    const ctx = makeCtx({ owned: false, finalFaces: [6, 6], collisionPairs: [[0, 1]] });
    expect(def.apply(ctx).mult).toBe(0);
  });

  it('+3 mult per pair with matching face values', () => {
    // pairs: (0,1)=6,6 match. (0,2)=6,3 no. (1,2)=6,3 no. → 1 match
    const ctx = makeCtx({
      owned: true,
      finalFaces: [6, 6, 3],
      collisionPairs: [[0, 1], [0, 2], [1, 2]],
    });
    expect(def.apply(ctx).mult).toBe(3);
  });

  it('dedupes repeated pairs', () => {
    // rapier can fire the same touch multiple times — count (0,1) once
    const ctx = makeCtx({
      owned: true,
      finalFaces: [4, 4],
      collisionPairs: [[0, 1], [1, 0], [0, 1]],
    });
    expect(def.apply(ctx).mult).toBe(3);
  });

  it('no-op when no matches', () => {
    const ctx = makeCtx({
      owned: true,
      finalFaces: [1, 2, 3],
      collisionPairs: [[0, 1], [1, 2]],
    });
    expect(def.apply(ctx).mult).toBe(0);
  });

  it('no-op when collisionPairs missing', () => {
    const ctx = makeCtx({ owned: true, finalFaces: [6, 6] });
    expect(def.apply(ctx).mult).toBe(0);
  });
});
