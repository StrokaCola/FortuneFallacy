import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng';

describe('mulberry32 — determinism', () => {
  it('same seed produces identical sequences', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds produce different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('seed 0 and seed 1 differ', () => {
    expect(mulberry32(0).next()).not.toBe(mulberry32(1).next());
  });
});

describe('mulberry32.next() — output range', () => {
  it('values are in [0, 1)', () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('mulberry32.int(lo, hi)', () => {
  it('returns integers within [lo, hi] inclusive', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 500; i++) {
      const v = rng.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('returns lo when lo === hi', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 20; i++) {
      expect(rng.int(5, 5)).toBe(5);
    }
  });

  it('covers the full range over many draws', () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.int(1, 6));
    expect(seen.size).toBe(6);
  });
});

describe('mulberry32.pick(arr)', () => {
  it('returns an element from the array', () => {
    const rng = mulberry32(1);
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('covers all elements over enough draws', () => {
    const rng = mulberry32(2);
    const arr = [10, 20, 30, 40] as const;
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.pick(arr));
    expect(seen.size).toBe(arr.length);
  });
});

describe('mulberry32 seed property', () => {
  it('exposes the original seed', () => {
    const rng = mulberry32(0xABCD1234);
    expect(rng.seed).toBe(0xABCD1234);
  });

  it('seed is unchanged after many next() calls', () => {
    const rng = mulberry32(77);
    for (let i = 0; i < 100; i++) rng.next();
    expect(rng.seed).toBe(77);
  });
});
