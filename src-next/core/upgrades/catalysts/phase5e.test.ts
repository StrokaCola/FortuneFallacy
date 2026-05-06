import { describe, it, expect } from 'vitest';
import './crescendoRun';
import './shardLung';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(opts: { mult?: number; rollsWithoutLock?: number; shards?: number }): PipelineCtx {
  const state = {
    run: { shards: opts.shards ?? 0 },
    round: { rollsWithoutLock: opts.rollsWithoutLock ?? 0 },
  } as unknown as GameState;
  return {
    state,
    chips: 0,
    mult: opts.mult ?? 1,
    total: 0,
    events: [],
    rng: mulberry32(0),
    sim: { finalFaces: [] } as unknown as PipelineCtx['sim'],
  };
}

const findCat = (id: string) => getAll().find((u) => u.id === id)!;

describe('crescendo_run catalyst (×2 mult on 3+ rolls without locking)', () => {
  it('fires at exactly 3 rolls without locking', () => {
    const ctx = makeCtx({ mult: 4, rollsWithoutLock: 3 });
    expect(findCat('crescendo_run').apply(ctx).mult).toBe(8);
  });

  it('fires at higher counts too', () => {
    const ctx = makeCtx({ mult: 4, rollsWithoutLock: 10 });
    expect(findCat('crescendo_run').apply(ctx).mult).toBe(8);
  });

  it('does not fire below 3 rolls', () => {
    expect(findCat('crescendo_run').apply(makeCtx({ mult: 4, rollsWithoutLock: 0 })).mult).toBe(4);
    expect(findCat('crescendo_run').apply(makeCtx({ mult: 4, rollsWithoutLock: 2 })).mult).toBe(4);
  });
});

describe('shard_lung catalyst (spend half shards for mult)', () => {
  it('spends floor(shards/2), adds equal mult, mutates shards in ctx state', () => {
    const ctx = makeCtx({ mult: 5, shards: 10 });
    const out = findCat('shard_lung').apply(ctx);
    expect(out.mult).toBe(10); // 5 + 5 spent
    expect(out.state.run.shards).toBe(5); // 10 - 5
  });

  it('rounds down on odd shard counts', () => {
    const ctx = makeCtx({ mult: 5, shards: 7 });
    const out = findCat('shard_lung').apply(ctx);
    expect(out.mult).toBe(8); // 5 + 3 spent
    expect(out.state.run.shards).toBe(4);
  });

  it('no-op at 0 shards', () => {
    const ctx = makeCtx({ mult: 5, shards: 0 });
    const out = findCat('shard_lung').apply(ctx);
    expect(out.mult).toBe(5);
    expect(out.state.run.shards).toBe(0);
  });

  it('no-op at 1 shard (floor(1/2) = 0)', () => {
    const ctx = makeCtx({ mult: 5, shards: 1 });
    const out = findCat('shard_lung').apply(ctx);
    expect(out.mult).toBe(5);
    expect(out.state.run.shards).toBe(1);
  });
});
