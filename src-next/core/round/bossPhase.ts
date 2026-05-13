// Boss Phase Escalation (Pillar B) — pure helper for deciding whether
// a boss promotes from phase 1 to phase 2 after a SCORE_HAND. Each boss
// in BOSS_BLINDS owns a `secondWind` block with a trigger and the
// debuffs that come online (or, for Callisto, come off) when it fires.
//
// Triggers:
//   - 'hand-2'       fires after a scored hand IF the player has made
//                     real progress (newScore ≥ target/3) AND at least
//                     one hand has been spent. This avoids triggering
//                     on a flunked first hand; phase-2 is a *climax*
//                     beat, not a piling-on punishment when the player
//                     is already struggling. Capped at half the hand
//                     budget so it never fires on the literal last
//                     hand (use 'last-hand' for that beat).
//   - 'half-target'  fires the instant the running score crosses 50% of
//                     target (and the blind hasn't already cleared).
//   - 'last-hand'    fires when only one hand remains after the score —
//                     i.e. the player is about to play the final hand.
//
// Callers pass the post-score state (newScore, newHandsLeft) and the
// pending end flag so a hand that clears or busts doesn't trigger a
// pointless phase change — the blind is over anyway.

import { BOSS_BLINDS } from '../../data/blinds';
import type { BossSecondWind } from '../../data/blinds';
import { stakeIndex } from '../../data/stakes';

// Minimum stake index at which boss phase 2 fires. Spark (0) and Ember
// (1) stay on legacy single-phase boss debuffs — the beginner stakes
// are already a tight needle on fragile constellations (Fibonacci,
// Argo), so the escalation feature only engages at Pyre (2) and above
// where players have unlocked enough run-economy to absorb mid-blind
// rule changes.
const PHASE_ESCALATION_MIN_STAKE = 2;

export type BossPhaseEvalInput = {
  isBoss: boolean;
  blindId: string | null;
  bossPhase: 1 | 2;
  stakeId: string;
  newScore: number;
  newHandsLeft: number;
  handsMax: number;
  target: number;
  pendingRoundEnd: 'clear' | 'bust' | null;
};

export type BossPhaseEvalResult =
  | { promote: false }
  | { promote: true; secondWind: BossSecondWind };

export function evaluateBossPhase(input: BossPhaseEvalInput): BossPhaseEvalResult {
  if (!input.isBoss || !input.blindId) return { promote: false };
  if (input.bossPhase !== 1) return { promote: false };
  if (input.pendingRoundEnd) return { promote: false };
  // Stake gate — phase 2 is a Pyre+ feature. Spark / Ember keep the
  // legacy single-phase boss feel so the beginner ladder stays
  // approachable.
  if (stakeIndex(input.stakeId) < PHASE_ESCALATION_MIN_STAKE) return { promote: false };
  const def = BOSS_BLINDS.find((b) => b.id === input.blindId);
  if (!def?.secondWind) return { promote: false };
  const sw = def.secondWind;
  // hand-2 gate: at least one hand spent, at least one hand still
  // available (i.e. NOT the last hand — last-hand is its own trigger),
  // and score has crossed 1/3 of target. The combined gate keeps the
  // escalation as a player-success climax rather than punishing a
  // flunked opening hand. Floors at handsMax >= 2 to handle the
  // pathological case where a stake / debuff pushes max hands to 1.
  const hand2Fired =
    sw.trigger === 'hand-2' &&
    input.handsMax >= 2 &&
    input.newHandsLeft < input.handsMax &&
    input.newHandsLeft > 0 &&
    input.target > 0 &&
    input.newScore >= input.target / 3 &&
    input.newScore < input.target;
  const halfTargetFired =
    sw.trigger === 'half-target' &&
    input.target > 0 &&
    input.newScore >= input.target / 2 &&
    input.newScore < input.target;
  const lastHandFired =
    sw.trigger === 'last-hand' && input.newHandsLeft === 1;
  const fired = hand2Fired || halfTargetFired || lastHandFired;
  return fired ? { promote: true, secondWind: sw } : { promote: false };
}
