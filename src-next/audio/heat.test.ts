import { describe, it, expect } from 'vitest';
import { smoothstep } from './heat';

describe('smoothstep', () => {
  it('returns 0 below edge0', () => {
    expect(smoothstep(0, 0.5, 1)).toBe(0);
  });
  it('returns 1 above edge1', () => {
    expect(smoothstep(2, 0.5, 1)).toBe(1);
  });
  it('is monotonic in the interior', () => {
    const a = smoothstep(0.6, 0.5, 1);
    const b = smoothstep(0.8, 0.5, 1);
    expect(b).toBeGreaterThan(a);
  });
});
