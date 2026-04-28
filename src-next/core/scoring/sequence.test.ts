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
});
