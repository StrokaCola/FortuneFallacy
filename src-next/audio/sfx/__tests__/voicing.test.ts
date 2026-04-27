import { describe, it, expect } from 'vitest';
import {
  PENTATONIC_CSM_HZ, MINOR_CSM_HZ,
  tierToNotes, jitterCents, jitterDb, jitterMs,
  pickPent, makeVolumeMemory,
} from '../voicing';

describe('voicing scales', () => {
  it('exposes 5 pentatonic notes per octave', () => {
    expect(PENTATONIC_CSM_HZ.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < 5; i++) {
      expect(PENTATONIC_CSM_HZ[i]!).toBeGreaterThan(PENTATONIC_CSM_HZ[i - 1]!);
    }
  });

  it('exposes 7 natural-minor notes per octave', () => {
    expect(MINOR_CSM_HZ.length).toBeGreaterThanOrEqual(7);
  });

  it('C#4 ≈ 277.18 Hz appears in MINOR_CSM_HZ', () => {
    const found = MINOR_CSM_HZ.some((f) => Math.abs(f - 277.18) < 1);
    expect(found).toBe(true);
  });
});

describe('tierToNotes', () => {
  it('tier 1 returns a single note', () => {
    expect(tierToNotes(1)).toHaveLength(1);
  });
  it('tier 4 returns 2 notes', () => {
    expect(tierToNotes(4)).toHaveLength(2);
  });
  it('tier 6 returns 3 notes', () => {
    expect(tierToNotes(6)).toHaveLength(3);
  });
  it('tier 8 returns 5 notes', () => {
    expect(tierToNotes(8)).toHaveLength(5);
  });
  it('clamps to [1,8]', () => {
    expect(tierToNotes(-3)).toHaveLength(1);
    expect(tierToNotes(99)).toHaveLength(5);
  });
  it('every returned note is a positive number (Hz)', () => {
    tierToNotes(8).forEach((n) => expect(n).toBeGreaterThan(0));
  });
});

describe('jitter helpers', () => {
  it('jitterCents stays within ±25', () => {
    for (let i = 0; i < 200; i++) {
      const c = jitterCents();
      expect(c).toBeGreaterThanOrEqual(-25);
      expect(c).toBeLessThanOrEqual(25);
    }
  });
  it('jitterDb stays within ±1.5', () => {
    for (let i = 0; i < 200; i++) {
      const d = jitterDb();
      expect(d).toBeGreaterThanOrEqual(-1.5);
      expect(d).toBeLessThanOrEqual(1.5);
    }
  });
  it('jitterMs stays within [0, 12]', () => {
    for (let i = 0; i < 200; i++) {
      const m = jitterMs();
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(12);
    }
  });
});

describe('pickPent', () => {
  it('idx 0 returns root', () => {
    expect(pickPent(0)).toBe(PENTATONIC_CSM_HZ[0]);
  });
  it('idx wraps with octave climb', () => {
    expect(pickPent(5)).toBeGreaterThan(PENTATONIC_CSM_HZ[4]!);
  });
});

describe('volumeMemory', () => {
  it('biases away from recently used volumes', () => {
    const mem = makeVolumeMemory();
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) samples.push(mem.next(-12, 1.5));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(Math.abs(mean - -12)).toBeLessThan(0.6);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).not.toBe(samples[i - 1]);
    }
  });
});
