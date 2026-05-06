import { describe, it, expect } from 'vitest';
import {
  drawWeightedCatalysts,
  isLegendaryUnlocked,
  rarityWeightsForAnte,
  rollRarity,
  LEGENDARY_UNLOCK_PREFIX,
} from './catalystDraw';
import { CATALYST_META } from '../../data/catalysts';

describe('rarityWeightsForAnte', () => {
  it('Ante 1-2 leans heavy common (>=0.55)', () => {
    expect(rarityWeightsForAnte(1).common).toBeGreaterThanOrEqual(0.55);
    expect(rarityWeightsForAnte(2).common).toBeGreaterThanOrEqual(0.55);
  });

  it('Ante 3+ rebalances toward rare/legendary', () => {
    const w = rarityWeightsForAnte(3);
    expect(w.common).toBeLessThan(0.55);
    expect(w.rare).toBeGreaterThanOrEqual(0.20);
    expect(w.legendary).toBeGreaterThanOrEqual(0.04);
  });
});

describe('rollRarity', () => {
  it('rolling 0 always returns common', () => {
    expect(rollRarity(rarityWeightsForAnte(1), () => 0)).toBe('common');
  });

  it('rolling 0.999 always returns legendary', () => {
    expect(rollRarity(rarityWeightsForAnte(3), () => 0.999)).toBe('legendary');
  });
});

describe('isLegendaryUnlocked', () => {
  it('non-legendary is always considered unlocked', () => {
    const common = CATALYST_META.find((c) => c.rarity === 'common')!;
    expect(isLegendaryUnlocked(common, [])).toBe(true);
  });

  it('legendary is locked when unlock id absent', () => {
    const allBand = CATALYST_META.find((c) => c.id === 'all_band')!;
    expect(isLegendaryUnlocked(allBand, [])).toBe(false);
  });

  it('legendary is unlocked when prefixed id is present', () => {
    const allBand = CATALYST_META.find((c) => c.id === 'all_band')!;
    expect(isLegendaryUnlocked(allBand, [`${LEGENDARY_UNLOCK_PREFIX}all_band`])).toBe(true);
  });
});

describe('drawWeightedCatalysts', () => {
  it('returns N distinct ids', () => {
    const out = drawWeightedCatalysts(3, 1, [], () => 0);
    expect(out.length).toBe(3);
    expect(new Set(out).size).toBe(3);
  });

  it('all picks are valid catalyst ids', () => {
    const validIds = new Set(CATALYST_META.map((c) => c.id));
    const out = drawWeightedCatalysts(5, 1, [], () => Math.random());
    for (const id of out) expect(validIds.has(id)).toBe(true);
  });

  it('locked legendaries never surface', () => {
    // Force tier rolls to land on legendary by mocking a high rng each call.
    // unlocks=[] → all_band locked → falls through to rare/uncommon/common.
    const out = drawWeightedCatalysts(8, 3, [], () => 0.99);
    expect(out).not.toContain('all_band');
  });

  it('unlocked legendaries can surface when the legendary tier rolls', () => {
    const unlocks = [`${LEGENDARY_UNLOCK_PREFIX}all_band`];
    // Hand-craft an rng that returns 0.99 for tier roll (legendary band)
    // and 0 for the in-tier index pick. The function calls rng twice per
    // pick: once for rarity, once for index. We have one legendary so
    // index 0 will pick all_band.
    let calls = 0;
    const rng = () => (calls++ % 2 === 0 ? 0.99 : 0);
    const out = drawWeightedCatalysts(1, 3, unlocks, rng);
    expect(out).toEqual(['all_band']);
  });
});
