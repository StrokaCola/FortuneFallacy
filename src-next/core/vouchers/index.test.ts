import { describe, it, expect } from 'vitest';
import {
  extraHandsPerRound,
  freeShopReroll,
  maxConsumableSlots,
  maxModSlots,
} from './index';
import type { GameState } from '../../state/store';

function makeState(overrides: Partial<{ vouchers: string[]; isBoss: boolean; blindId: string }> = {}): GameState {
  return {
    run: {
      seed: 1,
      shards: 0,
      ante: 1,
      goalIdx: 0,
      catalysts: [],
      vouchers: overrides.vouchers ?? [],
      consumables: [],
      handsPlayed: 0,
      compoundingStacks: 0,
    },
    round: {
      active: true,
      blindId: overrides.blindId ?? null,
      blindIndex: 0,
      isBoss: overrides.isBoss ?? false,
      target: 100,
      score: 0,
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

describe('extraHandsPerRound', () => {
  it('returns 1 if open_mic owned', () => {
    expect(extraHandsPerRound(makeState({ vouchers: ['open_mic'] }))).toBe(1);
  });
  it('returns 0 otherwise', () => {
    expect(extraHandsPerRound(makeState())).toBe(0);
  });
});

describe('freeShopReroll', () => {
  it('returns true if free_refresh owned', () => {
    expect(freeShopReroll(makeState({ vouchers: ['free_refresh'] }))).toBe(true);
  });
  it('returns false otherwise', () => {
    expect(freeShopReroll(makeState())).toBe(false);
  });
});

describe('maxConsumableSlots', () => {
  it('returns 5 if capacity owned', () => {
    expect(maxConsumableSlots(makeState({ vouchers: ['capacity'] }))).toBe(5);
  });
  it('returns 4 otherwise', () => {
    expect(maxConsumableSlots(makeState())).toBe(4);
  });
});

describe('maxModSlots', () => {
  it('returns 2 by default', () => {
    expect(maxModSlots(makeState())).toBe(2);
  });
  it('returns 3 if forged_links owned', () => {
    expect(maxModSlots(makeState({ vouchers: ['forged_links'] }))).toBe(3);
  });
  it.todo('returns 1 if mod_slots_capped_1 debuff active (covered in T4)');
});
