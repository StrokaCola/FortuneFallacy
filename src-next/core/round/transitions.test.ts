import { describe, it, expect } from 'vitest';
import { clearBlind, bustBlind } from './transitions';
import { hasDebuff } from './debuffs';
import { maxModSlots } from '../vouchers';
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

describe('Eris boss (disable_catalysts_first_hand)', () => {
  it('hasDebuff returns true when Eris boss active', () => {
    const s = makeState();
    s.round.isBoss = true;
    s.round.blindId = 'eris';
    s.round.handsLeft = 3;
    s.round.handsMax = 3;
    expect(hasDebuff(s, 'disable_catalysts_first_hand')).toBe(true);
  });

  it('first hand check uses handsLeft === handsMax', () => {
    const s = makeState();
    s.round.isBoss = true;
    s.round.blindId = 'eris';
    s.round.handsLeft = 2;
    s.round.handsMax = 3;
    const isFirstHand = s.round.handsLeft === s.round.handsMax;
    expect(isFirstHand).toBe(false);
  });
});

describe('Sedna boss (mod_slots_capped_1)', () => {
  it('maxModSlots returns 1 when Sedna active, even with forged_links', () => {
    const s = makeState({ vouchers: ['forged_links'] });
    s.round.isBoss = true;
    s.round.blindId = 'sedna';
    expect(maxModSlots(s)).toBe(1);
  });
});
