import { describe, it, expect } from 'vitest';
import './solarFlare';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(faces: number[], mult = 4): PipelineCtx {
  const state = {
    run: {},
    round: { scoringOrder: faces.map((_, i) => i) },
  } as unknown as GameState;
  return {
    state,
    sim: { finalFaces: faces } as unknown as PipelineCtx['sim'],
    chips: 0,
    mult,
    total: 0,
    events: [],
    rng: mulberry32(0),
  };
}

describe('solar_flare catalyst', () => {
  it('returns ctx unchanged when fewer than 3 dice show 5/6', () => {
    const def = getAll().find((u) => u.id === 'solar_flare')!;
    expect(def.apply(makeCtx([5, 6, 1, 2, 3], 4)).mult).toBe(4);
  });

  it('×1.5 mult when 3+ dice show 5/6', () => {
    const def = getAll().find((u) => u.id === 'solar_flare')!;
    expect(def.apply(makeCtx([5, 5, 6, 1, 1], 4)).mult).toBe(6);
  });

  it('also fires at 4 or 5 high faces', () => {
    const def = getAll().find((u) => u.id === 'solar_flare')!;
    expect(def.apply(makeCtx([6, 6, 6, 6, 6], 4)).mult).toBe(6);
  });
});
