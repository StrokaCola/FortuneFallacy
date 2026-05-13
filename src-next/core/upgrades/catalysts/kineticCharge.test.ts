import { describe, it, expect } from 'vitest';
import './kineticCharge';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(opts: { owned: boolean; collisionCount: number }): PipelineCtx {
  const state = { run: { catalysts: opts.owned ? ['kinetic_charge'] : [] }, round: {} } as unknown as GameState;
  return {
    state, chips: 0, mult: 1, total: 0, events: [], rng: mulberry32(0),
    sim: { collisionCount: opts.collisionCount, finalFaces: [] } as any,
  };
}

describe('kinetic_charge catalyst', () => {
  const def = getAll().find((u) => u.id === 'kinetic_charge')!;

  it('does nothing when not owned', () => {
    expect(def.apply(makeCtx({ owned: false, collisionCount: 10 })).chips).toBe(0);
  });

  it('grants +1 chip per collision', () => {
    expect(def.apply(makeCtx({ owned: true, collisionCount: 7 })).chips).toBe(7);
  });

  it('caps at +30 chips', () => {
    expect(def.apply(makeCtx({ owned: true, collisionCount: 100 })).chips).toBe(30);
  });

  it('no-op on zero collisions', () => {
    expect(def.apply(makeCtx({ owned: true, collisionCount: 0 })).chips).toBe(0);
  });
});
