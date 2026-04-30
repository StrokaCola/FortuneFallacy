import type { ActionHandler } from './types';
import { initialRoundSlice } from '../../state/slices/round';
import { lookupMod } from '../../core/mods';
import { maxModSlots } from '../../core/vouchers';

function lockedIdxs(dice: { locked: boolean }[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < dice.length; i++) if (dice[i]!.locked) out.push(i);
  return out;
}

export const diceHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'TOGGLE_LOCK': {
      const target = s.round.dice[a.dieIdx];
      if (!target) return { state: s, events: [] };
      const newLocked = !target.locked;
      const dice = s.round.dice.map((d, i) =>
        i === a.dieIdx ? { ...d, locked: newLocked } : d,
      );
      let scoringOrder = s.round.scoringOrder ?? [];
      if (newLocked) {
        if (!scoringOrder.includes(a.dieIdx)) scoringOrder = [...scoringOrder, a.dieIdx];
      } else {
        scoringOrder = scoringOrder.filter((i) => i !== a.dieIdx);
      }
      return {
        state: { ...s, round: { ...s.round, dice, scoringOrder } },
        events: [{ type: 'onLockToggled', payload: { dieIdx: a.dieIdx, locked: newLocked } }],
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
    case 'REORDER_HOLD': {
      const locked = lockedIdxs(s.round.dice);
      const valid =
        a.newOrder.length === locked.length &&
        new Set(a.newOrder).size === a.newOrder.length &&
        a.newOrder.every((idx) => locked.includes(idx));
      if (!valid) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[REORDER_HOLD] invalid newOrder', a.newOrder, 'locked=', locked);
        }
        return { state: s, events: [] };
      }
      return {
        state: { ...s, round: { ...s.round, scoringOrder: a.newOrder } },
        events: [],
      };
    }
    default:
      return { state: s, events: [] };
  }
};
