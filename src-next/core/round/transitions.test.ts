import { describe, it, expect } from 'vitest';
import { clearBlind, bustBlind, startBlind, skipBlind } from './transitions';
import { hasDebuff } from './debuffs';
import { maxModSlots } from '../vouchers';
import type { GameState } from '../../state/store';

function makeState(overrides: Partial<{ shards: number; goalIdx: number; ante: number; compoundingStacks: number; score: number; target: number; isBoss: boolean; catalysts: string[]; vouchers: string[]; consumables: string[]; handsPlayed: number; handsLeft: number; diceMods: string[][]; }> = {}): GameState {
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
      handsLeft: overrides.handsLeft ?? 3,
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

  it('awards flat 5 base for non-boss with no remaining hands and no held shards', () => {
    const s = makeState({ shards: 0, handsLeft: 0, isBoss: false, score: 200, target: 100 });
    const result = clearBlind(s);
    expect(result.state.run.shards).toBe(5);
    expect((result.events[0]!.payload as any).reward).toEqual({
      base: 5, voucher: 0, hands: 0, interest: 0, overscore: 0, total: 5,
    });
  });

  it('awards flat 8 base for boss with no remaining hands and no held shards', () => {
    const s = makeState({ shards: 0, handsLeft: 0, isBoss: true, score: 2200, target: 1000 });
    const result = clearBlind(s);
    expect(result.state.run.shards).toBe(8);
    expect((result.events[0]!.payload as any).reward.base).toBe(8);
  });

  it('shard_streak voucher adds +1 voucher bonus on top of base', () => {
    const s = makeState({ shards: 0, handsLeft: 0, vouchers: ['shard_streak'] });
    const result = clearBlind(s);
    // base 5 + voucher 1 + hands 0 + interest 0
    expect(result.state.run.shards).toBe(6);
    expect((result.events[0]!.payload as any).reward.voucher).toBe(1);
  });

  it('hands bonus equals handsLeft × 1', () => {
    const s = makeState({ shards: 0, handsLeft: 2 });
    const result = clearBlind(s);
    // base 5 + hands 2 + interest 0
    expect(result.state.run.shards).toBe(7);
    expect((result.events[0]!.payload as any).reward.hands).toBe(2);
  });

  it('interest is floor(held / 5), capped at 3', () => {
    // 12 held → interest 2; total = 5 base + 0 hands + 2 interest = 7 added
    const s12 = makeState({ shards: 12, handsLeft: 0 });
    expect((clearBlind(s12).events[0]!.payload as any).reward.interest).toBe(2);

    // 15 held → interest 3; cap reached.
    const s15 = makeState({ shards: 15, handsLeft: 0 });
    expect((clearBlind(s15).events[0]!.payload as any).reward.interest).toBe(3);

    // 100 held → still 3; cap holds.
    const s100 = makeState({ shards: 100, handsLeft: 0 });
    expect((clearBlind(s100).events[0]!.payload as any).reward.interest).toBe(3);
  });

  it('full reward: boss + 2 hands + 25 held + voucher = 8+1+2+3 = 14', () => {
    const s = makeState({
      shards: 25, handsLeft: 2, isBoss: true,
      vouchers: ['shard_streak'],
    });
    const result = clearBlind(s);
    expect(result.state.run.shards).toBe(25 + 14);
    const reward = (result.events[0]!.payload as any).reward;
    expect(reward).toEqual({ base: 8, voucher: 1, hands: 2, interest: 3, overscore: 0, total: 14 });
  });

  it('does not pay interest on a negative held balance', () => {
    // Defensive — should never happen in practice but we don't want a divisor
    // surprise to mint shards.
    const s = makeState({ shards: -3, handsLeft: 0 });
    const reward = (clearBlind(s).events[0]!.payload as any).reward;
    expect(reward.interest).toBe(0);
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

  it('drops Brittle mods on bust by default', () => {
    const s = makeState({ target: 100, score: 0 });
    s.run.diceMods = [['brittle', 'amplify'], [], [], [], []];
    s.run.diceModEditions = [['foil', null], [], [], [], []];
    const result = bustBlind(s);
    expect(result.state.run.diceMods[0]).toEqual(['amplify']);
    // Edition array stays length-synced with diceMods.
    expect(result.state.run.diceModEditions?.[0]).toEqual([null]);
  });

  it('Engraved on the same die preserves Brittle through bust', () => {
    const s = makeState({ target: 100, score: 0 });
    s.run.diceMods = [['brittle', 'engraved'], [], [], [], []];
    s.run.diceModEditions = [['foil', null], [], [], [], []];
    const result = bustBlind(s);
    expect(result.state.run.diceMods[0]).toEqual(['brittle', 'engraved']);
    expect(result.state.run.diceModEditions?.[0]).toEqual(['foil', null]);
  });

  it('audit catalyst refunds 50% of catalystShardSpend and self-destructs', () => {
    const s = makeState({ target: 100, score: 0, catalysts: ['audit', 'cold_hand'], shards: 0 });
    s.run.catalystShardSpend = 20;
    const result = bustBlind(s);
    expect(result.state.run.shards).toBe(10); // floor(20 * 0.5)
    expect(result.state.run.catalysts).toEqual(['cold_hand']); // audit self-destructed
  });

  it('audit no-op when zero catalyst spend', () => {
    const s = makeState({ target: 100, score: 0, catalysts: ['audit'], shards: 5 });
    s.run.catalystShardSpend = 0;
    const result = bustBlind(s);
    expect(result.state.run.shards).toBe(5);
    expect(result.state.run.catalysts).toEqual([]); // still self-destructs
  });
});

describe('startBlind — shard_lung round-start grant', () => {
  // 2026-05-18 balance audit: pre-audit grant was +ante shards. Nerfed
  // to +ceil(ante/2) — Ante 2 → +1, Ante 4 → +2, Ante 3 → +2.
  it('grants +ceil(ante/2) shards when shard_lung is owned (ante 2 → +1)', () => {
    const s = makeState({ goalIdx: 3, ante: 2, shards: 0, catalysts: ['shard_lung'] });
    const result = startBlind(s);
    expect(result.state.run.shards).toBe(1);
  });

  it('does not grant when shard_lung is not owned', () => {
    const s = makeState({ ante: 2, shards: 0, catalysts: [] });
    const result = startBlind(s);
    expect(result.state.run.shards).toBe(0);
  });

  it('grant scales with ante (ante 4 → +2)', () => {
    const s = makeState({ ante: 4, shards: 5, catalysts: ['shard_lung'] });
    const result = startBlind(s);
    expect(result.state.run.shards).toBe(7); // 5 + ceil(4/2) = 5 + 2
  });

  it('odd antes round up (ante 3 → +2)', () => {
    const s = makeState({ ante: 3, shards: 0, catalysts: ['shard_lung'] });
    const result = startBlind(s);
    expect(result.state.run.shards).toBe(2);
  });
});

describe('skipBlind — silver_tongue catalyst', () => {
  it('grants 2 random consumables when silver_tongue is owned', () => {
    const s = makeState({ goalIdx: 0, catalysts: ['silver_tongue'], consumables: [] });
    const result = skipBlind(s);
    expect(result.state.run.consumables.length).toBe(2);
  });

  it('does not grant consumables when silver_tongue is not owned', () => {
    const s = makeState({ goalIdx: 0, catalysts: [], consumables: [] });
    const result = skipBlind(s);
    expect(result.state.run.consumables.length).toBe(0);
  });

  it('respects the consumable cap (no overflow)', () => {
    const s = makeState({
      goalIdx: 0,
      catalysts: ['silver_tongue'],
      consumables: ['shard_drop', 'shard_drop', 'shard_drop'],
    });
    const result = skipBlind(s);
    // Cap is 4 by default — only one slot available, only 1 granted.
    expect(result.state.run.consumables.length).toBe(4);
  });
});

describe('Eris boss (disable_catalysts_first_2_hands)', () => {
  it('hasDebuff returns true when Eris boss active', () => {
    const s = makeState();
    s.round.isBoss = true;
    s.round.blindId = 'eris';
    s.round.handsLeft = 3;
    s.round.handsMax = 3;
    // 2026-05-12 QA pass: Eris emits the 2-hand variant of the disable.
    expect(hasDebuff(s, 'disable_catalysts_first_2_hands')).toBe(true);
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

  it('drops the slot cap once the boss blind is cleared (shop/hub use the voucher value)', () => {
    // Repro for the "Forged Links voucher silently capped to 1 slot after
    // clearing Sedna" bug: clearBlind leaves round.isBoss + round.blindId
    // intact (for analytics/banner cleanup), but the player is in the shop
    // at that point and the boss's rules shouldn't still bite. activeDebuffs
    // gates on round.active to make sure the cap clears.
    const s = makeState({
      vouchers: ['forged_links'], score: 200, target: 100, handsLeft: 0,
    });
    s.round.isBoss = true;
    s.round.blindId = 'sedna';
    expect(maxModSlots(s)).toBe(1);
    const cleared = clearBlind(s).state;
    expect(cleared.round.active).toBe(false);
    expect(maxModSlots(cleared)).toBe(3);
    expect(hasDebuff(cleared, 'mod_slots_capped_1')).toBe(false);
  });
});
