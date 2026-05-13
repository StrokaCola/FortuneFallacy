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

  it('archetype bias: subsequent draws lean toward owned catalysts', () => {
    // With many trials, a draw seeded with a 'combo' catalyst should
    // produce mostly combo offers due to the 70% bias rate.
    const ownedCombo = ['stratifier']; // archetype=combo
    const ownedFace = ['six_bias'];    // archetype=face
    let comboMatches = 0;
    let faceMatches = 0;
    const TRIALS = 1000;
    for (let i = 0; i < TRIALS; i++) {
      const seed = i + 1;
      const rngCombo = (() => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
      const rngFace  = (() => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
      const offerCombo = drawWeightedCatalysts(1, 1, [], rngCombo, ownedCombo);
      const offerFace  = drawWeightedCatalysts(1, 1, [], rngFace,  ownedFace);
      const cMeta = CATALYST_META.find((m) => m.id === offerCombo[0]);
      const fMeta = CATALYST_META.find((m) => m.id === offerFace[0]);
      if (cMeta?.archetype === 'combo') comboMatches++;
      if (fMeta?.archetype === 'face')  faceMatches++;
    }
    // Without bias, expected matches ≈ frac of pool with that archetype
    // (well below 70%). With bias, we expect ≥50% of draws to match.
    expect(comboMatches / TRIALS).toBeGreaterThan(0.5);
    expect(faceMatches / TRIALS).toBeGreaterThan(0.5);
  });

  it('archetype bias: empty owned catalysts produces a coherent starter when count=3', () => {
    // Even with no owned catalysts, the first draw seeds the bias for the
    // remaining picks. A coherent starter trio is one where ≥2 of the 3
    // share an archetype. Across many trials this should be the common case.
    let coherent = 0;
    const TRIALS = 200;
    for (let i = 0; i < TRIALS; i++) {
      const seed = i + 1;
      const rng = (() => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
      const offers = drawWeightedCatalysts(3, 1, [], rng);
      const archetypes = offers.map((id) => CATALYST_META.find((m) => m.id === id)?.archetype);
      const counts = new Map<string, number>();
      for (const a of archetypes) {
        if (!a) continue;
        counts.set(a, (counts.get(a) ?? 0) + 1);
      }
      const max = Math.max(0, ...counts.values());
      if (max >= 2) coherent++;
    }
    // Without bias, P(2+ share archetype out of 3 from 7 archetypes) is
    // moderate but not dominant. With bias, expect >75% coherent.
    expect(coherent / TRIALS).toBeGreaterThan(0.75);
  });
});

describe('drawWeightedCatalysts — face-universe gating (Dead Pick Audit)', () => {
  // Eclipse's universe is [0, 1]. Face-gated catalysts that key on 5/6
  // (iron_six, solar_flare, high_roller catalyst) should never appear
  // in offers there. Universal catalysts still draw normally.
  it('drops iron_six / solar_flare / high_roller when face 5/6 missing', () => {
    const eclipseUniverse = new Set<number>([0, 1]);
    let droppedHits = 0;
    let totalOffers = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = (() => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
      // Draw three catalysts at ante 4 (so legendary tier rolls too) on
      // Eclipse. Iterate enough seeds to make a missed pool likely if the
      // gate weren't doing its job.
      const offers = drawWeightedCatalysts(3, 4, ['eclipse'], rng, [], 'eclipse', eclipseUniverse);
      totalOffers += offers.length;
      for (const id of offers) {
        if (id === 'iron_six' || id === 'solar_flare' || id === 'high_roller') droppedHits++;
      }
    }
    expect(totalOffers).toBeGreaterThan(0);
    expect(droppedHits).toBe(0);
  });

  it('does NOT drop face-gated catalysts when the face universe contains the trigger', () => {
    const lyraUniverse = new Set<number>([1, 2, 3, 4, 5, 6]);
    let allowedHits = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = (() => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
      const offers = drawWeightedCatalysts(3, 4, [], rng, [], 'lyra', lyraUniverse);
      for (const id of offers) {
        if (id === 'iron_six' || id === 'solar_flare' || id === 'high_roller') allowedHits++;
      }
    }
    // Across 300 ante-4 draws of 3 with rarity weights tilted toward
    // rare/legendary, the three face-keyed entries should reliably appear.
    expect(allowedHits).toBeGreaterThan(0);
  });

  it('omitting faceUniverse preserves legacy behaviour (no gating)', () => {
    // Old call sites that don't pass faceUniverse must still get the full
    // unfiltered pool — back-compat guarantee for tests, dev tools, sim.
    let allowedHits = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rng = (() => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
      const offers = drawWeightedCatalysts(3, 4, [], rng);
      for (const id of offers) {
        if (id === 'iron_six' || id === 'solar_flare' || id === 'high_roller') allowedHits++;
      }
    }
    expect(allowedHits).toBeGreaterThan(0);
  });
});
