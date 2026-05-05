import { describe, it, expect } from 'vitest';
import './shardSink';
import { shardSinkActive } from './shardSink';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(primed: boolean, mult = 4): PipelineCtx {
  const state = { round: { shardSinkPrimedThisHand: primed } } as unknown as GameState;
  return { state, chips: 0, mult, total: 0, events: [], rng: mulberry32(0) };
}

describe('shardSinkActive helper', () => {
  it('false when shard_sink not owned', () => {
    const state = { run: { catalysts: [], shards: 5 } } as unknown as GameState;
    expect(shardSinkActive(state)).toBe(false);
  });

  it('false when shards = 0', () => {
    const state = { run: { catalysts: ['shard_sink'], shards: 0 } } as unknown as GameState;
    expect(shardSinkActive(state)).toBe(false);
  });

  it('true when shard_sink owned and shards >= 1', () => {
    const state1 = { run: { catalysts: ['shard_sink'], shards: 1 } } as unknown as GameState;
    expect(shardSinkActive(state1)).toBe(true);
    const state5 = { run: { catalysts: ['shard_sink'], shards: 5 } } as unknown as GameState;
    expect(shardSinkActive(state5)).toBe(true);
  });
});

describe('shard_sink catalyst', () => {
  it('returns ctx unchanged when shardSinkPrimedThisHand = false', () => {
    const def = getAll().find((u) => u.id === 'shard_sink')!;
    expect(def.apply(makeCtx(false)).mult).toBe(4);
  });

  it('multiplies mult by 1.5 when primed', () => {
    const def = getAll().find((u) => u.id === 'shard_sink')!;
    expect(def.apply(makeCtx(true, 4)).mult).toBe(6);
  });
});
