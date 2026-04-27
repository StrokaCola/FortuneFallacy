import type { GameState } from '../../state/store';
import type { GameEventEmission } from '../../events/types';
import { BLIND_DEFS, BOSS_BLINDS, targetForBlind } from '../../data/blinds';
import { initialRoundSlice } from '../../state/slices/round';
import { blindClearShardBonus } from '../vouchers';

export function startBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const ante = s.run.ante;
  const blindIndex = s.run.goalIdx % 3;
  const def = BLIND_DEFS[blindIndex]!;
  const target = targetForBlind(ante, blindIndex);
  const isBoss = def.isBoss;
  const blindId = isBoss
    ? BOSS_BLINDS[Math.floor(Math.random() * BOSS_BLINDS.length)]!.id
    : def.name.toLowerCase().replace(/\s+/g, '_');
  return {
    state: {
      ...s,
      ui: { ...s.ui, screen: 'round' },
      round: {
        ...initialRoundSlice(),
        active: true,
        blindId,
        blindIndex,
        isBoss,
        target,
      },
    },
    events: isBoss
      ? [{ type: 'onBossRevealed', payload: { blindId, ante: s.run.ante } }]
      : [],
  };
}

export function clearBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const baseReward = (s.round.isBoss ? 8 : 5) + blindClearShardBonus(s);
  const overflow = s.round.score - s.round.target;
  let overchargeBonus = 0;
  if (s.round.target > 0 && overflow >= Math.floor(s.round.target * 0.5)) {
    overchargeBonus = Math.min(20, Math.floor(overflow / Math.max(50, s.round.target / 10)));
  }
  const reward = baseReward + overchargeBonus;
  const nextGoal = s.run.goalIdx + 1;
  const nextAnte = Math.floor(nextGoal / 3) + 1;
  const won = nextGoal >= 12;
  const highScores = won ? pushHighScore(s, s.round.score) : s.meta.highScores;
  return {
    state: {
      ...s,
      run: {
        ...s.run,
        shards: s.run.shards + reward,
        goalIdx: nextGoal,
        ante: nextAnte,
      },
      round: { ...s.round, active: false },
      ui: { ...s.ui, screen: won ? 'win' : 'shop' },
      meta: won ? { ...s.meta, highScores } : s.meta,
    },
    events: [
      {
        type: 'onBlindCleared',
        payload: { blindId: s.round.blindId ?? 'unknown', ante: s.run.ante },
      },
    ],
  };
}

export function bustBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  if (s.round.target > 0 && s.round.score >= Math.floor(s.round.target * 0.75)) {
    const droppedOracles = s.run.oracles.length > 0 ? s.run.oracles.slice(1) : [];
    const nextGoal = s.run.goalIdx + 1;
    const nextAnte = Math.floor(nextGoal / 3) + 1;
    return {
      state: {
        ...s,
        run: { ...s.run, oracles: droppedOracles, goalIdx: nextGoal, ante: nextAnte },
        round: { ...s.round, active: false, chainLen: 0, chainTier: -1 },
        ui: { ...s.ui, screen: 'shop' },
      },
      events: [{ type: 'onBlindCleared', payload: { blindId: s.round.blindId ?? 'soft_bust', ante: s.run.ante } }],
    };
  }
  const highScores = pushHighScore(s, s.round.score);
  return {
    state: {
      ...s,
      ui: { ...s.ui, screen: 'hub' },
      round: { ...s.round, active: false },
      meta: { ...s.meta, highScores },
    },
    events: [],
  };
}

function pushHighScore(s: GameState, score: number) {
  if (score <= 0) return s.meta.highScores;
  const next = [
    ...s.meta.highScores,
    { name: s.meta.playerName || 'anon', score, date: Date.now() },
  ];
  next.sort((a, b) => b.score - a.score);
  return next.slice(0, 10);
}

import { BLIND_DEFS as DEFS } from '../../data/blinds';
const SKIP_TAGS = [
  { id: 'shard',   label: '+5 shards' },
  { id: 'reroll',  label: '+1 reroll next round' },
  { id: 'hand',    label: '+1 hand next round' },
];

export function skipBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const blindIdx = s.run.goalIdx % 3;
  const def = DEFS[blindIdx]!;
  if (def.isBoss) return { state: s, events: [] };
  const reward = def.skipReward;
  const tag = SKIP_TAGS[Math.floor(Math.random() * SKIP_TAGS.length)]!;
  let nextState: GameState = {
    ...s,
    run: { ...s.run, shards: s.run.shards + reward, goalIdx: s.run.goalIdx + 1 },
  };
  if (tag.id === 'shard') {
    nextState = { ...nextState, run: { ...nextState.run, shards: nextState.run.shards + 5 } };
  } else if (tag.id === 'reroll') {
    nextState = { ...nextState, round: { ...nextState.round, rerollsLeft: s.round.rerollsLeft + 1 } };
  } else if (tag.id === 'hand') {
    nextState = { ...nextState, round: { ...nextState.round, handsLeft: s.round.handsLeft + 1 } };
  }
  const nextAnte = Math.floor(nextState.run.goalIdx / 3) + 1;
  nextState = { ...nextState, run: { ...nextState.run, ante: nextAnte } };
  return { state: nextState, events: [] };
}
