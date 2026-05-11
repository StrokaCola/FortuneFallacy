import { describe, it, expect } from 'vitest';
import { metaHandler } from './meta';
import type { GameState } from '../../state/store';

const baseState = (): GameState => ({
  run: { seed: 1, shards: 0, ante: 1, goalIdx: 0, catalysts: [], vouchers: [], consumables: [], handsPlayed: 0, compoundingStacks: 0 },
  round: { active: false, score: 0, dice: [] },
  shop: { open: false, offers: [], rerollCost: 5 },
  meta: { playerName: '', unlocks: [], highScores: [] },
  ui: { screen: 'title', paused: false, tooltip: null, transition: 'idle', dieTip: null },
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

describe('SET_PLAYER_NAME', () => {
  it('stores the name on meta', () => {
    const r = metaHandler({ type: 'SET_PLAYER_NAME', name: 'Aria' }, baseState());
    expect(r.state.meta.playerName).toBe('Aria');
  });

  it('emits no events', () => {
    const r = metaHandler({ type: 'SET_PLAYER_NAME', name: 'X' }, baseState());
    expect(r.events).toHaveLength(0);
  });

  it('overwrites a previously-stored name', () => {
    let s = metaHandler({ type: 'SET_PLAYER_NAME', name: 'first' }, baseState()).state;
    s = metaHandler({ type: 'SET_PLAYER_NAME', name: 'second' }, s).state;
    expect(s.meta.playerName).toBe('second');
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
    const before = { ...baseState(), ui: { screen: 'round' as const, paused: true, tooltip: null, transition: 'idle' as const, dieTip: null } };
    const after = metaHandler({ type: 'TOGGLE_PAUSE' }, before).state;
    expect(after.ui.paused).toBe(false);
  });

  it('emits no events', () => {
    const r = metaHandler({ type: 'TOGGLE_PAUSE' }, baseState());
    expect(r.events).toHaveLength(0);
  });
});

describe('SHOW_DIE_TIP / HIDE_DIE_TIP', () => {
  // Inject 3 dice and an empty dieTip into baseState so the handler can
  // validate dieIdx against round.dice.length.
  const stateWithDice = (): GameState => ({
    ...baseState(),
    round: { active: true, score: 0, dice: [
      { id: 0, face: 4, locked: false },
      { id: 1, face: 6, locked: true },
      { id: 2, face: 1, locked: false },
    ] } as unknown as GameState['round'],
  });

  it('sets ui.dieTip when SHOW_DIE_TIP dispatched with valid die index', () => {
    const r = metaHandler({
      type: 'SHOW_DIE_TIP', dieIdx: 1, screenX: 120, screenY: 300, pointerType: 'touch',
    }, stateWithDice());
    expect(r.state.ui.dieTip).toEqual({ dieIdx: 1, screenX: 120, screenY: 300, pointerType: 'touch' });
    expect(r.events).toHaveLength(0);
  });

  it('rejects SHOW_DIE_TIP when dieIdx is out of range', () => {
    const r = metaHandler({
      type: 'SHOW_DIE_TIP', dieIdx: 99, screenX: 0, screenY: 0, pointerType: 'mouse',
    }, stateWithDice());
    expect(r.state.ui.dieTip).toBeNull();
  });

  it('rejects SHOW_DIE_TIP when dieIdx is negative', () => {
    const r = metaHandler({
      type: 'SHOW_DIE_TIP', dieIdx: -1, screenX: 0, screenY: 0, pointerType: 'mouse',
    }, stateWithDice());
    expect(r.state.ui.dieTip).toBeNull();
  });

  it('HIDE_DIE_TIP clears the active tip', () => {
    const shown = metaHandler({
      type: 'SHOW_DIE_TIP', dieIdx: 0, screenX: 10, screenY: 20, pointerType: 'pen',
    }, stateWithDice()).state;
    expect(shown.ui.dieTip).not.toBeNull();
    const hidden = metaHandler({ type: 'HIDE_DIE_TIP' }, shown).state;
    expect(hidden.ui.dieTip).toBeNull();
  });

  it('HIDE_DIE_TIP is a no-op when no tip is set (preserves reference)', () => {
    const s = stateWithDice();
    const r = metaHandler({ type: 'HIDE_DIE_TIP' }, s);
    expect(r.state).toBe(s);
  });
});
