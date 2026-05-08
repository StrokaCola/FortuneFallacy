import type { GameState } from '../../state/store';
import { lookupStake } from '../../data/stakes';
import { lookupChallenge, type ChallengeOverlay } from '../../data/challenges';

// Aggregates run-wide difficulty modifiers from BOTH the active stake and any
// active challenge into a single struct. Multipliers compose multiplicatively;
// deltas compose additively. Keep this as the single read point so we don't
// re-derive at every call site.

export type StakeContext = {
  targetMult: number;
  handsDelta: number;
  rerollsDelta: number;
  shopPriceMult: number;
  /** True when the active overlay disables the post-blind shop entirely. */
  shopDisabled: boolean;
  /** True when forge entry is forbidden (e.g. Iron Run challenge). */
  forgeDisabled: boolean;
  /** True when consumable use is forbidden across the whole run. */
  consumablesLocked: boolean;
  /** Optional cap on simultaneous catalyst slots. 0 = no cap. */
  catalystCap: number;
};

const DEFAULT_CTX: StakeContext = {
  targetMult: 1,
  handsDelta: 0,
  rerollsDelta: 0,
  shopPriceMult: 1,
  shopDisabled: false,
  forgeDisabled: false,
  consumablesLocked: false,
  catalystCap: 0,
};

export function stakeContext(s: GameState): StakeContext {
  const stake = lookupStake(s.run.stakeId);
  const challenge: ChallengeOverlay | null = s.run.challengeId
    ? lookupChallenge(s.run.challengeId)?.overlay ?? null
    : null;
  return {
    targetMult: stake.targetMult * (challenge?.targetMult ?? 1),
    handsDelta: stake.handsDelta + (challenge?.handsDelta ?? 0),
    rerollsDelta: stake.rerollsDelta + (challenge?.rerollsDelta ?? 0),
    shopPriceMult: stake.shopPriceMult * (challenge?.shopPriceMult ?? 1),
    shopDisabled: !!challenge?.shopDisabled,
    forgeDisabled: !!challenge?.forgeDisabled,
    consumablesLocked: !!challenge?.consumablesLocked,
    catalystCap: challenge?.catalystCap ?? 0,
  };
}

export function emptyStakeContext(): StakeContext {
  return { ...DEFAULT_CTX };
}

const BASE_REROLLS_PER_HAND = 2;

/** Reroll budget per hand under the active stake/challenge. Floored at 0.
 *  Dice Master catalyst (if owned) grants +1; this is the only catalyst
 *  that nudges reroll budget directly, so the read site stays cheap. */
export function rerollsPerHand(s: GameState): number {
  const catalystBonus = s.run.catalysts.includes('dice_master') ? 1 : 0;
  return Math.max(0, BASE_REROLLS_PER_HAND + stakeContext(s).rerollsDelta + catalystBonus);
}
