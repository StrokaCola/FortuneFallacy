import { describe, it, expect } from 'vitest';
import { clearBlind, bustBlind } from './transitions';
import type { GameState } from '../../state/store';

function makeState(overrides: Partial<{ shards: number; goalIdx: number; ante: number; compoundingStacks: number; score: number; target: number; isBoss: boolean; catalysts: string[]; vouchers: string[]; consumables: string[]; handsPlayed: number; }> = {}): GameState {
  return {
    run: {
      seed: 1,
      shards: overrides.shards ?? 0,
      ante: overrides.ante ?? 1,
      goalIdx: overrides.goalIdx ?? 0,
      catalysts: overrides.catalysts ?? [],
      vouchers: overrides.vouchers ?? [],
      consumables: overrides.consumables ?? [],
      handsPlayed: overrides.handsPlayed ?? 0,
      compoundingStacks: overrides.compoundingStacks ?? 0,
    },
    round: {
      active: true,
      blindId: 'small_blind',
      blindIndex: 0,
      isBoss: overrides.isBoss ?? false,
      target: overrides.target ?? 100,
      score: overrides.score ?? 100,
      handsLeft: 3,
      handsMax: 3,
      rerollsLeft: 2,
      dice: [],
      hand: [],
      handInProgress: false,
      scoring: false,
      chainLen: 0,
      chainTier: -1,
      diceMods: [],
      shardSinkPrimedThisHand: false,
    },
    meta: { playerName: 'test', highScores: [] },
    ui: { screen: 'round', paused: false },
    shop: { open: false, offers: [], rerollCost: 0 },
    pingCount: 0,
  } as unknown as GameState;
}

describe('clearBlind', () => {
  it('increments compoundingStacks by 1', () => {
    const s = makeState({ compoundingStacks: 2, score: 200, target: 100 });
    const result = clearBlind(s);
    expect(result.state.run.compoundingStacks).toBe(3);
  });
});

describe('bustBlind', () => {
  it('soft-bust branch resets compoundingStacks to 0', () => {
    const s = makeState({ compoundingStacks: 5, target: 100, score: 80, catalysts: ['cold_hand'] });
    const result = bustBlind(s);
    expect(result.state.run.compoundingStacks).toBe(0);
  });

  it('hard-bust branch resets compoundingStacks to 0', () => {
    const s = makeState({ compoundingStacks: 7, target: 100, score: 10 });
    const result = bustBlind(s);
    expect(result.state.run.compoundingStacks).toBe(0);
  });
});
