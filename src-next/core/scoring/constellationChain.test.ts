import { describe, it, expect } from 'vitest';
import { applyChain, chainBreakRefund } from './constellationChain';

describe('applyChain', () => {
  it('starts chain at len 1, mult 1', () => {
    const r = applyChain(3, 0, -1);
    expect(r.chainLen).toBe(1);
    expect(r.chainTier).toBe(3);
    expect(r.chainMult).toBe(1);
    expect(r.broke).toBe(false);
  });

  it('extends on equal-or-higher tier', () => {
    const r1 = applyChain(3, 1, 3);
    expect(r1.chainLen).toBe(2);
    expect(r1.chainMult).toBe(1.25);

    const r2 = applyChain(5, 2, 3);
    expect(r2.chainLen).toBe(3);
    expect(r2.chainTier).toBe(5);
    expect(r2.chainMult).toBe(1.5);
  });

  it('breaks on lower tier', () => {
    const r = applyChain(2, 3, 5);
    expect(r.chainLen).toBe(0);
    expect(r.broke).toBe(true);
  });

  it('caps at 8', () => {
    const r = applyChain(8, 8, 8);
    expect(r.chainLen).toBe(8);
    expect(r.chainMult).toBe(1 + 0.25 * 7);
  });
});

describe('chainBreakRefund', () => {
  it('returns 2x prev len', () => {
    expect(chainBreakRefund(3)).toBe(6);
    expect(chainBreakRefund(0)).toBe(0);
    expect(chainBreakRefund(-2)).toBe(0);
  });
});
