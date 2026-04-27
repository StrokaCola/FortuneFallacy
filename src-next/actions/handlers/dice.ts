import type { ActionHandler } from './types';
import { initialRoundSlice } from '../../state/slices/round';
import { lookupRune } from '../../core/runes';
import { maxRuneSlots } from '../../core/vouchers';

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
    case 'ATTACH_RUNE': {
      if (!lookupRune(a.runeId)) return { state: s, events: [] };
      const slots = s.round.diceRunes[a.dieIdx];
      if (!slots || slots.length >= maxRuneSlots(s)) return { state: s, events: [] };
      const diceRunes = s.round.diceRunes.map((r, i) => (i === a.dieIdx ? [...r, a.runeId] : r));
      return { state: { ...s, round: { ...s.round, diceRunes } }, events: [] };
    }
    case 'DETACH_RUNE': {
      const diceRunes = s.round.diceRunes.map((r, i) =>
        i === a.dieIdx ? r.filter((_, j) => j !== a.runeIdx) : r,
      );
      return { state: { ...s, round: { ...s.round, diceRunes } }, events: [] };
    }
    default:
      return { state: s, events: [] };
  }
};
