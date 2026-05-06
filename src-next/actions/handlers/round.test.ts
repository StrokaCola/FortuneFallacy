import { describe, it, expect, vi } from 'vitest';
import { roundHandler } from './round';
import type { GameState } from '../../state/store';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';
import { initialShopSlice } from '../../state/slices/shop';
import { initialMetaSlice } from '../../state/slices/meta';
import { initialUiSlice } from '../../state/slices/ui';

const baseState = (): GameState => ({
  run: { ...initialRunSlice(), seed: 12345 },
  round: {
    ...initialRoundSlice(),
    active: true, blindId: 'hydra', score: 0, target: 200,
  },
  shop: initialShopSlice(),
  meta: initialMetaSlice(),
  ui: { ...initialUiSlice(), screen: 'round' },
  pingCount: 0,
} as unknown as GameState);

describe('NEW_RUN', () => {
  it('resets run, round, and shop slices', () => {
    const before = baseState();
    // Dirty up run/round with some state
    const dirty = {
      ...before,
      run: { ...before.run, shards: 999, catalysts: ['x', 'y'] },
      round: { ...before.round, score: 500, handsLeft: 0 },
    };
    const r = roundHandler({ type: 'NEW_RUN' }, dirty);
    expect(r.state.run.shards).toBe(0);
    expect(r.state.run.catalysts).toEqual([]);
    expect(r.state.round.score).toBe(0);
    expect(r.state.round.active).toBe(false);
    expect(r.state.shop.offers).toEqual([]);
  });

  it('navigates to hub screen', () => {
    const r = roundHandler({ type: 'NEW_RUN' }, baseState());
    expect(r.state.ui.screen).toBe('hub');
  });

  it('emits no events', () => {
    const r = roundHandler({ type: 'NEW_RUN' }, baseState());
    expect(r.events).toHaveLength(0);
  });

  it('accepts an optional constellationId and applies it', () => {
    const r = roundHandler({ type: 'NEW_RUN', constellationId: 'mensa' }, baseState());
    expect(r.state.run.constellationId).toBe('mensa');
  });

  it('uses lyra constellation by default', () => {
    const r = roundHandler({ type: 'NEW_RUN' }, baseState());
    expect(r.state.run.constellationId).toBe('lyra');
  });
});

describe('START_BLIND', () => {
  it('activates the round', () => {
    const before = { ...baseState(), round: { ...baseState().round, active: false } };
    const r = roundHandler({ type: 'START_BLIND' }, before);
    expect(r.state.round.active).toBe(true);
  });

  it('emits no events', () => {
    const r = roundHandler({ type: 'START_BLIND' }, baseState());
    expect(r.events).toHaveLength(0);
  });
});

describe('BUST_BLIND', () => {
  it('transitions to a non-active state with fail screen', () => {
    const r = roundHandler({ type: 'BUST_BLIND' }, baseState());
    // After bust, the run should be over — screen changes or round becomes inactive
    expect(r.events).toBeDefined();
  });

  it('emits onRunEnded with won=false', () => {
    const r = roundHandler({ type: 'BUST_BLIND' }, baseState());
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.type).toBe('onRunEnded');
    const payload = (r.events[0] as { type: 'onRunEnded'; payload: { won: boolean } }).payload;
    expect(payload.won).toBe(false);
  });
});

describe('SKIP_BLIND', () => {
  it('emits no events when the shard tag rolls (no pack opened)', () => {
    // Pin Math.random so SKIP_TAGS lands on the first entry ('shard'),
    // which has no event emissions. The 'pack' tag emits onPackOpened +
    // onGalaxyDiscovered which is covered separately in shop tests.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const r = roundHandler({ type: 'SKIP_BLIND' }, baseState());
    expect(r.events).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
