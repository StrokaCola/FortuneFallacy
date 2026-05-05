import { describe, it, expect, beforeEach } from 'vitest';
import { store, getState, setStateRaw, resetStore } from './store';
import { initialRunSlice } from './slices/run';
import { initialRoundSlice } from './slices/round';
import { initialShopSlice } from './slices/shop';
import { initialMetaSlice } from './slices/meta';
import { initialUiSlice } from './slices/ui';

beforeEach(() => {
  resetStore();
});

describe('initial state shape', () => {
  it('has all top-level keys', () => {
    const s = getState();
    expect(s).toHaveProperty('run');
    expect(s).toHaveProperty('round');
    expect(s).toHaveProperty('shop');
    expect(s).toHaveProperty('meta');
    expect(s).toHaveProperty('ui');
    expect(s).toHaveProperty('pingCount');
  });

  it('initialises pingCount to 0', () => {
    expect(getState().pingCount).toBe(0);
  });

  it('run slice has expected defaults', () => {
    const run = getState().run;
    expect(run.shards).toBe(0);
    expect(run.ante).toBe(1);
    expect(run.goalIdx).toBe(0);
    expect(run.constellationId).toBe('lyra');
    expect(run.catalysts).toEqual([]);
    expect(run.vouchers).toEqual([]);
    expect(run.consumables).toEqual([]);
    expect(run.handsPlayed).toBe(0);
    expect(run.rollCounter).toBe(0);
    expect(run.tempoStreak).toBe(0);
    expect(run.tempoLastTier).toBe(-1);
    expect(run.lastComboId).toBeNull();
    expect(run.comboStreak).toBe(0);
  });

  it('round slice has expected defaults', () => {
    const round = getState().round;
    expect(round.active).toBe(false);
    expect(round.score).toBe(0);
    expect(round.handsLeft).toBe(3);
    expect(round.chainLen).toBe(0);
    expect(round.chainTier).toBe(-1);
    expect(round.dice).toHaveLength(5);
    expect(round.scoringOrder).toEqual([0, 1, 2, 3, 4]);
  });

  it('shop slice has expected defaults', () => {
    const shop = getState().shop;
    expect(shop.open).toBe(false);
    expect(shop.offers).toEqual([]);
    expect(shop.rerollCost).toBe(5);
  });

  it('meta slice has expected defaults', () => {
    const meta = getState().meta;
    expect(meta.playerName).toBe('');
    expect(meta.unlocks).toEqual([]);
    expect(meta.highScores).toEqual([]);
  });

  it('ui slice starts on title screen, not paused', () => {
    const ui = getState().ui;
    expect(ui.screen).toBe('title');
    expect(ui.paused).toBe(false);
  });
});

describe('setStateRaw', () => {
  it('replaces the entire state when passed a value', () => {
    const custom = {
      run: { ...initialRunSlice(), shards: 99 },
      round: initialRoundSlice(),
      shop: initialShopSlice(),
      meta: initialMetaSlice(),
      ui: initialUiSlice(),
      pingCount: 7,
    };
    setStateRaw(custom);
    expect(getState().pingCount).toBe(7);
    expect(getState().run.shards).toBe(99);
  });

  it('accepts an updater function', () => {
    setStateRaw((s) => ({ ...s, pingCount: s.pingCount + 5 }));
    expect(getState().pingCount).toBe(5);
  });
});

describe('resetStore', () => {
  it('resets all changes back to defaults', () => {
    setStateRaw((s) => ({ ...s, pingCount: 42, run: { ...s.run, shards: 100 } }));
    expect(getState().pingCount).toBe(42);

    resetStore();
    expect(getState().pingCount).toBe(0);
    expect(getState().run.shards).toBe(0);
  });
});

describe('store.subscribe', () => {
  it('notifies subscribers on state change', () => {
    let called = 0;
    const unsub = store.subscribe(() => { called++; });
    setStateRaw((s) => ({ ...s, pingCount: 1 }));
    unsub();
    expect(called).toBeGreaterThan(0);
  });

  it('stops notifying after unsubscribe', () => {
    let called = 0;
    const unsub = store.subscribe(() => { called++; });
    unsub();
    setStateRaw((s) => ({ ...s, pingCount: 2 }));
    expect(called).toBe(0);
  });
});
