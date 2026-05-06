import { describe, it, expect } from 'vitest';
import { BOSS_BLINDS } from './blinds';

describe('BOSS_BLINDS shape contract', () => {
  it('has 8 entries', () => {
    expect(BOSS_BLINDS).toHaveLength(8);
  });

  it('every entry has iconGlyph with paths', () => {
    for (const b of BOSS_BLINDS) {
      expect(b.iconGlyph.viewBox).toMatch(/^\d+ \d+ \d+ \d+$/);
      expect(b.iconGlyph.paths.length).toBeGreaterThan(0);
    }
  });

  it('every sigil has at least one body-core group', () => {
    for (const b of BOSS_BLINDS) {
      const hasBody = b.sigil.groups.some((g) => g.class === 'body-core');
      expect(hasBody, `${b.id} missing body-core`).toBe(true);
    }
  });

  it('every group class is a valid SigilGroupClass literal', () => {
    const valid = new Set(['orbit-main', 'orbit-aux', 'body-core', 'satellite', 'mark']);
    for (const b of BOSS_BLINDS) {
      for (const g of b.sigil.groups) {
        expect(valid.has(g.class), `${b.id}: invalid class "${g.class}"`).toBe(true);
      }
    }
  });

  it('no entry retains the legacy Unicode icon field', () => {
    for (const b of BOSS_BLINDS) {
      expect((b as Record<string, unknown>).icon).toBeUndefined();
    }
  });

  it('at least 7 of 8 bosses have an orbit-class group (Callisto exempt)', () => {
    const withOrbit = BOSS_BLINDS.filter((b) =>
      b.sigil.groups.some((g) => g.class === 'orbit-main' || g.class === 'orbit-aux'),
    );
    expect(withOrbit.length).toBeGreaterThanOrEqual(7);
  });

  it('every sigil group has at least one path', () => {
    for (const b of BOSS_BLINDS) {
      for (const g of b.sigil.groups) {
        expect(g.paths.length, `${b.id}: empty paths in group "${g.class}"`).toBeGreaterThan(0);
      }
    }
  });

  it('every sigil viewBox matches "x y w h" format', () => {
    for (const b of BOSS_BLINDS) {
      expect(b.sigil.viewBox, `${b.id}: malformed sigil viewBox`).toMatch(/^\d+ \d+ \d+ \d+$/);
    }
  });
});
