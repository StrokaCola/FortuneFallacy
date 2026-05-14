import { describe, it, expect } from 'vitest';
import { makeSeedRng, seededInt, seededPick, encodeSeed, decodeSeed } from './rng';

describe('makeSeedRng', () => {
  it('produces the same sequence for the same (seed, scope)', () => {
    const a = makeSeedRng(12345, 'boss:ante1');
    const b = makeSeedRng(12345, 'boss:ante1');
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different scopes on the same seed', () => {
    const a = makeSeedRng(12345, 'boss:ante1');
    const b = makeSeedRng(12345, 'boss:ante2');
    expect(a()).not.toBe(b());
  });

  it('produces different sequences for different seeds in the same scope', () => {
    const a = makeSeedRng(12345, 'shop:0');
    const b = makeSeedRng(12346, 'shop:0');
    expect(a()).not.toBe(b());
  });

  it('returns floats in [0, 1)', () => {
    const rng = makeSeedRng(42, 'test');
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('seededInt', () => {
  it('returns ints in [0, max)', () => {
    const rng = makeSeedRng(99, 'x');
    for (let i = 0; i < 100; i++) {
      const v = seededInt(rng, 10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });
});

describe('seededPick', () => {
  it('picks the same element from the same (seed, scope)', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const a = makeSeedRng(7, 'pick');
    const b = makeSeedRng(7, 'pick');
    expect(seededPick(a, arr)).toBe(seededPick(b, arr));
  });
});

describe('encodeSeed / decodeSeed', () => {
  it('roundtrips a sample of seeds losslessly', () => {
    for (const n of [0, 1, 42, 12345, 0x7FFFFFFF, 0xFFFFFFFF]) {
      const encoded = encodeSeed(n);
      expect(decodeSeed(encoded)).toBe(n);
    }
  });

  it('formats as 4-char + dash + 3-char', () => {
    expect(encodeSeed(0)).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{3}$/);
    expect(encodeSeed(0xFFFFFFFF)).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{3}$/);
  });

  it('avoids confusable chars (I, L, O, U) in encoded output', () => {
    // Sample broadly. Crockford base32 alphabet excludes these by design.
    for (let n = 0; n < 0xFFFFFFFF; n += 0x01234567) {
      expect(encodeSeed(n)).not.toMatch(/[ILOU]/);
    }
  });

  it('decodes confusable typos back to the original (I→1, L→1, O→0, U→V)', () => {
    const original = encodeSeed(12345);
    const typo = original
      .replace(/1/g, 'I')
      .replace(/0/g, 'O');
    expect(decodeSeed(typo)).toBe(12345);
  });

  it('decodes case-insensitively and tolerates the dash', () => {
    const seed = 9876;
    const upper = encodeSeed(seed);
    const lower = upper.toLowerCase();
    const nodash = upper.replace('-', '');
    expect(decodeSeed(lower)).toBe(seed);
    expect(decodeSeed(nodash)).toBe(seed);
  });

  it('returns null for malformed inputs', () => {
    expect(decodeSeed('')).toBeNull();
    expect(decodeSeed('VEGA')).toBeNull();         // too short
    expect(decodeSeed('VEGA7K3F')).toBeNull();     // too long
    expect(decodeSeed('VEGA-???')).toBeNull();     // illegal chars
  });
});
