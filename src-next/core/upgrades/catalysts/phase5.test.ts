import { describe, it, expect } from 'vitest';
import './straightSignal';
import './tetrad';
import './apex';
import './chanceDoctrine';
import './lowChoir';
import './harmonic';
import './metronome';
import './primeResonance';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

type CtxOpts = {
  faces?: number[];
  scoringOrder?: number[];
  chips?: number;
  mult?: number;
  combo?: { id: string; tier: number; baseChips: number; baseMult: number; scoringFaces: number[] };
  diceMods?: string[][];
  handsPlayed?: number;
};

function makeCtx(opts: CtxOpts = {}): PipelineCtx {
  const faces = opts.faces ?? [];
  const state = {
    run: {
      diceMods: opts.diceMods ?? [],
      handsPlayed: opts.handsPlayed ?? 0,
    },
    round: {
      scoringOrder: opts.scoringOrder ?? faces.map((_, i) => i),
    },
  } as unknown as GameState;
  return {
    state,
    sim: { finalFaces: faces } as unknown as PipelineCtx['sim'],
    chips: opts.chips ?? 0,
    mult: opts.mult ?? 1,
    total: 0,
    events: [],
    rng: mulberry32(0),
    combo: opts.combo,
  };
}

const findCat = (id: string) => getAll().find((u) => u.id === id)!;

describe('straight_signal (Hand contains a Small Straight → +6 mult)', () => {
  it('adds +6 mult on sm_straight', () => {
    const ctx = makeCtx({ combo: { id: 'sm_straight', tier: 4, baseChips: 30, baseMult: 5, scoringFaces: [] }, mult: 5 });
    expect(findCat('straight_signal').apply(ctx).mult).toBe(11);
  });
  // 2026-05-16 — "contains" semantics. Large Straight is 5 consecutive
  // values, which always contains a 4-consecutive small straight as a
  // substructure. So the catalyst now fires on lg_straight too.
  it('also fires on Large Straight (contains sm_straight)', () => {
    const ctx = makeCtx({ combo: { id: 'lg_straight', tier: 6, baseChips: 40, baseMult: 7, scoringFaces: [] }, mult: 5 });
    expect(findCat('straight_signal').apply(ctx).mult).toBe(11); // 5 + 6
  });
  it('no-op on non-straight combos', () => {
    const ctx = makeCtx({ combo: { id: 'three_kind', tier: 3, baseChips: 30, baseMult: 5, scoringFaces: [] }, mult: 5 });
    expect(findCat('straight_signal').apply(ctx).mult).toBe(5);
  });
});

describe('tetrad (Four of a Kind → chips ×3)', () => {
  it('triples chips on four_kind', () => {
    const ctx = makeCtx({ combo: { id: 'four_kind', tier: 7, baseChips: 60, baseMult: 12, scoringFaces: [] }, chips: 100 });
    expect(findCat('tetrad').apply(ctx).chips).toBe(300);
  });
  it('no-op on three_kind', () => {
    const ctx = makeCtx({ combo: { id: 'three_kind', tier: 3, baseChips: 30, baseMult: 5, scoringFaces: [] }, chips: 100 });
    expect(findCat('tetrad').apply(ctx).chips).toBe(100);
  });
});

describe('apex (Five of a Kind → mult ×3 + 1 per matching face)', () => {
  it('triples mult and adds matching-face count on five_kind of 6s', () => {
    // Five 6s: matchingFace=6, matchingCount=5. mult=4 → 4*3+5 = 17.
    const ctx = makeCtx({
      combo: { id: 'five_kind', tier: 8, baseChips: 100, baseMult: 20, scoringFaces: [6, 6, 6, 6, 6] },
      mult: 4,
    });
    expect(findCat('apex').apply(ctx).mult).toBe(17);
  });
  it('no-op on four_kind', () => {
    const ctx = makeCtx({ combo: { id: 'four_kind', tier: 7, baseChips: 60, baseMult: 12, scoringFaces: [] }, mult: 4 });
    expect(findCat('apex').apply(ctx).mult).toBe(4);
  });
});

describe('chance_doctrine (Chance → +20c +4m per scoring die)', () => {
  it('5 scoring dice: +100 chips, +20 mult', () => {
    const ctx = makeCtx({
      combo: { id: 'chance', tier: 0, baseChips: 0, baseMult: 1, scoringFaces: [1, 2, 4, 5, 6] },
      chips: 50, mult: 4,
    });
    const out = findCat('chance_doctrine').apply(ctx);
    expect(out.chips).toBe(150);
    expect(out.mult).toBe(24);
  });
  it('no-op on Pair', () => {
    const ctx = makeCtx({ combo: { id: 'one_pair', tier: 1, baseChips: 10, baseMult: 2, scoringFaces: [3, 3] }, chips: 50, mult: 4 });
    const out = findCat('chance_doctrine').apply(ctx);
    expect(out.chips).toBe(50);
    expect(out.mult).toBe(4);
  });
  it('no-op on empty scoring set', () => {
    const ctx = makeCtx({ combo: { id: 'chance', tier: 0, baseChips: 0, baseMult: 1, scoringFaces: [] }, chips: 50, mult: 4 });
    expect(findCat('chance_doctrine').apply(ctx).chips).toBe(50);
  });
});

describe('low_choir (each scoring face ≤2 → +3 mult)', () => {
  it('counts only low faces in scoring set', () => {
    const ctx = makeCtx({ faces: [1, 2, 3, 4, 5], scoringOrder: [0, 1, 2], mult: 4 });
    // 1 and 2 are ≤2, 3 is not. 2 lows × 3 = +6 mult.
    expect(findCat('low_choir').apply(ctx).mult).toBe(10);
  });
  it('no-op when no low faces', () => {
    const ctx = makeCtx({ faces: [3, 4, 5, 6], scoringOrder: [0, 1, 2, 3], mult: 4 });
    expect(findCat('low_choir').apply(ctx).mult).toBe(4);
  });
});

describe('harmonic (repeated-mod stack bonus)', () => {
  it('two dice with the same mod → 1 repeat → +25 chips, ×1.25 mult', () => {
    const ctx = makeCtx({
      diceMods: [['amplify'], ['amplify'], [], [], []],
      chips: 100, mult: 4,
    });
    const out = findCat('harmonic').apply(ctx);
    expect(out.chips).toBe(125);
    expect(out.mult).toBe(5); // 4 * 1.25
  });
  it('two distinct mods each on 2 dice → 2 repeats → +50 chips, ×1.5 mult', () => {
    const ctx = makeCtx({
      diceMods: [['amplify', 'sharpened'], ['amplify', 'sharpened'], [], [], []],
      chips: 100, mult: 4,
    });
    const out = findCat('harmonic').apply(ctx);
    expect(out.chips).toBe(150);
    expect(out.mult).toBe(6); // 4 * 1.5
  });
  it('no-op when no mod is repeated', () => {
    const ctx = makeCtx({
      diceMods: [['amplify'], ['sharpened'], ['gilded'], [], []],
      chips: 100, mult: 4,
    });
    const out = findCat('harmonic').apply(ctx);
    expect(out.chips).toBe(100);
    expect(out.mult).toBe(4);
  });
  it('same mod twice on the SAME die counts only once for that die', () => {
    const ctx = makeCtx({
      diceMods: [['amplify', 'amplify'], [], [], [], []],
      chips: 100, mult: 4,
    });
    expect(findCat('harmonic').apply(ctx).chips).toBe(100);
  });
});

describe('metronome (alternating odd/even hand)', () => {
  it('hand 1 (odd) → chips ×1.5', () => {
    // handsPlayed=0 → handNumber=1 (odd).
    const ctx = makeCtx({ handsPlayed: 0, chips: 100, mult: 4 });
    const out = findCat('metronome').apply(ctx);
    expect(out.chips).toBe(150);
    expect(out.mult).toBe(4);
  });
  it('hand 2 (even) → mult ×1.5', () => {
    const ctx = makeCtx({ handsPlayed: 1, chips: 100, mult: 4 });
    const out = findCat('metronome').apply(ctx);
    expect(out.chips).toBe(100);
    expect(out.mult).toBe(6);
  });
});

describe('prime_resonance (mult^(1.05^scoringDice))', () => {
  it('5 scoring dice: mult^1.276... → roughly 6.5 from base 4', () => {
    const ctx = makeCtx({
      combo: { id: 'one_pair', tier: 1, baseChips: 10, baseMult: 2, scoringFaces: [3, 3, 1, 4, 5] },
      mult: 4,
    });
    const out = findCat('prime_resonance').apply(ctx);
    // 4^(1.05^5) = 4^1.276 ≈ 5.94.
    expect(out.mult).toBeGreaterThan(5);
    expect(out.mult).toBeLessThan(7);
  });
  it('no-op when mult <= 1', () => {
    const ctx = makeCtx({
      combo: { id: 'chance', tier: 0, baseChips: 0, baseMult: 1, scoringFaces: [1, 2, 3] },
      mult: 1,
    });
    expect(findCat('prime_resonance').apply(ctx).mult).toBe(1);
  });
  it('no-op when no scoring dice', () => {
    const ctx = makeCtx({
      combo: { id: 'chance', tier: 0, baseChips: 0, baseMult: 1, scoringFaces: [] },
      mult: 4,
    });
    expect(findCat('prime_resonance').apply(ctx).mult).toBe(4);
  });
});
