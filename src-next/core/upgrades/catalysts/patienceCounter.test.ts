import { describe, it, expect } from 'vitest';
import './patienceCounter';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';

function makeCtx(handsPlayed: number, mult = 5): PipelineCtx {
  const state = { run: { handsPlayed } } as unknown as GameState;
  return { state, chips: 0, mult, total: 0, events: [], rng: () => 0 };
}

describe('patience_counter catalyst', () => {
  it('returns ctx unchanged on non-5th hands', () => {
    const def = getAll().find((u) => u.id === 'patience_counter')!;
    expect(def.apply(makeCtx(0)).mult).toBe(5);
    expect(def.apply(makeCtx(1)).mult).toBe(5);
    expect(def.apply(makeCtx(2)).mult).toBe(5);
    expect(def.apply(makeCtx(3)).mult).toBe(5);
  });

  it('multiplies mult by 3 on 5th hand', () => {
    const def = getAll().find((u) => u.id === 'patience_counter')!;
    expect(def.apply(makeCtx(4, 5)).mult).toBe(15);
  });

  it('multiplies mult by 3 on 10th hand', () => {
    const def = getAll().find((u) => u.id === 'patience_counter')!;
    expect(def.apply(makeCtx(9, 5)).mult).toBe(15);
  });

  it('multiplies mult by 3 on 15th hand', () => {
    const def = getAll().find((u) => u.id === 'patience_counter')!;
    expect(def.apply(makeCtx(14, 5)).mult).toBe(15);
  });
});
