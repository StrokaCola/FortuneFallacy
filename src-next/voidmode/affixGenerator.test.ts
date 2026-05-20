import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../core/rng';
import { generateAffixedItem, budgetForRarity } from './affixGenerator';
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
});
