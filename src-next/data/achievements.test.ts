import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, lookupAchievement, ACHIEVEMENT_CATEGORIES } from './achievements';
import { initialMetaSlice } from '../state/slices/meta';
import { initialRunSlice } from '../state/slices/run';
import { initialRoundSlice } from '../state/slices/round';
import { initialShopSlice } from '../state/slices/shop';
import { initialUiSlice } from '../state/slices/ui';
import type { GameState } from '../state/store';
import type { GameEventEmission } from '../events/types';

function baseState(overrides: Partial<{
  catalysts: string[];
  catalystEditions: Record<string, string>;
  stakeId: string;
  constellationId: string;
  goalIdx: number;
  ante: number;
  score: number;
  target: number;
  cosmicDust: number;
  discovered: string[];
  stakeProgress: Record<string, string>;
  dailyHistory: Record<string, { cleared: boolean; score: number; ante: number; constellation: string; stake: string; playedAt: number }>;
}> = {}): GameState {
  const meta = initialMetaSlice();
  return {
    run: {
      ...initialRunSlice(),
      catalysts: overrides.catalysts ?? [],
      catalystEditions: overrides.catalystEditions as never ?? {},
      stakeId: overrides.stakeId ?? 'spark',
      constellationId: overrides.constellationId ?? 'lyra',
      goalIdx: overrides.goalIdx ?? 0,
      ante: overrides.ante ?? 1,
    },
    round: {
      ...initialRoundSlice(),
      score: overrides.score ?? 0,
      target: overrides.target ?? 250,
    },
    shop: initialShopSlice(),
    meta: {
      ...meta,
      cosmicDust: overrides.cosmicDust ?? 0,
      discovered: { ...meta.discovered, catalysts: overrides.discovered ?? [] },
      stakeProgress: overrides.stakeProgress ?? {},
      dailyHistory: overrides.dailyHistory ?? {},
    },
    ui: initialUiSlice(),
    pingCount: 0,
  } as unknown as GameState;
}

describe('ACHIEVEMENTS table', () => {
  it('has exactly 50 ascensions', () => {
    expect(ACHIEVEMENTS).toHaveLength(50);
  });

  it('has unique ids across the table', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
  });

  it('every achievement carries a non-zero dust reward', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.dust).toBeGreaterThan(0);
    }
  });

  it('every achievement has a known category', () => {
    const known = new Set(ACHIEVEMENT_CATEGORIES.map((c) => c.id));
    for (const a of ACHIEVEMENTS) {
      expect(known.has(a.category)).toBe(true);
    }
  });

  it('lookupAchievement finds known ids and returns undefined otherwise', () => {
    expect(lookupAchievement('first_blind')?.id).toBe('first_blind');
    expect(lookupAchievement('not_a_real_id')).toBeUndefined();
  });
});

describe('first-step triggers', () => {
  it('first_blind fires on the first onBlindCleared after goalIdx ≥ 1', () => {
    const def = lookupAchievement('first_blind')!;
    const state = baseState({ goalIdx: 1 });
    const event: GameEventEmission = {
      type: 'onBlindCleared',
      payload: { blindId: 'lesser', ante: 1, reward: { base: 5, voucher: 0, hands: 0, interest: 0, total: 5 } },
    };
    expect(def.check(state, event)).toBe(true);
  });

  it('first_catalyst fires on a catalyst BUY_OFFER', () => {
    const def = lookupAchievement('first_catalyst')!;
    const event: GameEventEmission = {
      type: 'onOfferBought',
      payload: { kind: 'catalyst', id: 'stratifier', price: 5 },
    };
    expect(def.check(baseState(), event)).toBe(true);
    // Doesn't trigger on non-catalyst purchases.
    const wrongKind: GameEventEmission = {
      type: 'onOfferBought',
      payload: { kind: 'voucher', id: 'bench', price: 8 },
    };
    expect(def.check(baseState(), wrongKind)).toBe(false);
  });

  it('first_win fires on a winning onRunEnded', () => {
    const def = lookupAchievement('first_win')!;
    const event: GameEventEmission = {
      type: 'onRunEnded',
      payload: { score: 10000, won: true, ante: 4, constellation: 'lyra' },
    };
    expect(def.check(baseState(), event)).toBe(true);
  });
});

describe('stake-ladder triggers', () => {
  for (const stake of ['spark', 'ember', 'pyre', 'beacon', 'nova', 'supernova']) {
    it(`stake_${stake} fires on a winning run with that stake active`, () => {
      const def = lookupAchievement(`stake_${stake}`)!;
      const state = baseState({ stakeId: stake });
      const event: GameEventEmission = {
        type: 'onRunEnded',
        payload: { score: 10000, won: true, ante: 4, constellation: 'lyra' },
      };
      expect(def.check(state, event)).toBe(true);
    });
  }
});

describe('score milestones', () => {
  it('score_5k fires when total >= 5000', () => {
    const def = lookupAchievement('score_5k')!;
    const event: GameEventEmission = {
      type: 'onScoreCalculated',
      payload: { combo: 'four_kind', chips: 100, mult: 50, total: 5000 },
    };
    expect(def.check(baseState(), event)).toBe(true);
  });

  it('score_5k does NOT fire below threshold', () => {
    const def = lookupAchievement('score_5k')!;
    const event: GameEventEmission = {
      type: 'onScoreCalculated',
      payload: { combo: 'two_pair', chips: 50, mult: 5, total: 250 },
    };
    expect(def.check(baseState(), event)).toBe(false);
  });

  it('score_1m fires only when total >= 1,000,000', () => {
    const def = lookupAchievement('score_1m')!;
    const above: GameEventEmission = {
      type: 'onScoreCalculated',
      payload: { combo: 'five_kind', chips: 1000, mult: 1000, total: 1_000_000 },
    };
    expect(def.check(baseState(), above)).toBe(true);
    const below: GameEventEmission = {
      type: 'onScoreCalculated',
      payload: { combo: 'four_kind', chips: 1000, mult: 999, total: 999_000 },
    };
    expect(def.check(baseState(), below)).toBe(false);
  });
});

describe('edition-collection triggers', () => {
  it('edition_void fires when any owned catalyst is void-stamped', () => {
    const def = lookupAchievement('edition_void')!;
    const state = baseState({ catalysts: ['x'], catalystEditions: { x: 'void' } });
    expect(def.check(state, null)).toBe(true);
  });

  it('edition_foil does not fire without any foil', () => {
    const def = lookupAchievement('edition_foil')!;
    const state = baseState({ catalysts: ['x'], catalystEditions: { x: 'holo' } });
    expect(def.check(state, null)).toBe(false);
  });
});

describe('codex triggers', () => {
  it('codex_25 fires at 25 discovered catalysts', () => {
    const def = lookupAchievement('codex_25')!;
    const ids = Array.from({ length: 25 }, (_, i) => `c${i}`);
    expect(def.check(baseState({ discovered: ids }), null)).toBe(true);
  });

  it('codex_25 does NOT fire below 25', () => {
    const def = lookupAchievement('codex_25')!;
    const ids = Array.from({ length: 24 }, (_, i) => `c${i}`);
    expect(def.check(baseState({ discovered: ids }), null)).toBe(false);
  });
});

describe('resonance triggers', () => {
  it('resonance_first fires when both halves of any pair are owned', () => {
    const def = lookupAchievement('resonance_first')!;
    // Symphony = Conductor + Encore (from data/resonances.ts)
    const state = baseState({ catalysts: ['conductor', 'encore'] });
    expect(def.check(state, null)).toBe(true);
  });

  it('resonance_first does NOT fire when only one half is owned', () => {
    const def = lookupAchievement('resonance_first')!;
    const state = baseState({ catalysts: ['conductor'] });
    expect(def.check(state, null)).toBe(false);
  });
});

describe('daily triggers', () => {
  it('daily_first_clear fires when at least one day has cleared:true', () => {
    const def = lookupAchievement('daily_first_clear')!;
    const state = baseState({
      dailyHistory: {
        '2026-05-08': { cleared: true, score: 0, ante: 4, constellation: 'lyra', stake: 'spark', playedAt: 0 },
      },
    });
    expect(def.check(state, null)).toBe(true);
  });

  it('daily_first_clear does NOT fire on bust-only history', () => {
    const def = lookupAchievement('daily_first_clear')!;
    const state = baseState({
      dailyHistory: {
        '2026-05-08': { cleared: false, score: 0, ante: 1, constellation: 'lyra', stake: 'spark', playedAt: 0 },
      },
    });
    expect(def.check(state, null)).toBe(false);
  });
});

describe('risk triggers', () => {
  it('risk_solo fires when winning with ≤3 catalysts', () => {
    const def = lookupAchievement('risk_solo')!;
    const event: GameEventEmission = {
      type: 'onRunEnded',
      payload: { score: 10000, won: true, ante: 4, constellation: 'lyra' },
    };
    expect(def.check(baseState({ catalysts: ['a', 'b'] }), event)).toBe(true);
    expect(def.check(baseState({ catalysts: ['a', 'b', 'c', 'd'] }), event)).toBe(false);
  });
});

describe('combo triggers', () => {
  it('combo_five_kind fires on a five-of-a-kind detection', () => {
    const def = lookupAchievement('combo_five_kind')!;
    const event: GameEventEmission = {
      type: 'onComboDetected',
      payload: { combo: 'five_kind', tier: 8 },
    };
    expect(def.check(baseState(), event)).toBe(true);
  });

  it('combo_five_kind does NOT fire on lower combos', () => {
    const def = lookupAchievement('combo_five_kind')!;
    const event: GameEventEmission = {
      type: 'onComboDetected',
      payload: { combo: 'two_pair', tier: 2 },
    };
    expect(def.check(baseState(), event)).toBe(false);
  });
});
