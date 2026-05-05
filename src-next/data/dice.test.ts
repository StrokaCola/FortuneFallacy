import { describe, it, expect } from 'vitest';
import { spatialIdxForValue } from './dice';

describe('spatialIdxForValue', () => {
  it('returns the value for a canonical [1..6] d6 spec', () => {
    const faces = [1, 2, 3, 4, 5, 6];
    expect(spatialIdxForValue(faces, 1)).toBe(1);
    expect(spatialIdxForValue(faces, 5)).toBe(5);
    expect(spatialIdxForValue(faces, 6)).toBe(6);
  });

  it('looks up out-of-range values for Fibonacci [1,1,2,3,5,8]', () => {
    const fib = [1, 1, 2, 3, 5, 8];
    // Two 1s — first occurrence wins.
    expect(spatialIdxForValue(fib, 1)).toBe(1);
    expect(spatialIdxForValue(fib, 2)).toBe(3);
    expect(spatialIdxForValue(fib, 3)).toBe(4);
    expect(spatialIdxForValue(fib, 5)).toBe(5);
    expect(spatialIdxForValue(fib, 8)).toBe(6);
  });

  it('handles Eclipse [0,0,0,1,1,1] including value 0', () => {
    const eclipse = [0, 0, 0, 1, 1, 1];
    expect(spatialIdxForValue(eclipse, 0)).toBe(1);
    expect(spatialIdxForValue(eclipse, 1)).toBe(4);
  });

  it('maps WILD sentinel (-1) to the WILD slot for Ophiuchus', () => {
    const oph = [1, 2, 3, 4, 5, 'WILD' as const];
    expect(spatialIdxForValue(oph, 1)).toBe(1);
    expect(spatialIdxForValue(oph, 5)).toBe(5);
    expect(spatialIdxForValue(oph, -1)).toBe(6);
  });

  it('maps value 0 to a BLANK slot when present', () => {
    const blanks = [1, 'BLANK' as const, 2, 'BLANK' as const, 3, 4];
    expect(spatialIdxForValue(blanks, 0)).toBe(2);
    expect(spatialIdxForValue(blanks, 2)).toBe(3);
  });

  it('falls back to max(1, value) when the value is not on the die', () => {
    const fib = [1, 1, 2, 3, 5, 8];
    // 7 is not on a Fibonacci die — fall back to clamped value.
    expect(spatialIdxForValue(fib, 7)).toBe(7);
    // Negative non-WILD value → clamped to 1.
    expect(spatialIdxForValue(fib, -5)).toBe(1);
  });
});
