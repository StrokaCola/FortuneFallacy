import { describe, it, expect } from 'vitest';
import {
  drawWeightedCatalysts,
  isLegendaryUnlocked,
  isMythicUnlocked,
  rarityWeightsForAnte,
  rollRarity,
  rollCatalystAffixes,
  LEGENDARY_UNLOCK_PREFIX,
  MYTHIC_UNLOCK_PREFIX,
} from './catalystDraw';
import { CATALYST_META } from '../../data/catalysts';
import { mulberry32 } from '../rng';

describe('rarityWeightsForAnte', () => {
  it('Ante 1-2 leans heavy common (>=0.55)', () => {
    expect(rarityWeightsForAnte(1).common).toBeGreaterThanOrEqual(0.55);
    expect(rarityWeightsForAnte(2).common).toBeGreaterThanOrEqual(0.55);
  });

  it('Ante 3+ rebalances toward rare/legendary', () => {
    const w = rarityWeightsForAnte(3);
    expect(w.common).toBeLessThan(0.55);
    expect(w.rare).toBeGreaterThanOrEqual(0.20);
    // 2026-05-19: legendary weight rebalanced slightly to make room for
    // mythic. Ante 3 keeps legendary at 0.02 (was 0.04); ante 4 keeps 0.04.
    expect(w.legendary).toBeGreaterThanOrEqual(0.02);
  });

  it('mythic is 0% at ante 1-2 (gated by ante > 2)', () => {
    expect(rarityWeightsForAnte(1).mythic).toBe(0);
    expect(rarityWeightsForAnte(2).mythic).toBe(0);
  });

  it('mythic appears from ante 3 (2%) and grows at ante 4 (4%)', () => {
    expect(rarityWeightsForAnte(3).mythic).toBeCloseTo(0.02);
    expect(rarityWeightsForAnte(4).mythic).toBeCloseTo(0.04);
  });

  it('Cosmic Lap depth boosts mythic rate by +1%/lap up to +4%', () => {
    expect(rarityWeightsForAnte(4, 1).mythic).toBeCloseTo(0.05);
    expect(rarityWeightsForAnte(4, 4).mythic).toBeCloseTo(0.08);
    // Cap at +4% — lap 10 doesn't keep climbing.
    expect(rarityWeightsForAnte(4, 10).mythic).toBeCloseTo(0.08);
  });
});

describe('rollRarity', () => {
  it('rolling 0 always returns common', () => {
    expect(rollRarity(rarityWeightsForAnte(1), () => 0)).toBe('common');
  });

  it('rolling 0.999 at ante 3+ returns mythic (top of the band)', () => {
    // 2026-05-19: mythic sits above legendary in the weight chain, so the
    // very top of the rng range now lands on mythic, not legendary.
    expect(rollRarity(rarityWeightsForAnte(3), () => 0.999)).toBe('mythic');
  });

  it('rolling 0.999 at ante 1-2 returns legendary (mythic weight is 0)', () => {
    expect(rollRarity(rarityWeightsForAnte(1), () => 0.999)).toBe('legendary');
  });
});

describe('isMythicUnlocked', () => {
  it('non-mythic catalysts are always considered unlocked', () => {
    const common = CATALYST_META.find((c) => c.rarity === 'common')!;
    expect(isMythicUnlocked(common, [])).toBe(true);
  });

  it('mythic is locked when unlock id absent', () => {
    const mythic = CATALYST_META.find((c) => c.rarity === 'mythic')!;
    expect(isMythicUnlocked(mythic, [])).toBe(false);
  });

  it('mythic is unlocked when prefixed id is present', () => {
    const mythic = CATALYST_META.find((c) => c.rarity === 'mythic')!;
    expect(isMythicUnlocked(mythic, [`${MYTHIC_UNLOCK_PREFIX}${mythic.id}`])).toBe(true);
  });
});

describe('drawWeightedCatalysts — mythic gating', () => {
  it('mythics never surface without unlocks even when mythic tier rolls', () => {
    // Draw at ante 4 with high-end rolls (so mythic tier is rolled), no
    // unlocks — every mythic id should fall through to legendary/rare/etc.
    const mythicIds = new Set(CATALYST_META.filter((c) => c.rarity === 'mythic').map((c) => c.id));
    let mythicHits = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = (() => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
      const offers = drawWeightedCatalysts(3, 4, [], rng);
      for (const id of offers) if (mythicIds.has(id)) mythicHits++;
    }
    expect(mythicHits).toBe(0);
  });

  it('unlocked mythics surface when the mythic tier rolls at ante 3+', () => {
    const allMythicUnlocks = CATALYST_META
      .filter((c) => c.rarity === 'mythic')
      .map((c) => `${MYTHIC_UNLOCK_PREFIX}${c.id}`);
    const mythicIds = new Set(CATALYST_META.filter((c) => c.rarity === 'mythic').map((c) => c.id));
    let mythicHits = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const rng = (() => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
      const offers = drawWeightedCatalysts(3, 4, allMythicUnlocks, rng, [], undefined, undefined, 4);
      for (const id of offers) if (mythicIds.has(id)) mythicHits++;
    }
    // With 8% mythic at lap 4 ante 4 and 3 offers per draw × 500 seeds,
    // expected mythic hits ≈ 120. Use a wide floor for stability.
    expect(mythicHits).toBeGreaterThan(20);
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

describe('rollCatalystAffixes — Void Mode affix payload', () => {
  // Pick three catalysts whose metas have archetypeTags so the generator
  // has a non-empty pool to draw from. These were tagged in Phase 3.
  const TAGGED_IDS = ['stratifier', 'six_bias', 'compounding_bias'];

  it('produces an AffixedItem per input id with matching base.id', () => {
    const rolls = rollCatalystAffixes(TAGGED_IDS, mulberry32(42));
    expect(rolls.length).toBe(TAGGED_IDS.length);
    for (let i = 0; i < TAGGED_IDS.length; i++) {
      expect(rolls[i]!.base.id).toBe(TAGGED_IDS[i]);
      expect(rolls[i]!.baseId).toBe(TAGGED_IDS[i]);
    }
  });

  it('is deterministic for a given seed (same rng → same affix ids)', () => {
    const a = rollCatalystAffixes(TAGGED_IDS, mulberry32(123));
    const b = rollCatalystAffixes(TAGGED_IDS, mulberry32(123));
    for (let i = 0; i < TAGGED_IDS.length; i++) {
      expect(a[i]!.affixes.map((af) => af.id)).toEqual(b[i]!.affixes.map((af) => af.id));
      expect(a[i]!.displayName).toBe(b[i]!.displayName);
    }
  });

  it('skips unknown ids gracefully', () => {
    const rolls = rollCatalystAffixes(['stratifier', 'not_a_real_catalyst', 'six_bias'], mulberry32(7));
    // Unknown ids drop out — only the two known ones produce entries.
    expect(rolls.length).toBe(2);
    expect(rolls.map((r) => r.baseId)).toEqual(['stratifier', 'six_bias']);
  });

  it('attaches at least one affix to tagged uncommon+ catalysts most of the time', () => {
    // Across many seeds, a tagged catalyst with a non-trivial budget should
    // typically produce >=1 affix. Allow a wide floor — generator can roll
    // empty if no affix happens to fit, but it should be rare.
    let withAffixes = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const rolls = rollCatalystAffixes(['stratifier'], mulberry32(seed));
      if (rolls[0]!.affixes.length > 0) withAffixes++;
    }
    expect(withAffixes).toBeGreaterThan(30);
  });
});
