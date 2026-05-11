import { BOSS_BLINDS } from '../../data/blinds';
import type { GameState } from '../../state/store';

export type Debuff =
  | 'no_rerolls'
  | 'disable_catalysts'
  | 'auto_unlock_after_roll'
  | 'hand_size_cap_4'
  | 'no_mod_transforms_on_ones'
  | 'disable_catalysts_first_hand'
  | 'mod_slots_capped_1'
  | 'consumables_locked';

export function activeDebuffs(s: GameState): Set<Debuff> {
  if (!s.round.isBoss || !s.round.blindId) return new Set();
  const def = BOSS_BLINDS.find((b) => b.id === s.round.blindId);
  const debuffs = new Set((def?.debuffs ?? []) as Debuff[]);
  // Eris Apple easter egg — once the player has scored an all-prime hand
  // in Eris's blind, her catalyst-disable-on-first-hand debuff is lifted
  // for the rest of the blind. The flag clears on START_BLIND.
  if (s.round.blindId === 'eris' && s.round.errisAppleFlipped) {
    debuffs.delete('disable_catalysts_first_hand');
  }
  return debuffs;
}

export function hasDebuff(s: GameState, d: Debuff): boolean {
  return activeDebuffs(s).has(d);
}
