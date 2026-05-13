import type { DieSnapshot } from '../../events/types';

export type RoundSlice = {
  active: boolean;
  blindId: string | null;
  blindIndex: number;
  isBoss: boolean;
  target: number;
  score: number;
  handsLeft: number;
  handsMax: number;
  rerollsLeft: number;
  dice: DieSnapshot[];
  hand: number[];
  handInProgress: boolean;
  scoring: boolean;
  firstRollDone: boolean;
  chainLen: number;
  chainTier: number;
  shardSinkPrimedThisHand: boolean;
  // Recursive Sink: set by SCORE_HAND when both shard_sink and recursive_sink
  // own + can afford the surcharge. Catalyst applies its ×1.25 mult only when
  // this flag is true.
  recursiveSinkPrimedThisHand: boolean;
  // Tithe budget for this hand: the per-die shard cost is consumed from this
  // counter inside `applyDieModStep`. Set to `min(run.shards, scoringDieCount)`
  // by SCORE_HAND before running the pipeline.
  tithePrimedThisHand: number;
  firstHandPlayed: boolean;
  // All-Band catalyst (legendary) — set true the first time it fires this
  // round; the catalyst skips itself thereafter. Resets on round start
  // because `initialRoundSlice()` is spread when a new blind begins.
  allBandUsedThisRound: boolean;
  // Crescendo Run catalyst — counts rolls (ROLL_REQUESTED + REROLL_REQUESTED)
  // since the last die was locked this round. Reset to 0 on lock; gates the
  // ×2 mult bonus at >= 3.
  rollsWithoutLock: number;
  scoringOrder: number[];
  // Hot Streak tracking — counts consecutive hands that scored above
  // the per-hand-share threshold (target * 2/3) in the current trial.
  // Resets on START_BLIND and on any hand below threshold. Reaching 3
  // emits onHotStreak and surfaces the celebration banner.
  hotHandsInRow: number;
  // Sticky once the streak fires, so we don't re-emit the banner on
  // subsequent qualifying hands within the same trial. Resets on
  // START_BLIND alongside the counter.
  hotStreakFiredThisBlind: boolean;
  // Voidstorm — per-blind modifier ID picked at START_BLIND. ~25% of
  // non-boss blinds roll one. See core/round/voidstorms.ts. Null when
  // no storm is active.
  voidstormId: string | null;
  // Boss Phase Escalation (Pillar B) — boss blinds escalate mid-blind.
  // Phase 1 is the legacy state (only base debuffs apply). Phase 2 fires
  // when the boss's `secondWind.trigger` is met (after a SCORE_HAND), and
  // unions the second-wind debuffs (or, for Callisto, removes a base
  // debuff). Non-boss blinds stay at 1. Saved state from before this
  // shipped defaults to 1 via persistence migration.
  bossPhase: 1 | 2;
  lastScoringCtx?: {
    combo: { id: string; tier: number } | null;
    chips: number;
    mult: number;
    chain: { mult: number };
    total: number;
    events: Array<{ type: string; payload: { id: string; phase: number; deltaChips: number; deltaMult: number } }>;
    state: { round: { dice: Array<{ face: number }>; scoringOrder?: number[] } };
  } | null;
  pendingRoundEnd?: 'clear' | 'bust' | null;
  pendingScoreDelta?: number | null;
  // Eris Apple easter egg — set true for the current Eris blind once the
  // player has scored an all-prime hand. Inverts `disable_catalysts_first_hand`
  // for the remainder of the blind. Resets on START_BLIND.
  errisAppleFlipped: boolean;
  // Mirrored Hand easter egg — consumed (set true) once the first-hand
  // retrigger has fired for this blind. Prevents repeat retriggers on
  // subsequent hands.
  mirroredHandConsumed: boolean;
  // True for the very first ROLL_SETTLED of the very first hand of the
  // very first blind of the run. Pi Approximation easter egg looks at
  // this flag once and then it stays false for the rest of the run.
  piApproxArmed: boolean;
  // Comet Trail catalyst — set true whenever USE_CONSUMABLE fires during
  // this blind. clearBlind checks this and resets the catalyst's stack
  // counter if any consumable was used.
  consumableUsedThisBlind: boolean;
};

export const initialRoundSlice = (): RoundSlice => ({
  active: false,
  blindId: null,
  blindIndex: 0,
  isBoss: false,
  target: 0,
  score: 0,
  handsLeft: 3,
  handsMax: 3,
  rerollsLeft: 2,
  dice: Array.from({ length: 5 }, (_, id) => ({ id, face: 1, locked: true })),
  hand: [],
  handInProgress: false,
  scoring: false,
  firstRollDone: false,
  chainLen: 0,
  chainTier: -1,
  shardSinkPrimedThisHand: false,
  recursiveSinkPrimedThisHand: false,
  tithePrimedThisHand: 0,
  firstHandPlayed: false,
  allBandUsedThisRound: false,
  rollsWithoutLock: 0,
  scoringOrder: [0, 1, 2, 3, 4],
  hotHandsInRow: 0,
  hotStreakFiredThisBlind: false,
  voidstormId: null,
  bossPhase: 1,
  errisAppleFlipped: false,
  mirroredHandConsumed: false,
  piApproxArmed: false,
  consumableUsedThisBlind: false,
});
