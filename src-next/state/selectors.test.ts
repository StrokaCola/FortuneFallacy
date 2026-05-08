import { describe, it, expect } from 'vitest';
import {
  selectScreen, selectScore, selectTarget, selectShards, selectAnte,
  selectGoalIdx, selectDice, selectHandsLeft, selectRerollsLeft, selectPingCount,
  selectChainLen, selectChainTier, selectRoundActive, selectBlindId, selectIsBoss,
  selectShopOffers, selectShopRerollCost, selectCatalysts, selectVouchers,
  selectPlayerName, selectTensionFromState, selectAccent,
} from './selectors';
import { lookupConstellation } from '../data/constellations';
import type { GameState } from './store';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    run: {
      seed: 1, shards: 10, ante: 2, goalIdx: 3,
      constellationId: 'lyra',
      catalysts: ['catalyst_a', 'catalyst_b'],
      vouchers: ['bench'],
      consumables: [], ownedMods: [],
      diceMods: Array.from({ length: 5 }, () => [] as string[]),
      handsPlayed: 0, compoundingStacks: 0, rollCounter: 0,
      tempoStreak: 0, tempoLastTier: -1, lastComboId: null, comboStreak: 0,
    },
    round: {
      active: true, blindId: 'hydra', blindIndex: 1, isBoss: true,
      target: 500, score: 200, handsLeft: 2, handsMax: 3, rerollsLeft: 1,
      dice: [{ id: 0, face: 3, locked: false }, { id: 1, face: 5, locked: true }],
      hand: [], handInProgress: false, scoring: false, firstRollDone: true,
      chainLen: 2, chainTier: 1,
      shardSinkPrimedThisHand: false, recursiveSinkPrimedThisHand: false,
      tithePrimedThisHand: 0, firstHandPlayed: true,
      scoringOrder: [0, 1],
    },
    shop: { open: false, offers: [{ kind: 'catalyst', id: 'x', price: 3 }], rerollCost: 7 },
    meta: { playerName: 'Tester', unlocks: [], highScores: [] },
    ui: { screen: 'round', paused: false, tooltip: null, transition: 'idle' },
    pingCount: 4,
    ...overrides,
  } as unknown as GameState;
}

describe('simple field selectors', () => {
  it('selectScreen', () => expect(selectScreen(makeState())).toBe('round'));
  it('selectScore', () => expect(selectScore(makeState())).toBe(200));
  it('selectTarget', () => expect(selectTarget(makeState())).toBe(500));
  it('selectShards', () => expect(selectShards(makeState())).toBe(10));
  it('selectAnte', () => expect(selectAnte(makeState())).toBe(2));
  it('selectGoalIdx', () => expect(selectGoalIdx(makeState())).toBe(3));
  it('selectHandsLeft', () => expect(selectHandsLeft(makeState())).toBe(2));
  it('selectRerollsLeft', () => expect(selectRerollsLeft(makeState())).toBe(1));
  it('selectPingCount', () => expect(selectPingCount(makeState())).toBe(4));
  it('selectChainLen', () => expect(selectChainLen(makeState())).toBe(2));
  it('selectChainTier', () => expect(selectChainTier(makeState())).toBe(1));
  it('selectRoundActive', () => expect(selectRoundActive(makeState())).toBe(true));
  it('selectBlindId', () => expect(selectBlindId(makeState())).toBe('hydra'));
  it('selectIsBoss', () => expect(selectIsBoss(makeState())).toBe(true));
  it('selectShopRerollCost', () => expect(selectShopRerollCost(makeState())).toBe(7));
  it('selectCatalysts', () => expect(selectCatalysts(makeState())).toEqual(['catalyst_a', 'catalyst_b']));
  it('selectVouchers', () => expect(selectVouchers(makeState())).toEqual(['bench']));
  it('selectPlayerName', () => expect(selectPlayerName(makeState())).toBe('Tester'));

  it('selectDice returns array', () => {
    const dice = selectDice(makeState());
    expect(Array.isArray(dice)).toBe(true);
    expect(dice).toHaveLength(2);
  });

  it('selectShopOffers returns offers array', () => {
    const offers = selectShopOffers(makeState());
    expect(offers).toHaveLength(1);
    expect(offers[0]?.id).toBe('x');
  });
});

describe('selectTensionFromState', () => {
  it('returns a number between 0 and 1 for a normal scoring state', () => {
    const t = selectTensionFromState(makeState());
    expect(typeof t).toBe('number');
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(1);
  });

  it('returns 0 for target=0 (no-op tension)', () => {
    const state = makeState();
    const noTarget = { ...state, round: { ...state.round, target: 0, scoring: false } } as unknown as GameState;
    const t = selectTensionFromState(noTarget);
    expect(t).toBeGreaterThanOrEqual(0);
  });

  it('increases as handsLeft decreases', () => {
    const base = makeState();
    const manyHands = { ...base, round: { ...base.round, handsLeft: 3, score: 0, target: 500, scoring: false } } as unknown as GameState;
    const fewHands = { ...base, round: { ...base.round, handsLeft: 1, score: 0, target: 500, scoring: false } } as unknown as GameState;
    const tMany = selectTensionFromState(manyHands);
    const tFew = selectTensionFromState(fewHands);
    expect(tFew).toBeGreaterThanOrEqual(tMany);
  });
});

describe('selectAccent', () => {
  it('returns the constellation color when not on a boss blind', () => {
    const base = makeState();
    const notBoss = { ...base, round: { ...base.round, isBoss: false } } as unknown as GameState;
    expect(selectAccent(notBoss)).toBe(lookupConstellation('lyra').color);
  });

  it('returns boss red regardless of constellation when on a boss blind', () => {
    const base = makeState({ round: { ...makeState().round, isBoss: true } } as unknown as Partial<GameState>);
    expect(selectAccent(base)).toBe('#e2334a');
  });

  it('switches color per constellation', () => {
    const base = makeState();
    const argo = { ...base,
      run: { ...base.run, constellationId: 'argo' },
      round: { ...base.round, isBoss: false },
    } as unknown as GameState;
    const mensa = { ...base,
      run: { ...base.run, constellationId: 'mensa' },
      round: { ...base.round, isBoss: false },
    } as unknown as GameState;
    expect(selectAccent(argo)).toBe(lookupConstellation('argo').color);
    expect(selectAccent(mensa)).toBe(lookupConstellation('mensa').color);
    expect(selectAccent(argo)).not.toBe(selectAccent(mensa));
  });
});
