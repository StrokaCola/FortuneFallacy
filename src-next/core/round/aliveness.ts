// Aliveness selectors (2026-05-18). Derived state for the ambient
// reactions layer. Pure functions over GameState — testable in the
// existing deterministic-sim harness without any rendering.
//
// Three signals:
//   * isOneRollFromBust  — gated 0..1 tension when bust is imminent
//   * peekNextStorm      — voidstorm id one blind ahead (null if none)
//   * isClutch           — current cusp roll likely to decide the blind
//
// These keep the listener at `app/listeners/aliveness.ts` decoupled
// from gameplay state — the listener just samples and dispatches.

import type { GameState } from '../../state/store';
import { getVoidstormForBlind } from './voidstorms';

// Returns a 0..1 tension value. Zero means "comfortable", 1 means
// "this very next hand decides whether the blind clears or busts".
//
// Heuristic — no peek-ahead needed since the player already feels
// the same pressure. Uses target-coverage and remaining-hands:
//   * Not active / boss-cleared / score >= target → 0
//   * handsLeft > 1 → ramp from 0..0.4 with how much of target remains
//   * handsLeft === 1 → ramp 0.4..1 weighted by missing-fraction
//   * handsLeft === 0 (rare interstitial frame) → 1
//
// The intent is a calm zero across most play, a perceptible 0.3-0.5
// in middle-of-blind crunch, and a strong 0.7+ when one bad hand
// ends the run.
export function aliveTension(s: GameState): number {
  const r = s.round;
  if (!r.active) return 0;
  if (r.target <= 0) return 0;
  const missing = Math.max(0, r.target - r.score);
  if (missing <= 0) return 0;
  const ratio = Math.min(1, missing / r.target);
  if (r.handsLeft <= 0) return 1;
  if (r.handsLeft === 1) return 0.4 + ratio * 0.6;
  if (r.handsLeft === 2) return Math.min(0.4, ratio * 0.5);
  return Math.min(0.25, ratio * 0.3);
}

// True when the player is one bad roll from bust. Drives the
// onNearBust dispatch — listener only fires when this flips true.
// Hysteresis lives in the listener so this stays a pure selector.
export function isOneRollFromBust(s: GameState): boolean {
  return aliveTension(s) >= 0.65;
}

// Returns the voidstorm id that will spawn on the NEXT non-boss
// blind given the current run state. Null if the next blind is a
// boss or the deterministic pick rolls no storm. Used for the
// telegraph dispatch one blind ahead.
//
// Boss blinds are blindIndex === 2. The "next blind" is at
// (goalIdx + 1) modulo a 3-blind ante.
export function peekNextStorm(s: GameState): string | null {
  const nextGoal = s.run.goalIdx + 1;
  const nextBlindIndex = nextGoal % 3;
  const nextIsBoss = nextBlindIndex === 2;
  return getVoidstormForBlind(s.run.seed, nextGoal, nextIsBoss);
}

// "Clutch" = the next roll could realistically tip the blind into
// a clear when it's tightly within reach. Drives the camera nudge.
// Defined as: active blind, handsLeft <= 2, score within 25% of
// target — not yet over, but in spitting distance.
export function isClutch(s: GameState): boolean {
  const r = s.round;
  if (!r.active || r.target <= 0) return false;
  if (r.handsLeft > 2) return false;
  if (r.score >= r.target) return false;
  const missing = r.target - r.score;
  return missing <= r.target * 0.25;
}
