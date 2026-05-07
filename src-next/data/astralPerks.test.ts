import { describe, it, expect } from 'vitest';
import { ASTRAL_PERKS, lookupAstralPerk } from './astralPerks';

describe('astralPerks catalog', () => {
  it('has unique ids', () => {
    const ids = ASTRAL_PERKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has positive costs', () => {
    for (const p of ASTRAL_PERKS) expect(p.cost).toBeGreaterThan(0);
  });

  it('costs increase with intended power', () => {
    // Sanity: the catalog is roughly sorted from cheapest to most expensive.
    // We don't enforce strict monotonicity, but the cheapest should be < the
    // most expensive by a wide margin.
    const sorted = [...ASTRAL_PERKS].sort((a, b) => a.cost - b.cost);
    expect(sorted.at(-1)!.cost).toBeGreaterThan(sorted[0]!.cost * 5);
  });

  it('every perk has a populated description and flavor', () => {
    for (const p of ASTRAL_PERKS) {
      expect(p.description.length).toBeGreaterThan(5);
      expect(p.flavor.length).toBeGreaterThan(5);
    }
  });

  it('lookupAstralPerk returns the perk for a known id', () => {
    expect(lookupAstralPerk('morning_star')?.name).toBe('Morning Star');
  });

  it('lookupAstralPerk returns undefined for unknown ids', () => {
    expect(lookupAstralPerk('nonexistent')).toBeUndefined();
  });
});
