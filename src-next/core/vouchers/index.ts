import type { GameState } from '../../state/store';
import { VOUCHERS } from '../../data/vouchers';
import { hasDebuff } from '../round/debuffs';

export function ownsVoucher(s: GameState, id: string): boolean {
  return s.run.vouchers.includes(id);
}

export function maxCatalystSlots(s: GameState): number {
  return ownsVoucher(s, 'bench') ? 7 : 6;
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
