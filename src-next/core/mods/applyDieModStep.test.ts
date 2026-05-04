import { describe, it, expect } from 'vitest';
import { applyDieModStep } from './applyDieModStep';

function ctx(over: Partial<Parameters<typeof applyDieModStep>[0]> = {}) {
  return {
    face: 6,
    dieIdx: 0,
    pos: 0,
    totalScoring: 1,
    scoringFaces: [6],
    titheBudget: 0,
    ...over,
  };
}

describe('applyDieModStep — existing mods (regression)', () => {
  it('amplify adds +2 chips', () => {
    const r = applyDieModStep(ctx({ face: 3, scoringFaces: [3] }), ['amplify']);
    expect(r.dChips).toBe(2);
    expect(r.dMult).toBe(0);
  });

  it('sharpened adds +1 mult', () => {
    const r = applyDieModStep(ctx(), ['sharpened']);
    expect(r.dMult).toBe(1);
  });

  it('chainMult (Conduit) scales with pos', () => {
    const r = applyDieModStep(ctx({ pos: 3, totalScoring: 5 }), ['conduit']);
    expect(r.dMult).toBe(3);
  });
});

describe('applyDieModStep — new mods', () => {
  it('crescendo: +1 mult per die scored AFTER this one', () => {
    const r = applyDieModStep(ctx({ pos: 0, totalScoring: 5 }), ['crescendo']);
    expect(r.dMult).toBe(4);
  });

  it('crescendo: 0 when last die', () => {
    const r = applyDieModStep(ctx({ pos: 4, totalScoring: 5 }), ['crescendo']);
    expect(r.dMult).toBe(0);
  });

  it('crown: ×1.5 dMultMul when face is 6', () => {
    const r = applyDieModStep(ctx({ face: 6 }), ['crown']);
    expect(r.dMultMul).toBeCloseTo(1.5);
  });

  it('crown: no effect when face != 6', () => {
    const r = applyDieModStep(ctx({ face: 3, scoringFaces: [3] }), ['crown']);
    expect(r.dMultMul).toBe(1);
  });

  it('tithe: consumes 1 from budget, adds chips/mult', () => {
    const r = applyDieModStep(ctx({ titheBudget: 5 }), ['tithe']);
    expect(r.titheCost).toBe(1);
    expect(r.dChips).toBe(5);
    expect(r.dMult).toBe(2);
  });

  it('tithe: skips when budget = 0', () => {
    const r = applyDieModStep(ctx({ titheBudget: 0 }), ['tithe']);
    expect(r.titheCost).toBe(0);
    expect(r.dChips).toBe(0);
    expect(r.dMult).toBe(0);
  });

  it('resonance: doubles the OTHER mod chips/mult', () => {
    // Sharpened normally +1 mult; with Resonance: +2 mult.
    const r = applyDieModStep(ctx(), ['sharpened', 'resonance']);
    expect(r.dMult).toBe(2);
  });

  it('resonance + amplify: chips doubled', () => {
    const r = applyDieModStep(ctx({ face: 3, scoringFaces: [3] }), ['amplify', 'resonance']);
    expect(r.dChips).toBe(4);
  });

  it('resonance alone contributes nothing', () => {
    const r = applyDieModStep(ctx(), ['resonance']);
    expect(r.dChips).toBe(0);
    expect(r.dMult).toBe(0);
  });
});
