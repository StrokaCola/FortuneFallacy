// src-next/voidmode/types.ts
// All public types for Void Mode. Imported by affixes, affixGenerator,
// nameGenerator, scoring phase, shop hook.

import type { CatalystMeta } from '../data/catalysts';

export type AffixFamily =
  | 'scalar'
  | 'conditional'
  | 'persistent'
  | 'drawback'
  | 'synergy'
  | 'reality-warp';

export type AffixSlot = 'prefix' | 'suffix' | 'mid';

export type ArchetypeTag =
  | 'combo'
  | 'face'
  | 'economy'
  | 'scaling'
  | 'mods'
  | 'timing'
  | 'utility'
  | 'collision'
  | 'risk';

// Context handed to an affix's effect function. The phase that runs
// affixes (core/phases/applyAffixes.ts) populates this. Mutating fields
// is the primary side effect — see chipsBonus/multBonus etc.
export interface AffixContext {
  chipsBonus: number;
  multBonus: number;
  goldBonus: number;
  // Read-only view of relevant scoring state. Affixes that need more
  // (e.g. die-strip drawbacks) get expanded fields here later.
  hand: {
    comboId: string;        // 'pair', 'two_pair', 'flush', ...
    diceValues: number[];
    isWild: boolean[];
  };
  run: {
    discardsRemaining: number;
    handsRemaining: number;
    catalystsOwned: number;
    goldHeld: number;
    seedDigit: number;      // last digit of run seed, for seed-aware affixes
  };
  trial: {
    rollsThisTrial: number;
    isBossBlind: boolean;
  };
  // Per-affix scratch state survives across rolls within a trial (cleared
  // on trial start). Used by persistent-family affixes to bank counters.
  scratch: Record<string, number>;
}

export interface AffixDef {
  id: string;
  slot: AffixSlot;
  family: AffixFamily;
  // Positive cost spends budget. Negative cost (drawbacks) refunds budget,
  // letting a stronger upside fit alongside.
  budgetCost: number;
  validOn: ArchetypeTag[];
  blockedOn?: ArchetypeTag[];
  weight: number;
  // Display strings used by nameGenerator. nameTemplate goes in the slot
  // (e.g. 'Cracked', 'of Sundering'). flavorTags filter which flavor
  // lines are eligible to attach to this item.
  nameTemplate: string;
  flavorTags: string[];
  effect: (ctx: AffixContext) => void;
}

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';

export interface AffixedItem<T = CatalystMeta> {
  base: T;
  baseId: string;
  affixes: AffixDef[];   // 0..3 (0 only on normal-rarity-tier items, never in void mode)
  displayName: string;
  flavor: string;
  budgetSpent: number;
  rarityTier: 'normal' | 'magic' | 'rare' | 'mythic';
}
