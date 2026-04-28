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
  isLastHand: false,
  maxRemaining: 100,
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
    // short tier: cast-swell + 5 die-ticks + boom = 7 beats
    expect(seq.beats).toHaveLength(7);
    expect(seq.beats[0]?.kind).toBe('cast-swell');
    expect(seq.beats[6]?.kind).toBe('boom');
    for (let i = 1; i <= 5; i++) {
      expect(seq.beats[i]?.kind).toBe('die-tick');
    }
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
    expect(kinds).not.toContain('hold-breath');
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
});
