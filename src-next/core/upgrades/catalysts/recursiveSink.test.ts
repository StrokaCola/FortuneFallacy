import { describe, it, expect } from 'vitest';
import './recursiveSink';
import { recursiveSinkActive } from './recursiveSink';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(primed: boolean, mult = 4): PipelineCtx {
  const state = { round: { recursiveSinkPrimedThisHand: primed } } as unknown as GameState;
  return { state, chips: 0, mult, total: 0, events: [], rng: mulberry32(0) };
}

describe('recursiveSinkActive helper', () => {
  it('false unless both shard_sink and recursive_sink are owned', () => {
    expect(recursiveSinkActive({ run: { catalysts: [], shards: 5 } } as unknown as GameState)).toBe(false);
    expect(recursiveSinkActive({ run: { catalysts: ['shard_sink'], shards: 5 } } as unknown as GameState)).toBe(false);
    expect(recursiveSinkActive({ run: { catalysts: ['recursive_sink'], shards: 5 } } as unknown as GameState)).toBe(false);
  });

  it('false when shards < 2 (can\'t afford both surcharges)', () => {
    const state = { run: { catalysts: ['shard_sink', 'recursive_sink'], shards: 1 } } as unknown as GameState;
    expect(recursiveSinkActive(state)).toBe(false);
  });

  it('true when both owned and shards >= 2', () => {
    const state = { run: { catalysts: ['shard_sink', 'recursive_sink'], shards: 2 } } as unknown as GameState;
    expect(recursiveSinkActive(state)).toBe(true);
  });
});

describe('recursive_sink catalyst', () => {
  it('returns ctx unchanged when not primed', () => {
    const def = getAll().find((u) => u.id === 'recursive_sink')!;
    expect(def.apply(makeCtx(false, 4)).mult).toBe(4);
  });

  it('×1.25 mult when primed', () => {
    const def = getAll().find((u) => u.id === 'recursive_sink')!;
    expect(def.apply(makeCtx(true, 4)).mult).toBe(5);
  });
});
