import { describe, it, expect } from 'vitest';
import { consumableHandler } from './consumable';
import type { GameState } from '../../state/store';

const baseState = (overrides: Partial<GameState['run']> = {}): GameState => ({
  run: {
    seed: 1, shards: 10, ante: 1, goalIdx: 0,
    constellationId: 'lyra',
    catalysts: [], vouchers: [], consumables: [], ownedMods: [],
    diceMods: Array.from({ length: 5 }, () => [] as string[]),
    handsPlayed: 0, compoundingStacks: 0, rollCounter: 0,
    tempoStreak: 0, tempoLastTier: -1, lastComboId: null, comboStreak: 0,
    ...overrides,
  },
  round: {
    active: true, score: 0, target: 300,
    dice: Array.from({ length: 5 }, (_, id) => ({ id, face: id + 1, locked: false })),
    scoringOrder: [0, 1, 2, 3, 4], handsLeft: 3, handsMax: 3, rerollsLeft: 2,
    chainLen: 0, chainTier: -1,
    shardSinkPrimedThisHand: false, recursiveSinkPrimedThisHand: false,
    tithePrimedThisHand: 0, firstHandPlayed: false,
  },
  shop: { open: false, offers: [], rerollCost: 5 },
  meta: { playerName: '', unlocks: [], highScores: [] },
  ui: { screen: 'round', paused: false, tooltip: null, transition: 'idle' },
  pingCount: 0,
} as unknown as GameState);

describe('GRANT_CONSUMABLE', () => {
  it('adds a known consumable id', () => {
    const r = consumableHandler({ type: 'GRANT_CONSUMABLE', id: 'pin_six' }, baseState());
    expect(r.state.run.consumables).toContain('pin_six');
  });

  it('emits no events', () => {
    const r = consumableHandler({ type: 'GRANT_CONSUMABLE', id: 'pin_six' }, baseState());
    expect(r.events).toHaveLength(0);
  });

  it('is a no-op for unknown consumable ids', () => {
    const r = consumableHandler({ type: 'GRANT_CONSUMABLE', id: 'totally_fake_consumable' }, baseState());
    expect(r.state.run.consumables).toEqual([]);
  });

  it('is a no-op when at max consumable slots (4 without voucher)', () => {
    const full = baseState({ consumables: ['pin_six', 'pin_one', 'shard_drop', 'pin_six'] });
    const r = consumableHandler({ type: 'GRANT_CONSUMABLE', id: 'pin_one' }, full);
    expect(r.state.run.consumables).toHaveLength(4);
  });

  it('can add up to 4 consumables with no capacity voucher', () => {
    let s = baseState();
    s = consumableHandler({ type: 'GRANT_CONSUMABLE', id: 'pin_six' }, s).state;
    s = consumableHandler({ type: 'GRANT_CONSUMABLE', id: 'pin_one' }, s).state;
    s = consumableHandler({ type: 'GRANT_CONSUMABLE', id: 'shard_drop' }, s).state;
    s = consumableHandler({ type: 'GRANT_CONSUMABLE', id: 'pin_six' }, s).state;
    expect(s.run.consumables).toHaveLength(4);
    // 5th should be rejected
    s = consumableHandler({ type: 'GRANT_CONSUMABLE', id: 'pin_one' }, s).state;
    expect(s.run.consumables).toHaveLength(4);
  });
});

describe('DISCARD_CONSUMABLE', () => {
  it('removes consumable at the given index', () => {
    const s = baseState({ consumables: ['pin_six', 'pin_one', 'shard_drop'] });
    const r = consumableHandler({ type: 'DISCARD_CONSUMABLE', index: 1 }, s);
    expect(r.state.run.consumables).toEqual(['pin_six', 'shard_drop']);
  });

  it('emits no events', () => {
    const s = baseState({ consumables: ['pin_six'] });
    const r = consumableHandler({ type: 'DISCARD_CONSUMABLE', index: 0 }, s);
    expect(r.events).toHaveLength(0);
  });

  it('is a no-op for an out-of-range index', () => {
    const s = baseState({ consumables: ['pin_six'] });
    const r = consumableHandler({ type: 'DISCARD_CONSUMABLE', index: 5 }, s);
    expect(r.state.run.consumables).toEqual(['pin_six']);
  });
});

describe('USE_CONSUMABLE', () => {
  it('applies pin_six effect (sets die face to 6) and removes the consumable', () => {
    const s = baseState({ consumables: ['pin_six'] });
    const r = consumableHandler({ type: 'USE_CONSUMABLE', index: 0, targets: [2] }, s);
    expect(r.state.round.dice[2]?.face).toBe(6);
    expect(r.state.run.consumables).toHaveLength(0);
  });

  it('is a no-op for an out-of-range consumable index', () => {
    const s = baseState({ consumables: ['pin_six'] });
    const r = consumableHandler({ type: 'USE_CONSUMABLE', index: 5 }, s);
    expect(r.state.run.consumables).toEqual(['pin_six']);
  });

  it('requires target for requiresTarget consumables (no-op without targets)', () => {
    const s = baseState({ consumables: ['pin_six'] });
    const r = consumableHandler({ type: 'USE_CONSUMABLE', index: 0, targets: [] }, s);
    // pin_six requiresTarget=true, empty targets → no-op
    expect(r.state.run.consumables).toEqual(['pin_six']);
  });

  it('applies shard_drop (no target required) and removes consumable', () => {
    const s = baseState({ consumables: ['shard_drop'] });
    const before = s.run.shards;
    const r = consumableHandler({ type: 'USE_CONSUMABLE', index: 0 }, s);
    expect(r.state.run.shards).toBeGreaterThan(before);
    expect(r.state.run.consumables).toHaveLength(0);
  });
});
