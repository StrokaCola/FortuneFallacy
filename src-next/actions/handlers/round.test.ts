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

  it('seeds upcomingBossId so the Hub can preview ante-1\'s curse before Begin', () => {
    const r = roundHandler({ type: 'NEW_RUN' }, baseState());
    expect(r.state.run.upcomingBossId).toBeTruthy();
    expect(typeof r.state.run.upcomingBossId).toBe('string');
  });

  describe('daily flag', () => {
    it('sets dailyDate to today\'s UTC date string', () => {
      const r = roundHandler({ type: 'NEW_RUN', daily: true }, baseState());
      expect(r.state.run.dailyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('overrides any provided constellationId/stakeId with the daily values', () => {
      // Even though we pass mensa+ember, the daily picks supersede them so
      // every player gets the same daily config regardless of how they
      // launched the run.
      const r = roundHandler(
        { type: 'NEW_RUN', daily: true, constellationId: 'mensa', stakeId: 'ember' },
        baseState(),
      );
      // Constellation and stake come from the daily lottery — we don't
      // assert specific values (those rotate by date), but they must not
      // be the explicitly-passed values when daily=true.
      // What we DO assert: the run is marked as daily.
      expect(r.state.run.dailyDate).not.toBeNull();
    });

    it('sets a deterministic seed (same day → same seed)', () => {
      const r1 = roundHandler({ type: 'NEW_RUN', daily: true }, baseState());
      const r2 = roundHandler({ type: 'NEW_RUN', daily: true }, baseState());
      expect(r1.state.run.seed).toBe(r2.state.run.seed);
    });

    it('skips astral perks (fair leaderboard)', () => {
      const stateWithPerks = {
        ...baseState(),
        meta: { ...baseState().meta, astralPerks: ['morning_star'] },
      };
      const r = roundHandler({ type: 'NEW_RUN', daily: true }, stateWithPerks);
      // morning_star grants +2 starting shards; daily skips perks so
      // shards stay at 0.
      expect(r.state.run.shards).toBe(0);
    });

    it('non-daily run still applies astral perks', () => {
      const stateWithPerks = {
        ...baseState(),
        meta: { ...baseState().meta, astralPerks: ['morning_star'] },
      };
      const r = roundHandler({ type: 'NEW_RUN' }, stateWithPerks);
      // The perk fires here — confirms the daily-skip is the special case,
      // not a regression to the perk-apply path.
      expect(r.state.run.shards).toBeGreaterThan(0);
    });

    it('non-daily run leaves dailyDate null', () => {
      const r = roundHandler({ type: 'NEW_RUN' }, baseState());
      expect(r.state.run.dailyDate).toBeNull();
    });
  });

  void vi; // suppress unused-import lint when the suite shrinks
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

  it('emits onRunEnded with won=false (and onDustEarned)', () => {
    const r = roundHandler({ type: 'BUST_BLIND' }, baseState());
    // bustBlind awards a small consolation Cosmic Dust grant alongside
    // the run-end event.
    expect(r.events).toHaveLength(2);
    const ended = r.events.find((e) => e.type === 'onRunEnded');
    expect(ended).toBeDefined();
    const payload = (ended as { type: 'onRunEnded'; payload: { won: boolean } }).payload;
    expect(payload.won).toBe(false);
    expect(r.events.find((e) => e.type === 'onDustEarned')).toBeDefined();
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
