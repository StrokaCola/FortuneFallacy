import { describe, it, expect } from 'vitest';
import './conductor';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(diceMods: string[][], scoringOrder?: number[], chips = 100): PipelineCtx {
  const faces = diceMods.map((_, i) => (i + 1));
  const state = {
    run: { diceMods },
    round: { scoringOrder: scoringOrder ?? faces.map((_, i) => i) },
  } as unknown as GameState;
  return {
    state,
    sim: { finalFaces: faces } as unknown as PipelineCtx['sim'],
    chips,
    mult: 1,
    total: 0,
    events: [],
    rng: mulberry32(0),
  };
}

describe('conductor catalyst', () => {
  it('returns ctx unchanged when fewer than 5 scoring dice', () => {
    const def = getAll().find((u) => u.id === 'conductor')!;
    expect(def.apply(makeCtx([['amplify'], ['sharpened'], [], [], []], [0, 1, 2], 100)).chips).toBe(100);
  });

  it('+20 chips per distinct mod when full hand scores', () => {
    const def = getAll().find((u) => u.id === 'conductor')!;
    const next = def.apply(makeCtx(
      [['amplify'], ['sharpened'], ['gilded'], [], []],
      undefined,
      100,
    ));
    // 3 distinct mods → 60 chips
    expect(next.chips).toBe(160);
  });

  it('counts each mod id once even if duplicated across dice', () => {
    const def = getAll().find((u) => u.id === 'conductor')!;
    const next = def.apply(makeCtx(
      [['amplify'], ['amplify'], ['amplify'], ['amplify'], ['amplify']],
      undefined,
      100,
    ));
    // 1 distinct mod → 20 chips
    expect(next.chips).toBe(120);
  });

  it('returns ctx unchanged when no mods at all', () => {
    const def = getAll().find((u) => u.id === 'conductor')!;
    expect(def.apply(makeCtx([[], [], [], [], []], undefined, 100)).chips).toBe(100);
  });
});
