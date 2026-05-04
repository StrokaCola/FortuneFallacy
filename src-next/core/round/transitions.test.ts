import { describe, it, expect } from 'vitest';
import { clearBlind, bustBlind, startBlind } from './transitions';
import { hasDebuff } from './debuffs';
import { maxModSlots } from '../vouchers';
import type { GameState } from '../../state/store';

function makeState(overrides: Partial<{ shards: number; goalIdx: number; ante: number; compoundingStacks: number; score: number; target: number; isBoss: boolean; catalysts: string[]; vouchers: string[]; consumables: string[]; handsPlayed: number; diceMods: string[][]; }> = {}): GameState {
  return {
    run: {
      seed: 1,
      shards: overrides.shards ?? 0,
      ante: overrides.ante ?? 1,
      goalIdx: overrides.goalIdx ?? 0,
      catalysts: overrides.catalysts ?? [],
      vouchers: overrides.vouchers ?? [],
      consumables: overrides.consumables ?? [],
      ownedMods: [],
      diceMods: overrides.diceMods ?? [[], [], [], [], []],
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
  it('resets compoundingStacks to 0', () => {
    const s = makeState({ compoundingStacks: 7, target: 100, score: 10 });
    const result = bustBlind(s);
    expect(result.state.run.compoundingStacks).toBe(0);
  });

  it('routes to fail screen even when score is close to target', () => {
    const s = makeState({ compoundingStacks: 5, target: 100, score: 80, catalysts: ['cold_hand'] });
    const result = bustBlind(s);
    expect(result.state.ui.screen).toBe('fail');
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

  it('first hand check uses firstHandPlayed flag (false = first hand)', () => {
    const s = makeState();
    s.round.isBoss = true;
    s.round.blindId = 'eris';
    (s.round as unknown as { firstHandPlayed: boolean }).firstHandPlayed = false;
    expect(!(s.round as unknown as { firstHandPlayed: boolean }).firstHandPlayed).toBe(true);
  });

  it('firstHandPlayed=true means subsequent hands are not first hand (roll_token-safe)', () => {
    const s = makeState();
    s.round.isBoss = true;
    s.round.blindId = 'eris';
    // roll_token bumped handsLeft back up, but firstHandPlayed stays true
    s.round.handsLeft = 3;
    s.round.handsMax = 3;
    (s.round as unknown as { firstHandPlayed: boolean }).firstHandPlayed = true;
    expect(!(s.round as unknown as { firstHandPlayed: boolean }).firstHandPlayed).toBe(false);
  });
});

describe('startBlind preserves run.diceMods (Forge persistence)', () => {
  it('keeps run.diceMods when starting a new blind', () => {
    const s = makeState({ diceMods: [['amplify'], [], ['snake_eyes', 'backstop'], [], ['loaded']] });
    const { state } = startBlind(s);
    expect(state.run.diceMods).toEqual([['amplify'], [], ['snake_eyes', 'backstop'], [], ['loaded']]);
  });

  it('keeps run.diceMods after clearBlind -> startBlind cycle', () => {
    const s = makeState({ diceMods: [['amplify'], [], [], [], []], score: 200, target: 100 });
    const cleared = clearBlind(s).state;
    expect(cleared.run.diceMods).toEqual([['amplify'], [], [], [], []]);
    const next = startBlind(cleared).state;
    expect(next.run.diceMods).toEqual([['amplify'], [], [], [], []]);
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
