import type { GameState } from '../../state/store';
import type { GameEventEmission } from '../../events/types';
import type { ArchetypeTag, ItemRarity, AffixedItem } from '../../voidmode/types';
import type { SeededRng } from '../rng';
import { generateAffixedItem } from '../../voidmode/affixGenerator';
// Galaxies are kept in their own file because the table is large and is
// generated from a per-combo bonus map. Importing here registers them in
// the global CONSUMABLES list below.
import { GALAXIES } from './galaxies';
import { SPECTRALS } from './spectrals';
import { MANEUVERS } from './maneuvers';

export type ConsumableDef = {
  id: string;
  type: 'calibration' | 'resource' | 'galaxy' | 'spectral' | 'maneuver';
  name: string;
  icon: string;
  description: string;
  requiresTarget: boolean;
  targetType?: 'die' | 'catalyst' | 'combo';
  // Galaxy-only metadata. `comboId` names the combo this galaxy levels (or
  // 'all' for universals like Quasar). `levels` is the +levels granted on
  // use (default 1). Both fields are unused for non-galaxy consumables.
  comboId?: string | 'all';
  levels?: number;
  // Void Mode affix surface. `rarity` is used to compute the affix budget;
  // `archetypeTags` filter which affix families can attach. Optional —
  // untagged consumables fall through as base (no affixes attached) in
  // void runs. Mirrors the same fields on CatalystMeta.
  rarity?: ItemRarity;
  archetypeTags?: ArchetypeTag[];
  apply: (s: GameState, targets: number[]) => { state: GameState; events: GameEventEmission[] };
};

export const CONSUMABLES: ConsumableDef[] = [
  {
    id: 'pin_six',
    type: 'calibration',
    name: 'Pin Six',
    icon: '☽',
    description: 'Set one die to face 6.',
    requiresTarget: true,
    targetType: 'die',
    apply: (s, [idx]) => {
      if (idx == null || !s.round.dice[idx]) return { state: s, events: [] };
      const dice = s.round.dice.map((d, i) => (i === idx ? { ...d, face: 6 } : d));
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
  {
    id: 'pin_one',
    type: 'calibration',
    name: 'Pin One',
    icon: '☀',
    description: 'Set one die to face 1.',
    requiresTarget: true,
    targetType: 'die',
    apply: (s, [idx]) => {
      if (idx == null || !s.round.dice[idx]) return { state: s, events: [] };
      const dice = s.round.dice.map((d, i) => (i === idx ? { ...d, face: 1 } : d));
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
  {
    id: 'shard_drop',
    type: 'resource',
    name: 'Shard Drop',
    icon: '◇',
    description: '+5 shards.',
    requiresTarget: false,
    apply: (s) => ({
      state: { ...s, run: { ...s.run, shards: s.run.shards + 5 } },
      events: [],
    }),
  },
  {
    id: 'roll_token',
    type: 'resource',
    name: 'Roll Token',
    icon: '◈',
    description: '+1 hand.',
    requiresTarget: false,
    apply: (s) => ({
      state: { ...s, round: { ...s.round, handsLeft: s.round.handsLeft + 1 } },
      events: [],
    }),
  },
  {
    id: 'pin_three',
    type: 'calibration',
    name: 'Pin Three',
    icon: '☷',
    description: 'Set one die to face 3.',
    requiresTarget: true,
    targetType: 'die',
    apply: (s, [idx]) => {
      if (idx == null || !s.round.dice[idx]) return { state: s, events: [] };
      const dice = s.round.dice.map((d, i) => (i === idx ? { ...d, face: 3 } : d));
      return { state: { ...s, round: { ...s.round, dice } }, events: [] };
    },
  },
  {
    id: 'spare_reroll',
    type: 'resource',
    name: 'Spare Reroll',
    icon: '↻',
    description: '+1 reroll this round.',
    requiresTarget: false,
    apply: (s) => ({
      state: { ...s, round: { ...s.round, rerollsLeft: s.round.rerollsLeft + 1 } },
      events: [],
    }),
  },
  ...GALAXIES,
  ...SPECTRALS,
  ...MANEUVERS,
];

export function lookupConsumable(id: string): ConsumableDef | undefined {
  return CONSUMABLES.find((c) => c.id === id);
}

// Void Mode: roll a procgen affix bundle for each consumable id. Mirrors
// `rollCatalystAffixes` in core/shop/catalystDraw.ts. Returns AffixedItem
// entries keyed off each consumable's def. Untagged consumables still
// produce an entry (base-only AffixedItem) so the caller can attach a
// payload uniformly. Unknown ids are skipped.
export function rollConsumableAffixes(
  ids: readonly string[],
  voidRng: SeededRng,
): AffixedItem<ConsumableDef>[] {
  const out: AffixedItem<ConsumableDef>[] = [];
  for (const id of ids) {
    const def = lookupConsumable(id);
    if (!def) continue;
    out.push(generateAffixedItem(voidRng, def));
  }
  return out;
}

// Derive a Rarity tier from the consumable's `type` field. Used by the
// kind-frame visual pass so the four owned-consumable surfaces (shop
// card, ConsumableTray, Codex, collection rows) all gain a rarity tint
// without having to backfill every individual consumable definition.
export function consumableRarity(
  type: ConsumableDef['type'],
): 'common' | 'uncommon' | 'rare' | 'legendary' {
  if (type === 'calibration' || type === 'resource') return 'common';
  if (type === 'galaxy') return 'uncommon';
  // spectrals + maneuvers are the deepest payoffs in the consumable pool
  return 'rare';
}
