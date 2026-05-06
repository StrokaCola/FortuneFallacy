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
      // Held-only scoring contract: scoringOrder = locked die indices in
      // id-ascending order (visual left-to-right). Toggle resets any prior
      // REORDER_HOLD customization — drag should be applied AFTER all locks
      // are settled. This keeps lock-clicks predictable: face position drives
      // score order by default, drag overrides for the current state.
      const scoringOrder = lockedIdxs(dice);
      // Crescendo Run: locking a die breaks the streak. Unlocking does not.
      const rollsWithoutLock = newLocked ? 0 : (s.round.rollsWithoutLock ?? 0);
      return {
        state: { ...s, round: { ...s.round, dice, scoringOrder, rollsWithoutLock } },
        events: [{ type: 'onLockToggled', payload: { dieIdx: a.dieIdx, locked: newLocked } }],
      };
    }
    case 'RESET_ROUND':
      return { state: { ...s, round: initialRoundSlice() }, events: [] };
    case 'ATTACH_MOD': {
      if (!lookupMod(a.modId)) return { state: s, events: [] };
      const slots = s.run.diceMods[a.dieIdx];
      if (!slots || slots.length >= maxModSlots(s)) return { state: s, events: [] };
      // Mods are inventory items: must own one to attach. Consume on attach.
      const ownedIdx = s.run.ownedMods.indexOf(a.modId);
      if (ownedIdx < 0) return { state: s, events: [] };
      const ownedMods = s.run.ownedMods.filter((_, i) => i !== ownedIdx);
      const diceMods = s.run.diceMods.map((r, i) => (i === a.dieIdx ? [...r, a.modId] : r));
      // Sync parallel edition arrays. The edition at ownedIdx (which may be
      // null for plain mods) transfers to the new last slot of the die.
      const ownedEditions = s.run.ownedModEditions ?? [];
      const transferring = ownedEditions[ownedIdx] ?? null;
      const ownedModEditions = ownedEditions.filter((_, i) => i !== ownedIdx);
      const diceModEditionsCur = s.run.diceModEditions ?? s.run.diceMods.map(() => []);
      const diceModEditions = diceModEditionsCur.map((r, i) =>
        i === a.dieIdx ? [...(r ?? []), transferring] : r,
      );
      return {
        state: {
          ...s,
          run: { ...s.run, ownedMods, diceMods, ownedModEditions, diceModEditions },
        },
        events: [],
      };
    }
    case 'DETACH_MOD': {
      const detachedId = s.run.diceMods[a.dieIdx]?.[a.modIdx];
      const diceMods = s.run.diceMods.map((r, i) =>
        i === a.dieIdx ? r.filter((_, j) => j !== a.modIdx) : r,
      );
      // Detach returns the mod to the inventory (free swaps within shop budget).
      const ownedMods = detachedId ? [...s.run.ownedMods, detachedId] : s.run.ownedMods;
      // Sync parallel edition arrays. The edition at (dieIdx, modIdx)
      // travels back to ownedModEditions in the same slot order.
      const diceModEditionsCur = s.run.diceModEditions ?? s.run.diceMods.map(() => []);
      const detachedEdition = diceModEditionsCur[a.dieIdx]?.[a.modIdx] ?? null;
      const diceModEditions = diceModEditionsCur.map((r, i) =>
        i === a.dieIdx ? (r ?? []).filter((_, j) => j !== a.modIdx) : r,
      );
      const ownedModEditions = detachedId
        ? [...(s.run.ownedModEditions ?? []), detachedEdition]
        : (s.run.ownedModEditions ?? []);
      return {
        state: {
          ...s,
          run: { ...s.run, ownedMods, diceMods, ownedModEditions, diceModEditions },
        },
        events: [],
      };
    }
    case 'REORDER_HOLD': {
      const locked = lockedIdxs(s.round.dice);
      let reason: 'length-mismatch' | 'duplicate-index' | 'unlocked-index' | null = null;
      if (a.newOrder.length !== locked.length) reason = 'length-mismatch';
      else if (new Set(a.newOrder).size !== a.newOrder.length) reason = 'duplicate-index';
      else if (!a.newOrder.every((idx) => locked.includes(idx))) reason = 'unlocked-index';
      if (reason) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[REORDER_HOLD] invalid newOrder', a.newOrder, 'locked=', locked, 'reason=', reason);
        }
        return {
          state: s,
          events: [{ type: 'onReorderRejected', payload: { reason, newOrder: a.newOrder, locked } }],
        };
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
