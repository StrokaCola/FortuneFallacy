// Pure helpers that translate the active tutorial step into the
// engine-facing overrides (predetermined dice faces, scripted shop offers,
// pre-equipped starter catalyst). Kept side-effect-free so handlers can
// import freely without circular-dep risk.

import type { GameState } from '../../../state/store';
import type { ShopOffer } from '../../../events/types';
import { lookupStep } from './tutorialScript';

// Starter catalyst pre-equipped when the tour begins. Stratifier fires
// on Full House, which the scripted first hand reaches — guarantees the
// player sees a catalyst payout on their first scored hand.
export const TUTORIAL_STARTER_CATALYST = 'stratifier';

// Pre-credit shards so the recommended buy is affordable. Tops up only
// if the player has fewer; never reduces a fuller wallet.
export const TUTORIAL_MIN_SHARDS = 8;

// Fixed shop offer set shown when the tour reaches Shop. Three offers
// mirror the natural shop's count (catalyst + voucher + mod).
//   - compounding_bias (catalyst, 5) is the recommended buy.
//   - shard_streak (voucher, 6) is the "skip this one" teaching beat.
//   - risk (mod, 4) is filler so the layout matches a real shop.
// Offers are returned in order so step `t_shop_recommend` can advance
// on `BUY_OFFER` with `offerIdx === 0`.
export const TUTORIAL_SHOP_OFFERS: readonly ShopOffer[] = [
  { kind: 'catalyst', id: 'compounding_bias', price: 5 },
  { kind: 'voucher', id: 'shard_streak', price: 6 },
  { kind: 'mod', id: 'risk', price: 4 },
];

// Returns the dice faces the next roll should produce for unlocked dice,
// or null if the active step doesn't override roll output. Caller is
// responsible for skipping locked dice in the actual override (locked
// dice always preserve their face).
export function facesForStep(stepId: GameState['tutorial']['step']): readonly number[] | null {
  const step = lookupStep(stepId);
  if (!step?.diceFaces) return null;
  return step.diceFaces;
}

// Apply the scripted dice override to a predeterminedFaces array. Length
// is preserved; unlocked indices get the scripted face, locked stay put.
// If the scripted face vector is shorter than the dice count, the tail
// is left untouched (defensive — should never happen for d5/d6 specs).
export function applyScriptedFaces(
  original: readonly number[],
  lockedMask: readonly boolean[],
  scripted: readonly number[],
): number[] {
  const out = [...original];
  for (let i = 0; i < out.length; i++) {
    if (lockedMask[i]) continue;
    if (i >= scripted.length) continue;
    out[i] = scripted[i]!;
  }
  return out;
}

// Tutorial preconditions for the engine's three injection points. Each is
// a single-call check so handlers stay readable.
export function isTutorialActive(s: GameState): boolean {
  return s.tutorial?.active === true;
}

export function tutorialStepIs(s: GameState, ...ids: GameState['tutorial']['step'][]): boolean {
  if (!isTutorialActive(s)) return false;
  return ids.includes(s.tutorial.step);
}
