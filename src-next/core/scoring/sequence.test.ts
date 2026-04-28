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
});
