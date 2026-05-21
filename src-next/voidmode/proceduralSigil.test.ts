import { describe, it, expect } from 'vitest';
import { generateProceduralSigil, proceduralSigilSeed } from './proceduralSigil';

describe('generateProceduralSigil', () => {
  it('returns a valid path string starting with M and ending with Z', () => {
    const s = generateProceduralSigil(42);
    expect(s.pathD.startsWith('M ')).toBe(true);
    expect(s.pathD.endsWith('Z')).toBe(true);
  });

  it('is deterministic — same seed produces same path', () => {
    const a = generateProceduralSigil(7);
    const b = generateProceduralSigil(7);
    expect(a.pathD).toBe(b.pathD);
    expect(a.radius).toBe(b.radius);
  });

  it('produces visually distinct paths for different seeds', () => {
    const a = generateProceduralSigil(1);
    const b = generateProceduralSigil(2);
    expect(a.pathD).not.toBe(b.pathD);
  });

  it('radius falls within a reasonable bounding range', () => {
    for (let s = 0; s < 50; s++) {
      const sig = generateProceduralSigil(s);
      expect(sig.radius).toBeGreaterThan(35);
      expect(sig.radius).toBeLessThan(60);
    }
  });

  it('contains the expected number of cubic curves (one per sample point)', () => {
    const s = generateProceduralSigil(11);
    const curveCount = (s.pathD.match(/C /g) ?? []).length;
    // 5..9 lobes × 2 sample points each = 10..18 cubic curves
    expect(curveCount).toBeGreaterThanOrEqual(10);
    expect(curveCount).toBeLessThanOrEqual(18);
  });
});

describe('proceduralSigilSeed', () => {
  it('is deterministic for the same inputs', () => {
    expect(proceduralSigilSeed(100, 'pluto', 3)).toBe(proceduralSigilSeed(100, 'pluto', 3));
  });

  it('produces different seeds for different bosses', () => {
    const a = proceduralSigilSeed(100, 'pluto', 3);
    const b = proceduralSigilSeed(100, 'callisto', 3);
    expect(a).not.toBe(b);
  });

  it('produces different seeds for different antes', () => {
    const a = proceduralSigilSeed(100, 'pluto', 1);
    const b = proceduralSigilSeed(100, 'pluto', 3);
    expect(a).not.toBe(b);
  });

  it('produces different seeds for different void seeds', () => {
    const a = proceduralSigilSeed(100, 'pluto', 3);
    const b = proceduralSigilSeed(200, 'pluto', 3);
    expect(a).not.toBe(b);
  });
});
