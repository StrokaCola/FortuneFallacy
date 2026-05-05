import { describe, it, expect } from 'vitest';
import { metaHandler } from './meta';
import type { GameState } from '../../state/store';

const baseState = (): GameState => ({
  run: { seed: 1, shards: 0, ante: 1, goalIdx: 0, catalysts: [], vouchers: [], consumables: [], handsPlayed: 0, compoundingStacks: 0 },
  round: { active: false, score: 0, dice: [] },
  shop: { open: false, offers: [], rerollCost: 5 },
  meta: { playerName: '', unlocks: [], highScores: [] },
  ui: { screen: 'title', paused: false, tooltip: null, transition: 'idle' },
  pingCount: 0,
} as unknown as GameState);

describe('PING', () => {
  it('increments pingCount', () => {
    const r = metaHandler({ type: 'PING', msg: 'hello' }, baseState());
    expect(r.state.pingCount).toBe(1);
  });

  it('emits onPing with the message payload', () => {
    const r = metaHandler({ type: 'PING', msg: 'world' }, baseState());
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.type).toBe('onPing');
    expect((r.events[0] as { type: 'onPing'; payload: { msg: string } }).payload.msg).toBe('world');
  });

  it('accumulates on repeated pings', () => {
    let s = baseState();
    s = metaHandler({ type: 'PING', msg: 'a' }, s).state;
    s = metaHandler({ type: 'PING', msg: 'b' }, s).state;
    expect(s.pingCount).toBe(2);
  });

  it('does not touch any other state slice', () => {
    const before = baseState();
    const after = metaHandler({ type: 'PING', msg: '' }, before).state;
    expect(after.run).toBe(before.run);
    expect(after.round).toBe(before.round);
    expect(after.shop).toBe(before.shop);
    expect(after.meta).toBe(before.meta);
  });
});

describe('SET_SCREEN', () => {
  it('updates ui.screen', () => {
    const r = metaHandler({ type: 'SET_SCREEN', screen: 'hub' }, baseState());
    expect(r.state.ui.screen).toBe('hub');
  });

  it('emits no events', () => {
    const r = metaHandler({ type: 'SET_SCREEN', screen: 'shop' }, baseState());
    expect(r.events).toHaveLength(0);
  });

  it('does not touch other state slices', () => {
    const before = baseState();
    const after = metaHandler({ type: 'SET_SCREEN', screen: 'round' }, before).state;
    expect(after.run).toBe(before.run);
    expect(after.pingCount).toBe(before.pingCount);
  });
});

describe('TOGGLE_PAUSE', () => {
  it('toggles paused from false to true', () => {
    const before = baseState();
    expect(before.ui.paused).toBe(false);
    const after = metaHandler({ type: 'TOGGLE_PAUSE' }, before).state;
    expect(after.ui.paused).toBe(true);
  });

  it('toggles paused from true to false', () => {
    const before = { ...baseState(), ui: { screen: 'round' as const, paused: true, tooltip: null, transition: 'idle' as const } };
    const after = metaHandler({ type: 'TOGGLE_PAUSE' }, before).state;
    expect(after.ui.paused).toBe(false);
  });

  it('emits no events', () => {
    const r = metaHandler({ type: 'TOGGLE_PAUSE' }, baseState());
    expect(r.events).toHaveLength(0);
  });
});
