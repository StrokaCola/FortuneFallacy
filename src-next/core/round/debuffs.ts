import { BOSS_BLINDS } from '../../data/blinds';
import type { GameState } from '../../state/store';

export type Debuff =
  | 'no_rerolls'
  | 'disable_oracles'
  | 'auto_unlock_after_roll'
  | 'hand_size_cap_4'
  | 'no_rune_transforms_on_ones';

export function activeDebuffs(s: GameState): Set<Debuff> {
  if (!s.round.isBoss || !s.round.blindId) return new Set();
  const def = BOSS_BLINDS.find((b) => b.id === s.round.blindId);
  return new Set((def?.debuffs ?? []) as Debuff[]);
}

export function hasDebuff(s: GameState, d: Debuff): boolean {
  return activeDebuffs(s).has(d);
}
