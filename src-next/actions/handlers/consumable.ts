import type { ActionHandler } from './types';
import { lookupConsumable } from '../../core/consumables';
import { maxConsumableSlots } from '../../core/vouchers';
import { hasDebuff } from '../../core/round/debuffs';
import { stakeContext } from '../../core/run/stakeContext';

export const consumableHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'GRANT_CONSUMABLE': {
      if (s.run.consumables.length >= maxConsumableSlots(s)) return { state: s, events: [] };
      if (!lookupConsumable(a.id)) return { state: s, events: [] };
      return {
        state: { ...s, run: { ...s.run, consumables: [...s.run.consumables, a.id] } },
        events: [],
      };
    }
    case 'DISCARD_CONSUMABLE':
      return {
        state: {
          ...s,
          run: { ...s.run, consumables: s.run.consumables.filter((_, i) => i !== a.index) },
        },
        events: [],
      };
    case 'USE_CONSUMABLE': {
      const id = s.run.consumables[a.index];
      if (!id) return { state: s, events: [] };
      const def = lookupConsumable(id);
      if (!def) return { state: s, events: [] };
      if (def.requiresTarget && (!a.targets || a.targets.length === 0)) return { state: s, events: [] };
      // Charon (boss) or active challenge with consumables_locked overlay:
      // trinkets sealed in stasis. Both gates resolve to the same no-op.
      if (hasDebuff(s, 'consumables_locked') || stakeContext(s).consumablesLocked) {
        return { state: s, events: [] };
      }
      const result = def.apply(s, a.targets ?? []);
      const consumables = result.state.run.consumables.filter((_, i) => i !== a.index);
      // Comet Trail: ANY consumable use during a blind resets the streak.
      // Marked here, consumed in transitions.clearBlind.
      return {
        state: {
          ...result.state,
          run: { ...result.state.run, consumables },
          round: { ...result.state.round, consumableUsedThisBlind: true },
        },
        events: result.events,
      };
    }
    default:
      return { state: s, events: [] };
  }
};
