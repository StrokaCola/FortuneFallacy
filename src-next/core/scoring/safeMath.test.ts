import { describe, it, expect } from 'vitest';
import { safeMul, safeRound, SAFE_SCORE_CEILING } from './safeMath';

describe('safeMath', () => {
  it('safeMul behaves like a*b for normal values', () => {
    expect(safeMul(2, 3)).toBe(6);
    expect(safeMul(1.5, 4)).toBe(6);
    expect(safeMul(0, 1e10)).toBe(0);
    expect(safeMul(100_000, 200_000)).toBe(20_000_000_000);
  });

  it('safeMul clamps at SAFE_SCORE_CEILING for huge products', () => {
    expect(safeMul(1e10, 1e10)).toBe(SAFE_SCORE_CEILING);
    expect(safeMul(SAFE_SCORE_CEILING, 2)).toBe(SAFE_SCORE_CEILING);
  });

  it('safeMul collapses NaN inputs to 0', () => {
    expect(safeMul(NaN, 5)).toBe(0);
    expect(safeMul(5, NaN)).toBe(0);
  });

  it('safeMul clamps Infinity inputs to ±ceiling preserving sign', () => {
    expect(safeMul(Infinity, 5)).toBe(SAFE_SCORE_CEILING);
    expect(safeMul(5, -Infinity)).toBe(-SAFE_SCORE_CEILING);
    expect(safeMul(-Infinity, -Infinity)).toBe(SAFE_SCORE_CEILING);
  });

  it('safeMul handles a finite × finite product that overflows to Infinity', () => {
    // Number.MAX_VALUE * 2 produces Infinity in IEEE 754. We expect the
    // clamp to catch that and return the ceiling rather than propagate.
    expect(safeMul(Number.MAX_VALUE, 2)).toBe(SAFE_SCORE_CEILING);
  });

  it('safeRound rounds finite values and zeros out NaN/Infinity', () => {
    expect(safeRound(3.4)).toBe(3);
    expect(safeRound(3.5)).toBe(4);
    expect(safeRound(NaN)).toBe(0);
    expect(safeRound(Infinity)).toBe(SAFE_SCORE_CEILING);
    expect(safeRound(-Infinity)).toBe(-SAFE_SCORE_CEILING);
  });

  it('full-pipeline simulation: chips × mult × chainMult never produces Infinity at extreme end', () => {
    // Worst-case adversarial inputs: pretend a stacked-late-game catalyst
    // pile pushed chips and mult into the trillions, with chain mult at the
    // theoretical cap (1 + 0.25 × 7 = 2.75). Without safeMul the second
    // multiply would overflow precision. With safeMul, it clamps cleanly.
    const chips = 9e12;
    const mult = 2e6;
    const chainMult = 2.75;
    const base = safeMul(chips, mult);
    const total = safeRound(safeMul(base, chainMult));
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeLessThanOrEqual(SAFE_SCORE_CEILING);
    expect(total).toBeGreaterThan(0);
  });
});
