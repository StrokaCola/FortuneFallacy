import { describe, it, expect } from 'vitest';
import { CONSUMABLES, lookupConsumable, rollConsumableAffixes } from './index';
import { mulberry32 } from '../rng';
import type { GameState } from '../../state/store';

function makeState(): GameState {
  return {
    run: {
      seed: 1, shards: 0, ante: 1, goalIdx: 0,
      catalysts: [], vouchers: [], consumables: [],
      handsPlayed: 0, compoundingStacks: 0,
    },
    round: {
      active: true, blindId: null, blindIndex: 0, isBoss: false,
      target: 100, score: 0, handsLeft: 3, handsMax: 3, rerollsLeft: 2,
      dice: Array.from({ length: 5 }, (_, id) => ({ id, face: 1, locked: false })),
      hand: [], handInProgress: false, scoring: false,
      chainLen: 0, chainTier: -1, diceMods: [],
      shardSinkPrimedThisHand: false,
    },
    meta: { playerName: 'test', highScores: [] },
    ui: { screen: 'round', paused: false },
    shop: { open: false, offers: [], rerollCost: 0 },
    pingCount: 0,
  } as unknown as GameState;
}

describe('pin_three', () => {
  it('sets target die face to 3', () => {
    const def = lookupConsumable('pin_three')!;
    const result = def.apply(makeState(), [2]);
    expect(result.state.round.dice[2]?.face).toBe(3);
  });
  it('no-op if target index invalid', () => {
    const def = lookupConsumable('pin_three')!;
    const result = def.apply(makeState(), [99]);
    expect(result.state.round.dice[2]?.face).toBe(1);
  });
});

describe('spare_reroll', () => {
  it('increments rerollsLeft by 1', () => {
    const def = lookupConsumable('spare_reroll')!;
    const result = def.apply(makeState(), []);
    expect(result.state.round.rerollsLeft).toBe(3);
  });
});

describe('CONSUMABLES roster', () => {
  it('contains 6 base + 10 galaxies + 2 spectrals + 6 maneuvers', () => {
    expect(CONSUMABLES.length).toBe(24);
  });

  it('every galaxy has type=galaxy and a comboId', () => {
    const galaxies = CONSUMABLES.filter((c) => c.type === 'galaxy');
    expect(galaxies.length).toBe(10);
    for (const g of galaxies) {
      expect(g.comboId).toBeDefined();
    }
  });

  it('every spectral has type=spectral and a target', () => {
    const spectrals = CONSUMABLES.filter((c) => c.type === 'spectral');
    expect(spectrals.length).toBeGreaterThanOrEqual(1);
    for (const sp of spectrals) {
      expect(sp.requiresTarget).toBe(true);
    }
  });
});

describe('Void Mode — consumable archetypeTags coverage', () => {
  // Phase 5.2 minimum: ≥12 consumables tagged so the procgen affix
  // generator has a non-empty pool to draw from. Confirms the tag
  // density survived later edits.
  it('at least 12 consumables carry archetypeTags', () => {
    const tagged = CONSUMABLES.filter((c) => c.archetypeTags && c.archetypeTags.length > 0);
    expect(tagged.length).toBeGreaterThanOrEqual(12);
  });

  it('every tagged consumable also declares a rarity', () => {
    for (const c of CONSUMABLES) {
      if (c.archetypeTags && c.archetypeTags.length > 0) {
        expect(c.rarity).toBeDefined();
      }
    }
  });

  it('each consumable kind (galaxy, spectral, maneuver) has at least 3 tagged entries', () => {
    const taggedByKind = (kind: string) =>
      CONSUMABLES.filter((c) => c.type === kind && c.archetypeTags && c.archetypeTags.length > 0).length;
    expect(taggedByKind('galaxy')).toBeGreaterThanOrEqual(3);
    expect(taggedByKind('spectral')).toBeGreaterThanOrEqual(2); // only 2 spectrals exist; ≥2 satisfies "all of them"
    expect(taggedByKind('maneuver')).toBeGreaterThanOrEqual(3);
  });
});

describe('rollConsumableAffixes — Void Mode affix payload', () => {
  // Galaxies + Quasar are all tagged with rarity=uncommon/rare and
  // archetypeTags=['scaling','combo'] in Phase 5.2.
  const TAGGED_IDS = ['galaxy_milky_way', 'galaxy_quasar', 'void'];

  it('produces an AffixedItem per input id with matching baseId', () => {
    const rolls = rollConsumableAffixes(TAGGED_IDS, mulberry32(99));
    expect(rolls.length).toBe(TAGGED_IDS.length);
    for (let i = 0; i < TAGGED_IDS.length; i++) {
      expect(rolls[i]!.baseId).toBe(TAGGED_IDS[i]);
      expect(rolls[i]!.base.id).toBe(TAGGED_IDS[i]);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = rollConsumableAffixes(TAGGED_IDS, mulberry32(11));
    const b = rollConsumableAffixes(TAGGED_IDS, mulberry32(11));
    for (let i = 0; i < TAGGED_IDS.length; i++) {
      expect(a[i]!.affixes.map((af) => af.id)).toEqual(b[i]!.affixes.map((af) => af.id));
    }
  });

  it('skips unknown ids gracefully', () => {
    const rolls = rollConsumableAffixes(['galaxy_milky_way', 'not_a_real_consumable', 'void'], mulberry32(2));
    expect(rolls.length).toBe(2);
    expect(rolls.map((r) => r.baseId)).toEqual(['galaxy_milky_way', 'void']);
  });

  it('attaches at least one affix to a tagged uncommon galaxy across most seeds', () => {
    let withAffixes = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const rolls = rollConsumableAffixes(['galaxy_milky_way'], mulberry32(seed));
      if (rolls[0]!.affixes.length > 0) withAffixes++;
    }
    expect(withAffixes).toBeGreaterThan(30);
  });
});
