import { describe, it, expect } from 'vitest';
import { upgrades } from '../../phases/upgrades';
import './gildingPress';
import '../catalysts/index';
import { initialRunSlice } from '../../../state/slices/run';
import { initialRoundSlice } from '../../../state/slices/round';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtxWithDie(opts: {
  faces: number[];
  scoringOrder: number[];
  diceMods: string[][];
  catalysts: string[];
}): PipelineCtx {
  const state = {
    run: {
      ...initialRunSlice(),
      catalysts: opts.catalysts,
      diceMods: opts.diceMods,
    },
    round: {
      ...initialRoundSlice(),
      scoringOrder: opts.scoringOrder,
      firstHandPlayed: true,
    },
  } as unknown as GameState;
  return {
    state,
    sim: { finalFaces: opts.faces } as unknown as PipelineCtx['sim'],
    chips: 0,
    mult: 1,
    total: 0,
    events: [],
    rng: mulberry32(0),
  };
}

describe('gilding_press catalyst (first mod on each die fires twice for chips)', () => {
  it('doubles the chips contribution from amplify on each scoring die', () => {
    // amplify = +2 chips per scoring die. With gilding_press, the first
    // mod (amplify) fires twice → +4 chips per die.
    // 2 scoring dice × 4 chips = +8 chips total from gilding_press.
    const noPress = makeCtxWithDie({
      faces: [3, 3, 1, 1, 1],
      scoringOrder: [0, 1],
      diceMods: [['amplify'], ['amplify'], [], [], []],
      catalysts: [],
    });
    const withPress = makeCtxWithDie({
      faces: [3, 3, 1, 1, 1],
      scoringOrder: [0, 1],
      diceMods: [['amplify'], ['amplify'], [], [], []],
      catalysts: ['gilding_press'],
    });
    const baseline = upgrades(noPress);
    const out = upgrades(withPress);
    expect(out.chips - baseline.chips).toBe(4); // 2 dice × +2 echo chips
  });

  it('no-op for dice with no mods', () => {
    const ctx = makeCtxWithDie({
      faces: [3, 3, 1, 1, 1],
      scoringOrder: [0, 1],
      diceMods: [[], [], [], [], []],
      catalysts: ['gilding_press'],
    });
    const out = upgrades(ctx);
    expect(out.chips).toBe(0);
  });

  it('only re-fires the FIRST mod, not subsequent slots', () => {
    // Die has [amplify, sharpened]. amplify echoes (+2 chips), sharpened doesn't.
    const ctx = makeCtxWithDie({
      faces: [3, 1, 1, 1, 1],
      scoringOrder: [0],
      diceMods: [['amplify', 'sharpened'], [], [], [], []],
      catalysts: ['gilding_press'],
    });
    const out = upgrades(ctx);
    // amplify normal: +2 chips. sharpened: +1 mult. gilding_press: +2 chips on amplify.
    // Total chips: 4. mult: 1 + 1 = 2.
    expect(out.chips).toBe(4);
    expect(out.mult).toBe(2);
  });
});

describe('mod_gravity catalyst (+5 mult on 4+ scoring dice)', () => {
  function makeMultCtx(scoringFaces: number[]): PipelineCtx {
    const state = {
      run: { ...initialRunSlice(), catalysts: ['mod_gravity'] },
      round: { ...initialRoundSlice(), firstHandPlayed: true },
    } as unknown as GameState;
    return {
      state,
      sim: { finalFaces: scoringFaces } as unknown as PipelineCtx['sim'],
      chips: 0,
      mult: 1,
      total: 0,
      events: [],
      rng: mulberry32(0),
      combo: { id: 'test', tier: 0, baseChips: 0, baseMult: 0, scoringFaces },
    };
  }

  it('fires at exactly 4 scoring dice', () => {
    const ctx = makeMultCtx([1, 2, 3, 4]);
    expect(upgrades(ctx).mult).toBe(6); // 1 base + 5
  });

  it('fires at 5 scoring dice', () => {
    const ctx = makeMultCtx([1, 2, 3, 4, 5]);
    expect(upgrades(ctx).mult).toBe(6);
  });

  it('does not fire at 3 scoring dice', () => {
    const ctx = makeMultCtx([1, 2, 3]);
    expect(upgrades(ctx).mult).toBe(1);
  });

  it('does not fire when not owned', () => {
    const state = {
      run: { ...initialRunSlice(), catalysts: [] },
      round: { ...initialRoundSlice(), firstHandPlayed: true },
    } as unknown as GameState;
    const ctx: PipelineCtx = {
      state,
      sim: { finalFaces: [1, 2, 3, 4] } as unknown as PipelineCtx['sim'],
      chips: 0,
      mult: 1,
      total: 0,
      events: [],
      rng: mulberry32(0),
      combo: { id: 'test', tier: 0, baseChips: 0, baseMult: 0, scoringFaces: [1, 2, 3, 4] },
    };
    expect(upgrades(ctx).mult).toBe(1);
  });
});
