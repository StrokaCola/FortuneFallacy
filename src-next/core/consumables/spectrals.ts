import type { GameState } from '../../state/store';
import type { GameEventEmission } from '../../events/types';
import type { ConsumableDef } from './index';
import type { CatalystEdition } from '../../state/slices/run';
import { GALAXY_COMBO_IDS, GALAXY_BONUS } from './galaxies';

// Spectral-tier consumables. Rare, run-shaping effects — they don't drop
// from the regular consumable pool; players acquire them via specific
// shop tags, boss rewards, or future Spectral Packs.

const ALL_EDITIONS: CatalystEdition[] = ['foil', 'holo', 'poly'];

// Combo tiers for Void's "adjacent combo" lookup. Ordered low→high.
const COMBO_TIER_ORDER = [
  'chance',
  'one_pair',
  'two_pair',
  'three_kind',
  'sm_straight',
  'full_house',
  'lg_straight',
  'four_kind',
  'five_kind',
];

export const SPECTRALS: ConsumableDef[] = [
  {
    id: 'void',
    type: 'spectral',
    name: 'Void',
    icon: '◌',
    description: 'Sacrifice 1 level on a chosen combo. +5 shards, +1 level on the next-tier combo.',
    requiresTarget: true,
    targetType: 'combo',
    apply: (s, targets) => {
      // targets[0] is an INDEX into COMBO_TIER_ORDER (passed from the UI).
      // Validate range; refuse to fire on the top tier or if level === 0
      // (no level to spend) so the player doesn't waste the consumable.
      const idx = targets[0];
      if (idx == null || idx < 0 || idx >= COMBO_TIER_ORDER.length - 1) return { state: s, events: [] };
      const fromCombo = COMBO_TIER_ORDER[idx]!;
      const toCombo = COMBO_TIER_ORDER[idx + 1]!;
      const curLvl = s.run.comboLevels?.[fromCombo] ?? 0;
      if (curLvl <= 0) return { state: s, events: [] };
      // Validate both combos are in the galaxy bonus table — defensive,
      // covers future combo additions that haven't been wired yet.
      if (!GALAXY_BONUS[fromCombo] || !GALAXY_BONUS[toCombo]) return { state: s, events: [] };
      void GALAXY_COMBO_IDS;
      const nextLevels = {
        ...s.run.comboLevels,
        [fromCombo]: curLvl - 1,
        [toCombo]: (s.run.comboLevels?.[toCombo] ?? 0) + 1,
      };
      const events: GameEventEmission[] = [
        { type: 'onGalaxyUsed', payload: { galaxyId: 'spectral_void', combo: toCombo, levelsAdded: { [fromCombo]: -1, [toCombo]: 1 } } },
      ];
      return {
        state: {
          ...s,
          run: { ...s.run, shards: s.run.shards + 5, comboLevels: nextLevels },
        },
        events,
      };
    },
  },
  {
    id: 'catalyze',
    type: 'spectral',
    name: 'Catalyze',
    icon: '⚗',
    description: 'Stamp a random edition (foil/holo/poly) onto a chosen catalyst.',
    requiresTarget: true,
    targetType: 'catalyst',
    apply: (s, targets) => {
      const idx = targets[0];
      if (idx == null) return { state: s, events: [] };
      const catalystId = s.run.catalysts[idx];
      if (!catalystId) return { state: s, events: [] };
      // Use Math.random — Catalyze is intentionally a one-shot RNG event
      // and seeding it would over-couple consumable use to the run seed.
      const edition = ALL_EDITIONS[Math.floor(Math.random() * ALL_EDITIONS.length)]!;
      const events: GameEventEmission[] = [
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: `spectral:catalyze@${catalystId}:${edition}`,
            phase: 5, // Phase.UPGRADES — emitted for HUD parity even though
                       // Catalyze runs in the action handler, not the pipeline.
            deltaChips: 0,
            deltaMult: 0,
          },
        },
      ];
      return {
        state: {
          ...s,
          run: {
            ...s.run,
            catalystEditions: {
              ...s.run.catalystEditions,
              [catalystId]: edition,
            },
          },
        },
        events,
      };
    },
  },
];
