import type { ActionHandler } from './types';
import { initialRoundSlice } from '../../state/slices/round';
import { lookupMod } from '../../core/mods';
import { maxModSlots } from '../../core/vouchers';

export const diceHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'TOGGLE_LOCK': {
      const target = s.round.dice[a.dieIdx];
      if (!target) return { state: s, events: [] };
      const dice = s.round.dice.map((d, i) =>
        i === a.dieIdx ? { ...d, locked: !d.locked } : d,
      );
      return {
        state: { ...s, round: { ...s.round, dice } },
        events: [{ type: 'onLockToggled', payload: { dieIdx: a.dieIdx, locked: !target.locked } }],
      };
    }
    case 'RESET_ROUND':
      return { state: { ...s, round: initialRoundSlice() }, events: [] };
    case 'ATTACH_MOD': {
      if (!lookupMod(a.modId)) return { state: s, events: [] };
      const slots = s.round.diceMods[a.dieIdx];
      if (!slots || slots.length >= maxModSlots(s)) return { state: s, events: [] };
      const diceMods = s.round.diceMods.map((r, i) => (i === a.dieIdx ? [...r, a.modId] : r));
      return { state: { ...s, round: { ...s.round, diceMods } }, events: [] };
    }
    case 'DETACH_MOD': {
      const diceMods = s.round.diceMods.map((r, i) =>
        i === a.dieIdx ? r.filter((_, j) => j !== a.modIdx) : r,
      );
      return { state: { ...s, round: { ...s.round, diceMods } }, events: [] };
    }
    default:
      return { state: s, events: [] };
  }
};
