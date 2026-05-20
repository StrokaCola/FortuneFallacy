// Hand-curated sample payloads for every event in GameEventMap.
// The `satisfies` check at the bottom enforces parity at type-check time;
// missing keys produce a TS error rather than a runtime surprise.
//
// When a new event is added to events/types.ts, add a sample here.

import type { GameEventMap } from '../../events/types';
import { Phase } from '../../core/pipeline/types';

export const eventSamples: { [K in keyof GameEventMap]: GameEventMap[K] } = {
  onPing: { msg: 'hello' },
  onRollStart: {
    dice: [
      { id: 0, face: 3, locked: false },
      { id: 1, face: 5, locked: true },
    ],
    lockedMask: [false, true],
  },
  onSimulationStart: {
    request: {
      diceToRoll: [0, 1, 2, 3, 4],
      seed: 12345,
      predeterminedFaces: [1, 2, 3, 4, 5],
    },
  },
  onSimulationEnd: {
    result: {
      finalFaces: [1, 2, 3, 4, 5],
      restPositions: [],
      settleMs: [],
      peakVelocity: 0,
      collisionCount: 0,
      bounceHeights: [],
    },
  },
  onRollEnd: {
    faces: [1, 2, 3, 4, 5],
    metrics: { chaos: 0.5, impact: 0.5, settle: 0.5, sync: 0.5 },
  },
  onScoreCalculated: { combo: 'straight', chips: 120, mult: 4, total: 480 },
  onUpgradeTriggered: { id: 'big_one', phase: Phase.UPGRADES, deltaChips: 30, deltaMult: 0 },
  onModFired: { dieIdx: 0, modId: 'edge_scoring', faceValue: 6 },
  onComboDetected: { combo: 'five-kind', tier: 5 },
  onBlindCleared: {
    blindId: 'small',
    ante: 1,
    reward: { base: 5, voucher: 0, hands: 2, interest: 1, total: 8 },
  },
  onBossRevealed: { blindId: 'boss_taxman', ante: 1 },
  onRunEnded: { score: 12345, won: true, ante: 8, constellation: 'lyra' },
  onShopOpened: {
    offers: [
      { kind: 'catalyst', id: 'stipend', price: 4 },
      { kind: 'voucher', id: 'shard_streak', price: 10 },
    ],
  },
  onLockToggled: { dieIdx: 0, locked: true },
  onOfferBought: { kind: 'catalyst', id: 'stipend', price: 4 },
  onUpgradeSold: { kind: 'catalyst', id: 'stipend', refund: 2 },
  onScoreBeat: {
    beat: {
      kind: 'mult-slam',
      t: 0,
      label: 'x4',
      multiplier: 4,
      pitchSemis: 0,
      ampScale: 1,
    },
  },
  onScoreSequenceBuilt: {
    sequence: { beats: [], tier: 'short', totalDurMs: 600 },
  },
  onReorderRejected: { reason: 'length-mismatch', newOrder: [], locked: [] },
  onGalaxyUsed: { galaxyId: 'andromeda', combo: 'all', levelsAdded: {} },
  onPackOpened: { kind: 'standard', galaxyIds: ['andromeda', 'cygnus'], picksAllowed: 1 },
  onPackPicked: { galaxyId: 'andromeda', remainingPicks: 0 },
  onPackClosed: { kind: 'standard', pickedCount: 1, skippedCount: 1 },
  onGalaxyDiscovered: { galaxyId: 'andromeda' },
  onDustEarned: { delta: 3, total: 27, reason: 'clear' },
  onAstralPerkBought: { perkId: 'starting_bank', cost: 50 },
  onAchievementUnlocked: { achievementId: 'first_run', dust: 10, name: 'First Steps' },
  onHotStreak: { length: 3 },
  onModAttached: { dieIdx: 0, modId: 'edge_scoring' },
  onModDetached: { dieIdx: 0, modId: 'edge_scoring' },
  onSellTrigger: { catalystId: 'stipend', label: 'Stipend', shardsBefore: 5, shardsAfter: 9 },
  onBossSecondWind: {
    blindId: 'pluto',
    flavor: 'the gambler\'s bones tighten — fewer dice answer the call.',
    addedDebuffs: ['hand_size_cap_4'],
    removedDebuffs: [],
  },
  onMultTierCross: { fromTier: 1, toTier: 2, accent: '#ffcc66' },
  onLockClickRipple: { x: 100, y: 100, locked: true },
  onDieBanishTriggered: { dieIdx: 0, substitutions: 1, finalFace: 6 },
  onCrystallineEdgeCatch: { color: '#ffcc66' },
  onMeteorShowerTriggered: { accent: '#ffcc66', count: 5 },
  onScoreCounterFill: { durationMs: 600 },
  onCelebrationAfterglow: { durationMs: 800 },
  onNearBust: { tension: 0.7 },
  onSafe: {},
  onStormIncoming: { stormId: 'sample_storm', bindIdx: 0 },
  onCatalystDiscovered: { catalystId: 'stipend', total: 1 },
  onEditionDiscovered: { edition: 'foil', catalystId: 'stipend' },
  onLastHandOfBlind: { handsLeft: 1, target: 100, score: 50 },
  onSynergyBurst: { pairCount: 3, resonanceIds: ['resonance:symphony'] },
  onBossPhase2Incoming: { blindId: 'pluto', trigger: 'half-target' },
  onBlindAboutToStart: { blindId: 'small', ante: 1, isBoss: false },
  onTheaterPhase: { phase: 'ramping' },
} satisfies { [K in keyof GameEventMap]: GameEventMap[K] };

export const eventKeys: (keyof GameEventMap)[] = Object.keys(eventSamples) as (keyof GameEventMap)[];
