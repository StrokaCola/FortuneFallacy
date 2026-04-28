import { describe, it, expect } from 'vitest';
import './lastThrow';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';

function makeCtx(handsLeft: number, chips = 50): PipelineCtx {
  const state = { round: { handsLeft } } as unknown as GameState;
  return { state, chips, mult: 1, total: 0, events: [], rng: () => 0 };
}

describe('last_throw catalyst', () => {
  it('returns ctx unchanged when handsLeft != 1', () => {
    const def = getAll().find((u) => u.id === 'last_throw')!;
    expect(def.apply(makeCtx(2)).chips).toBe(50);
    expect(def.apply(makeCtx(0)).chips).toBe(50);
    expect(def.apply(makeCtx(3)).chips).toBe(50);
  });

  it('adds 25 chips when handsLeft = 1', () => {
    const def = getAll().find((u) => u.id === 'last_throw')!;
    const next = def.apply(makeCtx(1));
    expect(next.chips).toBe(75);
    expect(next.events).toHaveLength(1);
  });
});
