import type { GameState } from '../../state/store';
import { VOUCHERS } from '../../data/vouchers';

export function ownsVoucher(s: GameState, id: string): boolean {
  return s.run.vouchers.includes(id);
}

export function maxOracleSlots(s: GameState): number {
  return ownsVoucher(s, 'astral_plane') ? 7 : 6;
}

export function maxRuneSlots(s: GameState): number {
  return ownsVoucher(s, 'forged_links') ? 3 : 2;
}

export function blindClearShardBonus(s: GameState): number {
  return ownsVoucher(s, 'shard_streak') ? 1 : 0;
}

export { VOUCHERS };
