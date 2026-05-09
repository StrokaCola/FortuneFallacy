import type { GameState } from '../../state/store';
import { VOUCHERS } from '../../data/vouchers';
import { hasDebuff } from '../round/debuffs';
import { getCatalystSlotBonus } from '../run/diceContext';
import { stakeContext } from '../run/stakeContext';
import { editionTakesSlot } from '../upgrades/editions';

export function ownsVoucher(s: GameState, id: string): boolean {
  return s.run.vouchers.includes(id);
}

export function maxCatalystSlots(s: GameState): number {
  const base = ownsVoucher(s, 'bench') ? 7 : 6;
  const computed = base + getCatalystSlotBonus(s);
  const cap = stakeContext(s).catalystCap;
  return cap > 0 ? Math.min(cap, computed) : computed;
}

// Effective slot count: catalysts.length minus any catalysts whose
// edition is 'void' (which occupy zero slots). This is what the slot
// cap is checked against, what the TopBar shows the player, and what
// the bench-voucher sell guard uses to ensure the player doesn't
// strand themselves over the post-sell cap.
export function effectiveCatalystSlotsUsed(s: GameState): number {
  const editions = s.run.catalystEditions ?? {};
  let used = 0;
  for (const id of s.run.catalysts) {
    if (editionTakesSlot(editions[id])) used++;
  }
  return used;
}

export function maxModSlots(s: GameState): number {
  if (hasDebuff(s, 'mod_slots_capped_1')) return 1;
  return ownsVoucher(s, 'forged_links') ? 3 : 2;
}

export function blindClearShardBonus(s: GameState): number {
  return ownsVoucher(s, 'shard_streak') ? 1 : 0;
}

export function extraHandsPerRound(s: GameState): number {
  return ownsVoucher(s, 'open_mic') ? 1 : 0;
}

export function freeShopReroll(s: GameState): boolean {
  return ownsVoucher(s, 'free_refresh');
}

export function maxConsumableSlots(s: GameState): number {
  return ownsVoucher(s, 'capacity') ? 5 : 4;
}

export { VOUCHERS };
