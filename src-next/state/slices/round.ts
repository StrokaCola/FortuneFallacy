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
});
