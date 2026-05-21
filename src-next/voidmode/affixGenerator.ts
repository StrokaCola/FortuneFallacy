// src-next/voidmode/affixGenerator.ts
import type { SeededRng } from '../core/rng';
import type { AffixDef, AffixedItem, ArchetypeTag, ItemRarity } from './types';
import { AFFIX_DEFS } from './affixes';
import { generateItemName, generateFlavor } from './nameGenerator';

// Minimum surface area required by the affix generator. Anything with an
// id/name and optional rarity+archetypeTags can be wrapped — catalysts
// (CatalystMeta), consumables (ConsumableDef), and future kinds.
export type AffixGeneratorBase = {
  id: string;
  name: string;
  rarity?: ItemRarity;
  archetypeTags?: ReadonlyArray<ArchetypeTag>;
};

const BUDGET_BY_RARITY: Record<ItemRarity, number> = {
  common: 4,
  uncommon: 6,
  rare: 8,
  legendary: 10,
  mythic: 14,
};

export function budgetForRarity(r: ItemRarity): number {
  return BUDGET_BY_RARITY[r];
}

function pickWeighted<T extends { weight: number }>(rng: SeededRng, pool: ReadonlyArray<T>): T | null {
  if (pool.length === 0) return null;
  const total = pool.reduce((s, x) => s + x.weight, 0);
  let r = rng.next() * total;
  for (const x of pool) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return pool[pool.length - 1] as T;
}

function affixFits(
  a: AffixDef,
  baseTags: ReadonlyArray<string>,
  taken: ReadonlyArray<AffixDef>,
  budgetRemaining: number,
): boolean {
  if (!a.validOn.some(t => baseTags.includes(t))) return false;
  if (a.blockedOn?.some(t => baseTags.includes(t))) return false;
  if (a.slot !== 'mid' && taken.some(t => t.slot === a.slot)) return false;
  if (a.family === 'drawback' && taken.some(t => t.family === 'drawback')) return false;
  if (a.budgetCost > 0 && a.budgetCost > budgetRemaining) return false;
  return true;
}

function rarityTierFor(rarity: ItemRarity, affixCount: number): AffixedItem['rarityTier'] {
  if (rarity === 'mythic') return 'mythic';
  if (affixCount >= 2) return 'rare';
  if (affixCount === 1) return 'magic';
  return 'normal';
}

export interface GenerateAffixedItemOptions {
  // Override the affix pool the generator picks from. Defaults to the
  // catalyst-side AFFIX_DEFS so existing callers keep their behaviour;
  // blind affixes pass BLIND_AFFIX_DEFS to roll trial-flavored variants.
  pool?: ReadonlyArray<AffixDef>;
}

export function generateAffixedItem<T extends AffixGeneratorBase>(
  rng: SeededRng,
  base: T,
  opts: GenerateAffixedItemOptions = {},
): AffixedItem<T> {
  const tags = base.archetypeTags ?? [];
  if (tags.length === 0) {
    return {
      base,
      baseId: base.id,
      affixes: [],
      displayName: base.name,
      flavor: '',
      budgetSpent: 0,
      rarityTier: 'normal',
    };
  }

  const rarity: ItemRarity = (base.rarity ?? 'common') as ItemRarity;
  let budget = BUDGET_BY_RARITY[rarity];
  const taken: AffixDef[] = [];

  const isMythic = rarity === 'mythic';
  const sourcePool = opts.pool ?? AFFIX_DEFS;
  const pool = sourcePool.filter(a => isMythic || a.slot !== 'mid');

  for (let i = 0; i < 5; i++) {
    const eligible = pool.filter(a => affixFits(a, tags, taken, budget));
    if (eligible.length === 0) break;
    const picked = pickWeighted(rng, eligible);
    if (!picked) break;
    taken.push(picked);
    budget -= picked.budgetCost;
  }

  const displayName = generateItemName(base.name, taken);
  const flavor = generateFlavor(rng, taken);

  return {
    base,
    baseId: base.id,
    affixes: taken,
    displayName,
    flavor,
    budgetSpent: BUDGET_BY_RARITY[rarity] - budget,
    rarityTier: rarityTierFor(rarity, taken.length),
  };
}
