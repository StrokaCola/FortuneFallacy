// Score projection (2026-05-18 P1). Pre-roll decision-clarity helper —
// computes the expected score from the current locked-dice configuration
// without running the full pipeline. Cheap enough to recompute on every
// lock toggle / roll / reroll.
//
// Strategy: project the BEST combo achievable from the currently locked
// dice faces alone. Unlocked dice are treated as wildcards that won't
// downgrade the combo. This understates upside (catalyst chains, edition
// fires, chain mults) and ignores per-die mod contributions — so the
// chip is presented as "~N" to set expectations.
//
// Returns null when no projection is meaningful (round inactive, no
// dice, all unlocked). The TopBar chip hides on null.

import type { GameState } from '../../state/store';
import type { DieSnapshot } from '../../events/types';
import { detectCombo } from './detectCombo';
import { lookupConstellation } from '../../data/constellations';

const PROJECTION_FALLBACK_FACE = 0;

/**
 * Project the score if the player committed the current hand right now.
 * Returns null when projection isn't useful (no locked dice / no round).
 *
 * Math:
 *   1. Collect faces of locked dice.
 *   2. Run combo detection on those faces. With <2 locked dice the result
 *      is always Chance (tier 0) — that's a valid floor projection.
 *   3. Base = comboChips + extraChipsFromLockedFaces (each locked face
 *      contributes its value to chips per the standard scoring rule).
 *   4. Mult = comboMult.
 *   5. Final = base * mult.
 *
 * Catalysts/editions/mods/chain are NOT included. Real score will land
 * higher in most cases.
 */
export function projectScore(state: GameState): number | null {
  if (!state.round.active || state.round.target <= 0) return null;
  const dice: DieSnapshot[] = state.round.dice ?? [];
  if (dice.length === 0) return null;
  const lockedFaces = dice
    .filter((d) => d.locked)
    .map((d) => (typeof d.face === 'number' ? d.face : PROJECTION_FALLBACK_FACE));
  if (lockedFaces.length === 0) return null;

  const constellation = lookupConstellation(state.run.constellationId);
  const comboCtx = {
    comboCountBonus: constellation?.modifiers?.comboCountBonus ?? 0,
    straightLenBonus: constellation?.modifiers?.straightLenBonus ?? 0,
    diceCount: dice.length,
  };
  const combo = detectCombo(lockedFaces, { comboCtx });

  // Each scoring face adds its value to the base chips. Faces of locked
  // dice that DON'T match the combo's scoring set still contribute on
  // "Chance" — keep the projection simple and add all locked face values.
  // Real pipeline restricts to scoring faces only; using all locked
  // produces a slight overestimate on partial-combo hands which we accept
  // as the "best-case-if-you-lock-now" framing.
  const extraChips = lockedFaces.reduce((sum, f) => sum + (Number.isFinite(f) ? f : 0), 0);

  // Apply constellation base mods if any (Eclipse/Ophiuchus halve base).
  const baseChipsMult = constellation?.modifiers?.baseChipsMult ?? 1;
  const baseMultMult = constellation?.modifiers?.baseMultMult ?? 1;
  const chips = Math.round((combo.chips + extraChips) * baseChipsMult);
  const mult = combo.mult * baseMultMult;
  return Math.max(0, Math.round(chips * mult));
}
