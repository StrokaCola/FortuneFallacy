import { describe, it, expect } from 'vitest';
import { computeDropSlot } from './dragSlot';

describe('computeDropSlot', () => {
  it('returns 0 when pointer is closest to first slot', () => {
    expect(computeDropSlot(-2.5, [-2.0, -1.0, 0.0, 1.0, 2.0])).toBe(0);
  });

  it('returns last index when pointer is closest to last slot', () => {
    expect(computeDropSlot(2.4, [-2.0, -1.0, 0.0, 1.0, 2.0])).toBe(4);
  });

  it('returns middle index when pointer is closest to middle slot', () => {
    expect(computeDropSlot(0.1, [-2.0, -1.0, 0.0, 1.0, 2.0])).toBe(2);
  });

  it('handles single-slot case', () => {
    expect(computeDropSlot(99, [0])).toBe(0);
  });

  it('handles empty slots (returns -1)', () => {
    expect(computeDropSlot(0, [])).toBe(-1);
  });

  it('on equidistant pointer, returns the first matching slot (deterministic)', () => {
    // Pointer exactly between slot 0 (-1) and slot 1 (1). |0 - -1| === |0 - 1|.
    // Loop uses strict `<` so first slot wins.
    expect(computeDropSlot(0, [-1, 1])).toBe(0);
  });
});
