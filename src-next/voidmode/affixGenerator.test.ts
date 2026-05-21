import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../core/rng';
import { generateAffixedItem, budgetForRarity } from './affixGenerator';
import { AFFIX_DEFS } from './affixes';
import type { CatalystMeta } from '../data/catalysts';

const FAKE_BASE: CatalystMeta = {
  id: 'burst_card',
  name: 'Burst Card',
  rarity: 'uncommon',
  archetypeTags: ['combo', 'scaling'],
  // Cast over the rest of CatalystMeta — tests only need the fields
  // the generator reads.
} as unknown as CatalystMeta;

describe('budgetForRarity', () => {
  it('returns mapped budgets', () => {
    expect(budgetForRarity('common')).toBe(4);
    expect(budgetForRarity('uncommon')).toBe(6);
    expect(budgetForRarity('rare')).toBe(8);
    expect(budgetForRarity('legendary')).toBe(10);
    expect(budgetForRarity('mythic')).toBe(14);
  });
});

describe('generateAffixedItem', () => {
  it('is deterministic for a given seed', () => {
    const a = generateAffixedItem(mulberry32(42), FAKE_BASE);
    const b = generateAffixedItem(mulberry32(42), FAKE_BASE);
    expect(a.displayName).toBe(b.displayName);
    expect(a.affixes.map(x => x.id)).toEqual(b.affixes.map(x => x.id));
  });

  it('never exceeds the rarity budget after accounting for drawback refunds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const item = generateAffixedItem(mulberry32(seed), FAKE_BASE);
      const positiveCost = item.affixes
        .filter(a => a.budgetCost > 0)
        .reduce((s, a) => s + a.budgetCost, 0);
      const drawbackRefund = item.affixes
        .filter(a => a.budgetCost < 0)
        .reduce((s, a) => s + Math.abs(a.budgetCost), 0);
      expect(positiveCost).toBeLessThanOrEqual(budgetForRarity('uncommon') + drawbackRefund);
    }
  });

  it('respects archetype gates — never attaches an affix whose validOn excludes the base tags', () => {
    for (let seed = 0; seed < 50; seed++) {
      const item = generateAffixedItem(mulberry32(seed), FAKE_BASE);
      for (const a of item.affixes) {
        expect(a.validOn.some(tag => FAKE_BASE.archetypeTags!.includes(tag))).toBe(true);
        if (a.blockedOn) {
          expect(a.blockedOn.some(tag => FAKE_BASE.archetypeTags!.includes(tag))).toBe(false);
        }
      }
    }
  });

  it('attaches at most one prefix and one suffix for non-mythic', () => {
    for (let seed = 0; seed < 50; seed++) {
      const item = generateAffixedItem(mulberry32(seed), FAKE_BASE);
      const prefixes = item.affixes.filter(a => a.slot === 'prefix').length;
      const suffixes = item.affixes.filter(a => a.slot === 'suffix').length;
      expect(prefixes).toBeLessThanOrEqual(1);
      expect(suffixes).toBeLessThanOrEqual(1);
    }
  });

  it('attaches at most one drawback per item', () => {
    for (let seed = 0; seed < 50; seed++) {
      const item = generateAffixedItem(mulberry32(seed), FAKE_BASE);
      const drawbacks = item.affixes.filter(a => a.family === 'drawback').length;
      expect(drawbacks).toBeLessThanOrEqual(1);
    }
  });

  it('produces a non-empty display name', () => {
    const item = generateAffixedItem(mulberry32(7), FAKE_BASE);
    expect(item.displayName.length).toBeGreaterThan(0);
    expect(item.displayName).toContain('Burst Card');
  });

  it('returns an unaffixed item when the base has no archetypeTags', () => {
    const untagged = { ...FAKE_BASE, archetypeTags: undefined } as CatalystMeta;
    const item = generateAffixedItem(mulberry32(7), untagged);
    expect(item.affixes).toEqual([]);
    expect(item.displayName).toBe('Burst Card');
  });

  it('attaches affixes to economy-only catalysts', () => {
    const economyBase = {
      id: 'piggy', name: 'Piggy', rarity: 'uncommon', archetypeTags: ['economy'],
    } as unknown as CatalystMeta;
    for (let s = 0; s < 30; s++) {
      const item = generateAffixedItem(mulberry32(s), economyBase);
      if (item.affixes.length > 0) {
        expect(true).toBe(true);
        return;
      }
    }
    throw new Error('No economy-tagged base ever rolled an affix in 30 seeds');
  });

  it('attaches affixes to mods-only catalysts', () => {
    const modsBase = {
      id: 'mod_focus', name: 'Mod Focus', rarity: 'uncommon', archetypeTags: ['mods'],
    } as unknown as CatalystMeta;
    for (let s = 0; s < 30; s++) {
      const item = generateAffixedItem(mulberry32(s), modsBase);
      if (item.affixes.length > 0) {
        expect(true).toBe(true);
        return;
      }
    }
    throw new Error('No mods-tagged base ever rolled an affix in 30 seeds');
  });

  it('attaches affixes to collision-only catalysts', () => {
    const collisionBase = {
      id: 'crash_test', name: 'Crash Test', rarity: 'uncommon', archetypeTags: ['collision'],
    } as unknown as CatalystMeta;
    for (let s = 0; s < 30; s++) {
      const item = generateAffixedItem(mulberry32(s), collisionBase);
      if (item.affixes.length > 0) {
        expect(true).toBe(true);
        return;
      }
    }
    throw new Error('No collision-tagged base ever rolled an affix in 30 seeds');
  });

  it('exposes 60 affix definitions split across the six families', () => {
    // Regression guard against accidentally trimming the catalog.
    expect(AFFIX_DEFS.length).toBe(60);
    const byFamily: Record<string, number> = {};
    for (const a of AFFIX_DEFS) {
      byFamily[a.family] = (byFamily[a.family] ?? 0) + 1;
    }
    expect(byFamily.scalar).toBe(12);
    expect(byFamily.conditional).toBe(12);
    expect(byFamily.persistent).toBe(8);
    expect(byFamily.drawback).toBe(10);
    expect(byFamily.synergy).toBe(10);
    expect(byFamily['reality-warp']).toBe(8);
  });

  it('exposes affixes for the economy/mods/collision archetype gates', () => {
    const tagCount = (tag: string) =>
      AFFIX_DEFS.filter(a => a.validOn.includes(tag as never)).length;
    expect(tagCount('economy')).toBeGreaterThanOrEqual(3);
    expect(tagCount('mods')).toBeGreaterThanOrEqual(3);
    expect(tagCount('collision')).toBeGreaterThanOrEqual(3);
  });

  it('every affix effect runs safely across all canonical combo ids', () => {
    const COMBO_IDS = [
      'five_kind', 'four_kind', 'lg_straight', 'full_house', 'sm_straight',
      'three_kind', 'two_pair', 'one_pair', 'chance',
    ];
    for (const a of AFFIX_DEFS) {
      for (const combo of COMBO_IDS) {
        const ctx = {
          chipsBonus: 0, multBonus: 0, goldBonus: 0,
          hand: { comboId: combo, diceValues: [1, 2, 3, 4, 5], isWild: [false, false, false, false, false] },
          run: { discardsRemaining: 2, handsRemaining: 3, catalystsOwned: 2, goldHeld: 13, seedDigit: 7 },
          trial: { rollsThisTrial: 3, isBossBlind: true },
          scratch: {} as Record<string, number>,
        };
        expect(() => a.effect(ctx)).not.toThrow();
      }
    }
  });
});
