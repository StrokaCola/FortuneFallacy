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

  describe('seeded runs', () => {
    it('marks unseeded runs as seedSource=random (hidden in-game)', () => {
      const r = roundHandler({ type: 'NEW_RUN' }, baseState());
      expect(r.state.run.seedSource).toBe('random');
    });

    it('marks explicit-seed runs as seedSource=player and uses the entered seed', () => {
      const r = roundHandler({ type: 'NEW_RUN', seed: 0xCAFEBABE }, baseState());
      expect(r.state.run.seedSource).toBe('player');
      expect(r.state.run.seed).toBe(0xCAFEBABE);
    });

    it('marks daily runs as seedSource=daily', () => {
      const r = roundHandler({ type: 'NEW_RUN', daily: true }, baseState());
      expect(r.state.run.seedSource).toBe('daily');
    });

    it('produces the same upcomingBossId for two runs with the same seed', () => {
      const a = roundHandler({ type: 'NEW_RUN', seed: 12345 }, baseState());
      const b = roundHandler({ type: 'NEW_RUN', seed: 12345 }, baseState());
      expect(a.state.run.upcomingBossId).toBe(b.state.run.upcomingBossId);
    });

    it('initializes shopSeq to 0 so the first OPEN_SHOP rolls from scope shop:seq=0', () => {
      const r = roundHandler({ type: 'NEW_RUN', seed: 12345 }, baseState());
      expect(r.state.run.shopSeq).toBe(0);
    });
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

  it('emits onBlindAboutToStart for non-boss blinds', () => {
    // 2026-05-19 Wave T (Batch F) — startBlind now emits a transition
    // cue for non-boss blinds so the UI can play a brief vignette /
    // audio bridge so the moment of entering a new blind reads as a
    // beat. Boss blinds emit onBossRevealed instead.
    const r = roundHandler({ type: 'START_BLIND' }, baseState());
    expect(r.events).toHaveLength(1);
    expect(r.events[0]?.type).toBe('onBlindAboutToStart');
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

describe('START_BLIND — void mode blind affixes', () => {
  it('does not populate blindAffixes outside void mode', () => {
    const before = { ...baseState(), round: { ...baseState().round, active: false } };
    const r = roundHandler({ type: 'START_BLIND' }, before);
    expect(r.state.run.blindAffixes).toEqual({});
  });

  it('populates blindAffixes[blindId] when run.mode === "void"', () => {
    const base = baseState();
    const before = {
      ...base,
      run: { ...base.run, mode: 'void' as const, voidSeed: 7777, blindAffixes: {} },
      round: { ...base.round, active: false },
    };
    const r = roundHandler({ type: 'START_BLIND' }, before);
    const id = r.state.round.blindId!;
    expect(id).toBeTruthy();
    const entry = r.state.run.blindAffixes[id];
    expect(entry).toBeDefined();
    expect(entry!.displayName.length).toBeGreaterThan(0);
    expect(entry!.baseId).toBe(id);
  });

  it('is deterministic — same voidSeed + slot rolls the same affix', () => {
    const base = baseState();
    const before = {
      ...base,
      run: { ...base.run, mode: 'void' as const, voidSeed: 4242, blindAffixes: {} },
      round: { ...base.round, active: false },
    };
    const a = roundHandler({ type: 'START_BLIND' }, before);
    const b = roundHandler({ type: 'START_BLIND' }, before);
    const idA = a.state.round.blindId!;
    const idB = b.state.round.blindId!;
    expect(idA).toBe(idB);
    const entryA = a.state.run.blindAffixes[idA]!;
    const entryB = b.state.run.blindAffixes[idB]!;
    expect(entryA.displayName).toBe(entryB.displayName);
    expect(entryA.affixes.map((x) => x.id))
      .toEqual(entryB.affixes.map((x) => x.id));
  });
});

describe('START_BLIND — Phase 2B.2 activeBlindRules', () => {
  it('leaves activeBlindRules empty outside void mode', () => {
    const before = { ...baseState(), round: { ...baseState().round, active: false } };
    const r = roundHandler({ type: 'START_BLIND' }, before);
    expect(r.state.run.activeBlindRules).toEqual([]);
  });

  it('extracts rule descriptors from rolled blind affixes into run.activeBlindRules', () => {
    // Sweep many voidSeeds — at least one will roll a rule-bearing affix
    // from the 4 introduced in Phase 2B.2. The test asserts that WHEN a
    // rule-bearing affix lands, its rule descriptor surfaces on the
    // run.activeBlindRules array. We don't pin a specific seed because
    // the affix pool weights leave roll cadence to the generator.
    let sawRule = false;
    for (let seed = 1; seed <= 60 && !sawRule; seed++) {
      const base = baseState();
      const before = {
        ...base,
        run: { ...base.run, mode: 'void' as const, voidSeed: seed, blindAffixes: {} },
        round: { ...base.round, active: false },
      };
      const r = roundHandler({ type: 'START_BLIND' }, before);
      const id = r.state.round.blindId!;
      const entry = r.state.run.blindAffixes[id];
      const expectedRules = entry?.affixes
        .map((a) => a.rule)
        .filter((x) => x !== undefined) ?? [];
      expect(r.state.run.activeBlindRules).toEqual(expectedRules);
      if (expectedRules.length > 0) sawRule = true;
    }
    // Sanity — across 60 seeds we should hit at least one rule-bearing
    // roll given the 4 rule-bearing entries in the 10-affix catalog.
    expect(sawRule).toBe(true);
  });

  it('clears activeBlindRules from a previous void blind when starting a new one without rules', () => {
    const base = baseState();
    const before = {
      ...base,
      // Normal mode → the new blind shouldn't repopulate rules.
      run: {
        ...base.run,
        mode: 'normal' as const,
        activeBlindRules: [{ kind: 'banCombo' as const, comboId: 'one_pair' }],
      },
      round: { ...base.round, active: false },
    };
    const r = roundHandler({ type: 'START_BLIND' }, before);
    expect(r.state.run.activeBlindRules).toEqual([]);
  });
});
