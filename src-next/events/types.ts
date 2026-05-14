import type { Phase } from '../core/pipeline/types';
import type { Beat, ScoreSequence } from '../core/scoring/types';
import type { DieShape } from '../data/dice';

export type DieSnapshot = {
  id: number;
  face: number;
  locked: boolean;
};

export type SimulationRequest = {
  diceToRoll: number[];
  seed: number;
  // Per-die rolled value (game state). For Lyra/Mensa this also matches the
  // spatial face index, but for Fibonacci ([1,1,2,3,5,8]), Eclipse
  // ([0,0,0,1,1,1]), or Ophiuchus ([1..5,WILD]) the value diverges from the
  // spatial index — use `predeterminedFaceIdx` for orientation in that case.
  predeterminedFaces: number[];
  // 1-based spatial face index for orientation (which physical face of the
  // polyhedron should land up). Defaults to `predeterminedFaces` when absent —
  // sufficient for d6 with `faces: [1..6]` and any dN with `faces: [1..N]`,
  // where value === spatial index.
  predeterminedFaceIdx?: number[];
  // Per-die shape (d4/d6/d8/d10/d12/d20). Drives the rapier collider and
  // the per-shape face axes used by `faceCorrection`. Length matches
  // `predeterminedFaces`. Older callers may omit; rapierSim falls back to d6.
  diceShapes?: DieShape[];
  // Banish-face family (2026-05-13) — per-die count of value-pick
  // substitutions that happened in initSimulation's retry loop. Drives
  // the Dice3D pop-up + re-tumble visual and the Pyre Pact milestone
  // counter. 0 = no substitution; positive = die's initial pick was
  // banished and re-rolled. Length matches predeterminedFaces.
  banishSubstitutions?: number[];
};

export type DieFrame = { px: number; py: number; pz: number; qx: number; qy: number; qz: number; qw: number };

export type SimulationResult = {
  finalFaces: number[];
  restPositions: { x: number; y: number; z: number }[];
  settleMs: number[];
  peakVelocity: number;
  collisionCount: number;
  // Per-pair collision events captured from rapier's drain callback during
  // the physics tumble. Each entry [a, b] is two die indices that started
  // touching in the same step. Order within the pair matches rapier handle
  // order — pair-based catalysts should treat [a,b] and [b,a] as equivalent.
  // Optional: synth/test sim paths may omit it, in which case readers fall
  // back to using collisionCount alone.
  collisionPairs?: Array<[number, number]>;
  bounceHeights: number[];
  cameraShake?: number;
  frames?: DieFrame[][];
};

export type SimMetrics = {
  chaos: number;
  impact: number;
  settle: number;
  sync: number;
};

export type ComboId = string;
export type UpgradeId = string;
export type BlindId = string;

export type ShopOffer = {
  kind: 'catalyst' | 'voucher' | 'consumable' | 'mod' | 'pack';
  id: string;
  price: number;
  // Catalyst-only: foil/holo/poly stamp rolled at offer time. Carried
  // through BUY_OFFER into run.catalystEditions. See state/slices/run.ts.
  edition?: 'foil' | 'holo' | 'poly';
};

export type GameEventMap = {
  onPing:              { msg: string };
  onRollStart:         { dice: DieSnapshot[]; lockedMask: boolean[] };
  onSimulationStart:   { request: SimulationRequest };
  onSimulationEnd:     { result: SimulationResult };
  onRollEnd:           { faces: number[]; metrics: SimMetrics };
  onScoreCalculated:   { combo: ComboId; chips: number; mult: number; total: number };
  onUpgradeTriggered:  { id: UpgradeId; phase: Phase; deltaChips: number; deltaMult: number };
  onModFired:          { dieIdx: number; modId: string; faceValue: number };
  onComboDetected:     { combo: ComboId; tier: number };
  onBlindCleared:      {
    blindId: BlindId;
    ante: number;
    reward: {
      base: number;       // flat per-blind reward (5 / 8)
      voucher: number;    // shard_streak voucher bonus (0 or 1 today)
      hands: number;      // unused-hands bonus (handsLeft × 1)
      interest: number;   // floor(held/5), cap 5
      overscore?: number; // 2026-05-12 overscore bonus, 0..5 — see clearBlind
      total: number;      // sum of the above — what was added to s.run.shards
    };
  };
  onBossRevealed:      { blindId: BlindId; ante: number };
  onRunEnded:          { score: number; won: boolean; ante: number; constellation: string };
  onShopOpened:        { offers: ShopOffer[] };
  onLockToggled:       { dieIdx: number; locked: boolean };
  onOfferBought:       { kind: ShopOffer['kind']; id: string; price: number };
  onUpgradeSold:       { kind: ShopOffer['kind']; id: string; refund: number };
  onScoreBeat:         { beat: Beat };
  onScoreSequenceBuilt: { sequence: ScoreSequence };
  onReorderRejected:   { reason: 'length-mismatch' | 'duplicate-index' | 'unlocked-index'; newOrder: number[]; locked: number[] };
  onGalaxyUsed:        { galaxyId: string; combo: ComboId | 'all'; levelsAdded: Record<ComboId, number> };
  onPackOpened:        { kind: string; galaxyIds: string[]; picksAllowed: number };
  onPackPicked:        { galaxyId: string; remainingPicks: number };
  onPackClosed:        { kind: string; pickedCount: number; skippedCount: number };
  onGalaxyDiscovered:  { galaxyId: string };
  // Cosmic Dust: emitted when dust is awarded by clearBlind/bustBlind/win.
  // `delta` is positive for grants, `total` is meta.cosmicDust after the grant.
  onDustEarned:        { delta: number; total: number; reason: 'clear' | 'bust' | 'win' };
  onAstralPerkBought:  { perkId: string; cost: number };
  // Fired once per achievement-unlock dispatch. Drives the celebration
  // toast and any future SFX layer. Payload includes the achievement's
  // display name + dust grant so listeners don't need to lookup the
  // table themselves.
  onAchievementUnlocked: { achievementId: string; dust: number; name: string };
  // Fired once per blind when the player hits 3 consecutive hands above
  // the per-hand-share threshold (target × 2/3). Drives the Hot Streak
  // banner. Sticky for the rest of the blind so subsequent hot hands
  // don't re-fire the banner.
  onHotStreak: { length: number };
  // Fired once per boss blind when the second-wind trigger fires and
  // the boss promotes from phase 1 to phase 2. Drives the
  // BossPhaseBanner cinematic. Sticky for the rest of the blind because
  // bossPhase only transitions 1→2 (never back).
  onBossSecondWind: {
    blindId: string;
    flavor: string;
    addedDebuffs: string[];
    removedDebuffs: string[];
  };
  // Banish-face family (2026-05-13) — fired once per die per roll when
  // the initSimulation retry loop substituted the die's predetermined
  // value. Drives the Dice3D pop-up + re-tumble animation. `substitutions`
  // is the number of retries that fired on this die this roll (≥1).
  onDieBanishTriggered: {
    dieIdx: number;
    substitutions: number;
    finalFace: number;
  };
  // Mod attached to a die in the Forge. Drives the attach SFX + a small
  // visual pulse on the die that just received the mod.
  onModAttached: { dieIdx: number; modId: string };
  // Mod removed from a die — fires the detach SFX so the swap reads as
  // a real two-step interaction.
  onModDetached: { dieIdx: number; modId: string };
  // Sell-trigger fired — a catalyst's on-sell payoff (Stipend, Audit,
  // Compounding Bias) ran. Drives the celebration toast + chime so
  // the player sees the bonus they got from selling.
  onSellTrigger: {
    catalystId: string;
    label: string;
    shardsBefore: number;
    shardsAfter: number;
  };
  // Cross-target moment — every die's accent edge briefly catches a
  // bright sweep so the dice themselves acknowledge the goal-cross.
  // Decoupled from ScoreMoment so Dice3D handles the per-die material
  // animation without ScoreMoment needing scene access.
  onCrystallineEdgeCatch: { color: string };
};

export type GameEventEmission = {
  [K in keyof GameEventMap]: { type: K; payload: GameEventMap[K] };
}[keyof GameEventMap];
