import type { RunSlice } from '../../state/slices/run';

/**
 * Pure update for the cross-hand combo/tier tracking fields used by the
 * Tempo and Quorum catalysts. Called from SCORE_HAND immediately after
 * `handsPlayed` is incremented so the fields reflect the hand just played.
 *
 * Contract:
 * - `tempoStreak` increments only when `comboTier > tempoLastTier`.
 *   Resets to 0 on tie/decrease. -1 sentinel means "no prior hand".
 * - `comboStreak` increments only when `comboId === lastComboId`.
 *   Resets to 1 (this hand counts as #1) on mismatch.
 *
 * Both fields are run-scoped — they survive shop visits. Bust resets are
 * intentionally NOT done here: see transitions.ts (bust currently leaves
 * these fields alone; tempo/quorum builds get to keep their streak across
 * a soft-bust).
 */
export function updateComboStreaks(
  prev: RunSlice,
  combo: { id: string; tier: number } | null,
): Pick<RunSlice, 'tempoStreak' | 'tempoLastTier' | 'lastComboId' | 'comboStreak'> {
  if (!combo) {
    return {
      tempoStreak: prev.tempoStreak,
      tempoLastTier: prev.tempoLastTier,
      lastComboId: prev.lastComboId,
      comboStreak: prev.comboStreak,
    };
  }
  const tempoStreak = combo.tier > prev.tempoLastTier && prev.tempoLastTier >= 0
    ? prev.tempoStreak + 1
    : combo.tier > prev.tempoLastTier
      ? 1 // first hand of the run
      : 0;
  const comboStreak = combo.id === prev.lastComboId ? prev.comboStreak + 1 : 1;
  return {
    tempoStreak,
    tempoLastTier: combo.tier,
    lastComboId: combo.id,
    comboStreak,
  };
}
