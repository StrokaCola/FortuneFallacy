import { BOSS_BLINDS } from '../../data/blinds';
import type { GameState } from '../../state/store';

export type Debuff =
  | 'no_rerolls'
  | 'disable_catalysts'
  | 'auto_unlock_after_roll'
  | 'hand_size_cap_4'
  | 'no_mod_transforms_on_ones'
  // 2026-05-12 QA pass: Eris was buffed from 1 → 2 hands of catalyst-
  // disable. The legacy 'disable_catalysts_first_hand' tag is kept as a
  // valid debuff type for back-compat (saved Eris-blind state could
  // surface it), but new Eris boss data emits 'disable_catalysts_first_2_hands'.
  | 'disable_catalysts_first_hand'
  | 'disable_catalysts_first_2_hands'
  | 'mod_slots_capped_1'
  | 'consumables_locked';

export function activeDebuffs(s: GameState): Set<Debuff> {
  if (!s.round.isBoss || !s.round.blindId) return new Set();
  const def = BOSS_BLINDS.find((b) => b.id === s.round.blindId);
  const debuffs = new Set((def?.debuffs ?? []) as Debuff[]);
  // Eris Apple easter egg — once the player has scored an all-prime hand
  // in Eris's blind, her catalyst-disable debuff is lifted for the rest
  // of the blind. The flag clears on START_BLIND.
  if (s.round.blindId === 'eris' && s.round.errisAppleFlipped) {
    debuffs.delete('disable_catalysts_first_hand');
    debuffs.delete('disable_catalysts_first_2_hands');
  }
  return debuffs;
}

export function hasDebuff(s: GameState, d: Debuff): boolean {
  return activeDebuffs(s).has(d);
}
