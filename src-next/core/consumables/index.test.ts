import { describe, it, expect } from 'vitest';
import { CONSUMABLES, lookupConsumable } from './index';
import type { GameState } from '../../state/store';

function makeState(): GameState {
  return {
    run: {
      seed: 1, shards: 0, ante: 1, goalIdx: 0,
      catalysts: [], vouchers: [], consumables: [],
      handsPlayed: 0, compoundingStacks: 0,
    },
    round: {
      active: true, blindId: null, blindIndex: 0, isBoss: false,
      target: 100, score: 0, handsLeft: 3, handsMax: 3, rerollsLeft: 2,
      dice: Array.from({ length: 5 }, (_, id) => ({ id, face: 1, locked: false })),
      hand: [], handInProgress: false, scoring: false,
      chainLen: 0, chainTier: -1, diceMods: [],
      shardSinkPrimedThisHand: false,
    },
    meta: { playerName: 'test', highScores: [] },
    ui: { screen: 'round', paused: false },
    shop: { open: false, offers: [], rerollCost: 0 },
    pingCount: 0,
  } as unknown as GameState;
}

describe('pin_three', () => {
  it('sets target die face to 3', () => {
    const def = lookupConsumable('pin_three')!;
    const result = def.apply(makeState(), [2]);
    expect(result.state.round.dice[2]?.face).toBe(3);
  });
  it('no-op if target index invalid', () => {
    const def = lookupConsumable('pin_three')!;
    const result = def.apply(makeState(), [99]);
    expect(result.state.round.dice[2]?.face).toBe(1);
  });
});

describe('spare_reroll', () => {
  it('increments rerollsLeft by 1', () => {
    const def = lookupConsumable('spare_reroll')!;
    const result = def.apply(makeState(), []);
    expect(result.state.round.rerollsLeft).toBe(3);
  });
});

describe('CONSUMABLES roster', () => {
  it('contains 6 base entries + 10 galaxies (9 combo galaxies + Quasar)', () => {
    expect(CONSUMABLES.length).toBe(16);
  });

  it('every galaxy has type=galaxy and a comboId', () => {
    const galaxies = CONSUMABLES.filter((c) => c.type === 'galaxy');
    expect(galaxies.length).toBe(10);
    for (const g of galaxies) {
      expect(g.comboId).toBeDefined();
    }
  });
});
