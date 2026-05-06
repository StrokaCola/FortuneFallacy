import { describe, it, expect } from 'vitest';
import { GALAXIES, GALAXY_BONUS, PACK_DEFS, lookupPack, rollPackContents } from './galaxies';

describe('GALAXIES roster', () => {
  it('contains 9 combo galaxies + Quasar', () => {
    expect(GALAXIES.length).toBe(10);
  });

  it('every galaxy has type=galaxy and a comboId', () => {
    for (const g of GALAXIES) {
      expect(g.type).toBe('galaxy');
      expect(g.comboId).toBeTruthy();
    }
  });

  it('GALAXY_BONUS covers all 9 combos with positive chips and mult', () => {
    for (const id of ['chance', 'one_pair', 'two_pair', 'three_kind', 'sm_straight', 'full_house', 'lg_straight', 'four_kind', 'five_kind']) {
      const b = GALAXY_BONUS[id];
      expect(b).toBeDefined();
      expect(b!.chips).toBeGreaterThan(0);
      expect(b!.mult).toBeGreaterThan(0);
    }
  });
});

describe('PACK_DEFS', () => {
  it('has 3 tiers (celestial, stellar, galactic)', () => {
    expect(PACK_DEFS.map((p) => p.kind)).toEqual(['celestial', 'stellar', 'galactic']);
  });

  it('lookupPack returns the def for known kinds', () => {
    expect(lookupPack('celestial')!.showCount).toBe(2);
    expect(lookupPack('stellar')!.pickCount).toBe(1);
    expect(lookupPack('galactic')!.pickCount).toBe(2);
  });

  it('lookupPack returns undefined for unknown kinds', () => {
    expect(lookupPack('nope')).toBeUndefined();
  });
});

describe('rollPackContents', () => {
  // Deterministic RNG: always returns 0 → picks the first weighted entry each iteration.
  const fixedRng = () => 0;

  it('returns showCount distinct galaxy ids', () => {
    const out = rollPackContents(4, fixedRng);
    expect(out.length).toBe(4);
    expect(new Set(out).size).toBe(4); // no duplicates
  });

  it('all picks are valid galaxy ids', () => {
    const out = rollPackContents(3, fixedRng);
    const validIds = GALAXIES.map((g) => g.id);
    for (const id of out) {
      expect(validIds).toContain(id);
    }
  });

  it('handles requesting more than the pool size by capping at pool size', () => {
    // Pool has 10 galaxies. Asking for 50 should give 10 distinct ids and stop.
    const out = rollPackContents(50, () => Math.random());
    expect(out.length).toBe(10);
  });
});
