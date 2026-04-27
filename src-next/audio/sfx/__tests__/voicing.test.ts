import { describe, it, expect } from 'vitest';
import {
  PENTATONIC_CSM_HZ, MINOR_CSM_HZ,
  tierToNotes, jitterCents, jitterDb, jitterMs,
  pickPent, makeVolumeMemory,
} from '../voicing';

describe('voicing scales', () => {
  it('exposes 5 pentatonic notes per octave', () => {
    expect(PENTATONIC_CSM_HZ.length).toBe(20);
    for (let i = 1; i < 5; i++) {
      expect(PENTATONIC_CSM_HZ[i]!).toBeGreaterThan(PENTATONIC_CSM_HZ[i - 1]!);
    }
  });

  it('exposes 7 natural-minor notes per octave', () => {
    expect(MINOR_CSM_HZ.length).toBe(28);
  });

  it('C#4 ≈ 277.18 Hz appears in MINOR_CSM_HZ', () => {
    const found = MINOR_CSM_HZ.some((f) => Math.abs(f - 277.18) < 0.05);
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
  it('every returned note is in the pentatonic table', () => {
    for (let tier = 1; tier <= 8; tier++) {
      tierToNotes(tier).forEach((hz) => {
        const found = PENTATONIC_CSM_HZ.some((ref) => Math.abs(ref - hz) < 0.001);
        expect(found, `tier ${tier} hz=${hz} not in pentatonic table`).toBe(true);
      });
    }
  });
  it('higher tiers do not start lower than lower tiers', () => {
    // tier N starting note should be >= tier (N-2) starting note
    for (let t = 3; t <= 8; t++) {
      const cur = tierToNotes(t)[0]!;
      const prev = tierToNotes(t - 2)[0]!;
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });
  it('tier 8 produces strictly ascending notes', () => {
    const notes = tierToNotes(8);
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i]!).toBeGreaterThan(notes[i - 1]!);
    }
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
  it('keeps mean within tolerance of center', () => {
    const mem = makeVolumeMemory();
    const samples: number[] = [];
    for (let i = 0; i < 60; i++) samples.push(mem.next(-12, 1.5));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(Math.abs(mean - -12)).toBeLessThan(0.6);
  });

  it('most consecutive draws differ by more than 0.4 dB', () => {
    // Note: the 4-attempt fallback can yield close pairs; require >90% to satisfy bias.
    const mem = makeVolumeMemory();
    const samples: number[] = [];
    for (let i = 0; i < 200; i++) samples.push(mem.next(-12, 1.5));
    let satisfied = 0;
    for (let i = 1; i < samples.length; i++) {
      if (Math.abs(samples[i]! - samples[i - 1]!) > 0.4) satisfied++;
    }
    const rate = satisfied / (samples.length - 1);
    expect(rate).toBeGreaterThan(0.9);
  });
});
