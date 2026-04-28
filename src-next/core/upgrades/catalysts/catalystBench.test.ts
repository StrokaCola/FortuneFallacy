import { describe, it, expect } from 'vitest';
import './catalystBench';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';

function makeCtx(catalysts: string[], mult = 1): PipelineCtx {
  const state = { run: { catalysts } } as unknown as GameState;
  return { state, chips: 0, mult, total: 0, events: [], rng: () => 0 };
}

describe('catalyst_bench catalyst', () => {
  it('returns ctx unchanged when no other catalysts', () => {
    const def = getAll().find((u) => u.id === 'catalyst_bench')!;
    expect(def.apply(makeCtx([])).mult).toBe(1);
    expect(def.apply(makeCtx(['catalyst_bench'])).mult).toBe(1);
  });

  it('adds +1 mult per other catalyst', () => {
    const def = getAll().find((u) => u.id === 'catalyst_bench')!;
    expect(def.apply(makeCtx(['stratifier', 'six_bias', 'cold_hand'], 1)).mult).toBe(4);
  });

  it('does not double-count self when also owned', () => {
    const def = getAll().find((u) => u.id === 'catalyst_bench')!;
    expect(def.apply(makeCtx(['catalyst_bench', 'stratifier', 'six_bias'], 1)).mult).toBe(3);
  });
});
