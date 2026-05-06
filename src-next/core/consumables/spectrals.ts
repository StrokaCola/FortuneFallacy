import type { GameState } from '../../state/store';
import type { GameEventEmission } from '../../events/types';
import type { ConsumableDef } from './index';
import type { CatalystEdition } from '../../state/slices/run';

// Spectral-tier consumables. Rare, run-shaping effects — they don't drop
// from the regular consumable pool; players acquire them via specific
// shop tags, boss rewards, or future Spectral Packs.

const ALL_EDITIONS: CatalystEdition[] = ['foil', 'holo', 'poly'];

export const SPECTRALS: ConsumableDef[] = [
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
