import { describe, it, expect } from 'vitest';
import { buildScoreSequence } from './sequence';
import type { SequenceInput, SequenceCtx } from './types';

const baseInput = (overrides: Partial<SequenceInput> = {}): SequenceInput => ({
  faces: [1, 1, 2, 2, 3],
  comboLabel: 'TWO_PAIR',
  comboBonus: 10,
  mults: [{ label: 'mult', value: 2 }, { label: 'chain', value: 1 }],
  finalTotal: 18,
  ...overrides,
});

const baseCtx = (overrides: Partial<SequenceCtx> = {}): SequenceCtx => ({
  target: 100,
  bail: false,
  reducedMotion: false,
  ...overrides,
});

describe('buildScoreSequence — tier selection', () => {
  it('emits short tier when finalTotal/target < 0.25', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 18 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('short');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds[0]).toBe('cast-swell');
    expect(kinds.filter((k) => k === 'die-tick')).toHaveLength(5);
    expect(kinds).toContain('combo-bonus');
    expect(kinds).toContain('hold-breath');
    expect(kinds[kinds.length - 1]).toBe('boom');
  });

  it('emits mid tier when 0.25 <= ratio < 1.0', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 50, comboBonus: 10, mults: [{ label: 'mult', value: 2 }, { label: 'chain', value: 1 }] }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('mid');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).toContain('combo-bonus');
    expect(kinds.filter((k) => k === 'mult-slam')).toHaveLength(2);
    expect(kinds).toContain('hold-breath');
    expect(kinds[kinds.length - 1]).toBe('boom');
  });

  it('emits full tier with hold-breath when ratio >= 1.0', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 200, comboBonus: 25, mults: [{ label: 'mult', value: 3 }, { label: 'chain', value: 2 }] }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('full');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).toContain('hold-breath');
    expect(kinds).toContain('cross-target');
    // hold-breath sits between last mult-slam (or cross-target) and boom
    const breathIdx = kinds.indexOf('hold-breath');
    const boomIdx = kinds.indexOf('boom');
    expect(breathIdx).toBeLessThan(boomIdx);
  });

  it('emits cross-target on the FIRST beat that crosses target, never twice', () => {
    const seq = buildScoreSequence(
      baseInput({
        faces: [10, 10, 10, 10, 10],         // running after dice = 50
        comboBonus: 60,                      // running after combo = 110, crosses target=100
        mults: [{ label: 'mult', value: 3 }],
        finalTotal: 330,
      }),
      baseCtx({ target: 100 }),
    );
    const crossings = seq.beats.filter((b) => b.kind === 'cross-target');
    expect(crossings).toHaveLength(1);
    // beat just BEFORE cross-target should be combo-bonus (the one that crossed)
    const idx = seq.beats.findIndex((b) => b.kind === 'cross-target');
    expect(seq.beats[idx - 1]?.kind).toBe('combo-bonus');
  });

  it('emits bail beat when ctx.bail is true', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [1, 1, 1, 1, 1], comboBonus: 0, mults: [], finalTotal: 5 }),
      baseCtx({ target: 100, bail: true }),
    );
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).toContain('bail');
    expect(kinds).not.toContain('boom');
    // bail terminates sequence
    expect(kinds[kinds.length - 1]).toBe('bail');
  });

  it('does NOT bail when ctx.bail is false', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 5 }),
      baseCtx({ target: 100, bail: false }),
    );
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).not.toContain('bail');
  });

  it('does not bail on a clutch clear (last hand, finalTotal alone < target, but engine cleared)', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 250 }),
      baseCtx({ target: 1000, bail: false }),
    );
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).not.toContain('bail');
    expect(kinds[kinds.length - 1]).toBe('boom');
  });

  it('reduced motion collapses all tiers to short', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 5000 }),  // would be full normally
      baseCtx({ target: 100, reducedMotion: true }),
    );
    expect(seq.tier).toBe('short');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).not.toContain('mult-slam');
    expect(kinds).not.toContain('hold-breath');
  });

  it('emits cross-target via mult-slam when dice + combo do not yet cross', () => {
    // dice sum = 15, +combo 10 = 25, ×3 mult = 75, ×2 chain = 150 — crosses at chain mult
    const seq = buildScoreSequence(
      baseInput({
        faces: [3, 3, 3, 3, 3],
        comboBonus: 10,
        mults: [{ label: 'mult', value: 3 }, { label: 'chain', value: 2 }],
        finalTotal: 150,
      }),
      baseCtx({ target: 100 }),
    );
    const idx = seq.beats.findIndex((b) => b.kind === 'cross-target');
    expect(idx).toBeGreaterThan(-1);
    expect(seq.beats[idx - 1]?.kind).toBe('mult-slam');
    expect(seq.beats.filter((b) => b.kind === 'cross-target')).toHaveLength(1);
  });

  it('full tier with empty mults still emits hold-breath and boom', () => {
    const seq = buildScoreSequence(
      baseInput({
        faces: [20, 20, 20, 20, 20],   // dice alone = 100, crosses target
        comboBonus: 50,                 // running = 150
        mults: [],
        finalTotal: 150,
      }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('full');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).toContain('hold-breath');
    expect(kinds[kinds.length - 1]).toBe('boom');
    expect(kinds.filter((k) => k === 'mult-slam')).toHaveLength(0);
  });

  it('short tier boom.crossedTarget is always false (target unreachable by construction)', () => {
    // Short tier requires ratio < 0.25, so finalTotal < target/4.
    // Dice sum <= finalTotal < target — dice can never cross target in short tier.
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 18 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('short');
    const boom = seq.beats.find((b) => b.kind === 'boom');
    expect(boom?.kind).toBe('boom');
    if (boom?.kind === 'boom') expect(boom.crossedTarget).toBe(false);
  });

  it('emits combo-bonus beat on every non-reduced-motion tier including Chance hand', () => {
    for (const total of [18, 50, 200]) {
      const seq = buildScoreSequence(
        baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: total }),
        baseCtx({ target: 100 }),
      );
      expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(true);
    }
  });

  it('emits hold-breath before boom on every non-reduced-motion tier', () => {
    for (const total of [18, 50, 200]) {
      const seq = buildScoreSequence(
        baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: total }),
        baseCtx({ target: 100 }),
      );
      const breathIdx = seq.beats.findIndex((b) => b.kind === 'hold-breath');
      const boomIdx = seq.beats.findIndex((b) => b.kind === 'boom');
      expect(breathIdx).toBeGreaterThanOrEqual(0);
      expect(breathIdx).toBeLessThan(boomIdx);
    }
  });

  it('short tier total duration is at least 2000ms for typical 5-die no-mult hand', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 18 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('short');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(2000);
  });

  it('short tier total duration is at most 5000ms (sanity ceiling)', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 18 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('short');
    expect(seq.totalDurMs).toBeLessThan(5000);
  });

  it('mid tier total duration is at least 3000ms', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'TWO_PAIR', comboBonus: 20, mults: [], finalTotal: 50 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('mid');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(3000);
  });

  it('mid tier total duration is at most 6000ms (sanity ceiling)', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'TWO_PAIR', comboBonus: 20, mults: [], finalTotal: 50 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('mid');
    expect(seq.totalDurMs).toBeLessThan(6000);
  });

  it('full tier total duration is at least 3500ms', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'FULL_HOUSE', comboBonus: 35, mults: [{ label: 'mult', value: 2 }], finalTotal: 200 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('full');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(3500);
  });

  it('full tier total duration is at most 8000ms (sanity ceiling)', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'FULL_HOUSE', comboBonus: 35, mults: [{ label: 'mult', value: 2 }], finalTotal: 200 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('full');
    expect(seq.totalDurMs).toBeLessThan(8000);
  });

  it('reduced-motion path emits no combo-bonus and no hold-breath', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 18 }),
      baseCtx({ target: 100, reducedMotion: true }),
    );
    expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'hold-breath')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'boom')).toBe(true);
  });

  it('bail path emits no combo-bonus and no hold-breath (unchanged behavior)', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [1,1,1,1,1], comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 5 }),
      baseCtx({ target: 100, bail: true }),
    );
    expect(seq.beats[0]?.kind).toBe('cast-swell');
    expect(seq.beats.some((b) => b.kind === 'die-tick')).toBe(true);
    expect(seq.beats[seq.beats.length - 1]?.kind).toBe('bail');
    expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'hold-breath')).toBe(false);
  });

  it('die-tick beats use dieIndices from input (not the held-array slot)', () => {
    // Held dice indices [3, 4] with faces [6, 2]. Beats must target the
    // physical dice (3 and 4), not the held-array slots (0 and 1).
    const seq = buildScoreSequence(
      baseInput({ faces: [6, 2], dieIndices: [3, 4], comboBonus: 0, mults: [], finalTotal: 8 }),
      baseCtx({ target: 100 }),
    );
    const ticks = seq.beats.filter((b) => b.kind === 'die-tick');
    expect(ticks.map((b) => (b.kind === 'die-tick' ? b.dieIdx : -1))).toEqual([3, 4]);
  });

  it('die-tick beats fall back to slot index when dieIndices absent (legacy callers)', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [1, 2, 3], dieIndices: undefined, comboBonus: 0, mults: [], finalTotal: 6 }),
      baseCtx({ target: 100 }),
    );
    const ticks = seq.beats.filter((b) => b.kind === 'die-tick');
    expect(ticks.map((b) => (b.kind === 'die-tick' ? b.dieIdx : -1))).toEqual([0, 1, 2]);
  });

  it('reduced-motion die-ticks also use dieIndices', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [6, 2], dieIndices: [3, 4], comboBonus: 0, mults: [], finalTotal: 8 }),
      baseCtx({ target: 100, reducedMotion: true }),
    );
    const ticks = seq.beats.filter((b) => b.kind === 'die-tick');
    expect(ticks.map((b) => (b.kind === 'die-tick' ? b.dieIdx : -1))).toEqual([3, 4]);
  });

  it('bail die-ticks also use dieIndices', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [6, 2], dieIndices: [3, 4], comboBonus: 0, mults: [], finalTotal: 8 }),
      baseCtx({ target: 100, bail: true }),
    );
    const ticks = seq.beats.filter((b) => b.kind === 'die-tick');
    expect(ticks.map((b) => (b.kind === 'die-tick' ? b.dieIdx : -1))).toEqual([3, 4]);
  });
});
