import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { safeReadJSON, safeWriteJSON } from './storage';
import { loadSaved, applySavedToInitial } from './persistence';
import type { GameState } from './store';
import { initialRunSlice } from './slices/run';
import { initialRoundSlice } from './slices/round';
import { initialShopSlice } from './slices/shop';
import { initialMetaSlice } from './slices/meta';
import { initialUiSlice } from './slices/ui';

const KEY = 'ff_next_save';

function makeInitialState(): GameState {
  return {
    run: initialRunSlice(),
    round: initialRoundSlice(),
    shop: initialShopSlice(),
    meta: initialMetaSlice(),
    ui: initialUiSlice(),
    pingCount: 0,
  } as unknown as GameState;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('safeReadJSON / safeWriteJSON', () => {
  it('returns undefined for missing key', () => {
    expect(safeReadJSON('nonexistent')).toBeUndefined();
  });

  it('round-trips a JSON-serialisable value', () => {
    safeWriteJSON('test_key', { a: 1, b: 'hello' });
    expect(safeReadJSON('test_key')).toEqual({ a: 1, b: 'hello' });
  });

  it('returns undefined for corrupt JSON', () => {
    localStorage.setItem('bad_key', '{not valid json}');
    expect(safeReadJSON('bad_key')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    localStorage.setItem('empty_key', '');
    expect(safeReadJSON('empty_key')).toBeUndefined();
  });
});

describe('loadSaved', () => {
  it('returns null when nothing is stored', () => {
    expect(loadSaved()).toBeNull();
  });

  it('returns null for corrupt stored data', () => {
    localStorage.setItem(KEY, '{corrupt');
    expect(loadSaved()).toBeNull();
  });

  it('returns saved state when valid data exists', () => {
    const snapshot = {
      run: { ...initialRunSlice(), shards: 42, catalysts: ['x'] },
      meta: { playerName: 'Alice', unlocks: [], highScores: [] },
      round: initialRoundSlice(),
      ui: { screen: 'hub', paused: false, tooltip: null, transition: 'idle' },
    };
    safeWriteJSON(KEY, snapshot);

    const loaded = loadSaved();
    expect(loaded).not.toBeNull();
    expect(loaded!.run.shards).toBe(42);
    expect(loaded!.meta.playerName).toBe('Alice');
  });
});

describe('applySavedToInitial', () => {
  it('returns input state unchanged when nothing is saved', () => {
    const initial = makeInitialState();
    const result = applySavedToInitial(initial);
    expect(result.pingCount).toBe(0);
    expect(result.run.shards).toBe(0);
  });

  it('merges run and meta from saved state', () => {
    const snapshot = {
      run: { ...initialRunSlice(), shards: 99, catalysts: ['x', 'y'] },
      meta: { playerName: 'Bob', unlocks: [], highScores: [] },
      round: { ...initialRoundSlice(), active: false },
      ui: { screen: 'hub', paused: false, tooltip: null, transition: 'idle' },
    };
    safeWriteJSON(KEY, snapshot);

    const initial = makeInitialState();
    const result = applySavedToInitial(initial);
    expect(result.run.shards).toBe(99);
    expect(result.run.catalysts).toEqual(['x', 'y']);
    expect(result.meta.playerName).toBe('Bob');
  });

  it('forces void-mode fields back to defaults on rehydrate (strictly ephemeral)', () => {
    // Spec: nothing persists between Void runs. If a player closed mid-void
    // (or just clicked the black hole then refreshed), the rehydrated state
    // must drop them back into normal mode — otherwise the audioBridge boot
    // sync would re-start the void drone on every reload.
    const snapshot = {
      run: {
        ...initialRunSlice(),
        mode: 'void' as const,
        voidSeed: 12345,
        runAlias: 'Echo 17',
        dailyCertified: true,
        catalystAffixes: { burst_card: { base: {} as never, baseId: 'burst_card', affixes: [], displayName: 'x', flavor: '', budgetSpent: 0, rarityTier: 'normal' as const } },
        consumableAffixes: { andromeda: { base: {} as never, baseId: 'andromeda', affixes: [], displayName: 'x', flavor: '', budgetSpent: 0, rarityTier: 'normal' as const } },
        blindAffixes: { lesser_trial: { base: {} as never, baseId: 'lesser_trial', affixes: [], displayName: 'x', flavor: '', budgetSpent: 0, rarityTier: 'normal' as const } },
      },
      meta: initialMetaSlice(),
      round: initialRoundSlice(),
      ui: initialUiSlice(),
    };
    safeWriteJSON(KEY, snapshot);

    const result = applySavedToInitial(makeInitialState());
    expect(result.run.mode).toBe('normal');
    expect(result.run.voidSeed).toBe(0);
    expect(result.run.runAlias).toBe('');
    expect(result.run.dailyCertified).toBe(false);
    expect(result.run.catalystAffixes).toEqual({});
    expect(result.run.consumableAffixes).toEqual({});
    expect(result.run.blindAffixes).toEqual({});
  });

  it('does NOT restore an active round (handInProgress reset to false)', () => {
    const snapshot = {
      run: initialRunSlice(),
      meta: initialMetaSlice(),
      round: { ...initialRoundSlice(), active: true, score: 150 },
      ui: initialUiSlice(),
    };
    safeWriteJSON(KEY, snapshot);

    const initial = makeInitialState();
    const result = applySavedToInitial(initial);
    // Active round is restored but handInProgress is forced false
    expect(result.round.handInProgress).toBe(false);
    expect(result.round.score).toBe(150);
  });

  it('does not restore inactive round data (score stays 0)', () => {
    const snapshot = {
      run: initialRunSlice(),
      meta: initialMetaSlice(),
      round: { ...initialRoundSlice(), active: false, score: 999 },
      ui: initialUiSlice(),
    };
    safeWriteJSON(KEY, snapshot);

    const initial = makeInitialState();
    const result = applySavedToInitial(initial);
    expect(result.round.score).toBe(0);
  });

  it('restores ui.screen from saved state', () => {
    const snapshot = {
      run: initialRunSlice(),
      meta: initialMetaSlice(),
      round: initialRoundSlice(),
      ui: { screen: 'hub', paused: false, tooltip: null, transition: 'idle' },
    };
    safeWriteJSON(KEY, snapshot);

    const initial = makeInitialState();
    const result = applySavedToInitial(initial);
    expect(result.ui.screen).toBe('hub');
  });

  it('restores shop.offers + rerollCost so a refresh keeps the same shop', () => {
    const savedOffers = [
      { kind: 'catalyst' as const, id: 'tempo', price: 5 },
      { kind: 'mod' as const, id: 'tally_mark', price: 3 },
    ];
    const snapshot = {
      run: initialRunSlice(),
      meta: initialMetaSlice(),
      round: initialRoundSlice(),
      ui: { screen: 'shop', paused: false, tooltip: null, transition: 'idle' },
      shop: { ...initialShopSlice(), open: true, offers: savedOffers, rerollCost: 11 },
    };
    safeWriteJSON(KEY, snapshot);

    const initial = makeInitialState();
    const result = applySavedToInitial(initial);
    expect(result.shop.offers).toEqual(savedOffers);
    expect(result.shop.rerollCost).toBe(11);
    expect(result.shop.open).toBe(true);
  });

  it('falls back to a fresh shop slice when the save predates persistence', () => {
    const snapshot = {
      run: initialRunSlice(),
      meta: initialMetaSlice(),
      round: initialRoundSlice(),
      ui: initialUiSlice(),
      // No `shop` field — mirrors legacy saves written before the
      // shop was added to the persistence schema.
    };
    safeWriteJSON(KEY, snapshot);

    const initial = makeInitialState();
    const result = applySavedToInitial(initial);
    expect(result.shop).toEqual(initialShopSlice());
  });

  it('defaults upcomingBossId to null when missing on legacy saves', () => {
    const snapshot = {
      run: { ...initialRunSlice(), upcomingBossId: undefined },
      meta: initialMetaSlice(),
      round: initialRoundSlice(),
      ui: initialUiSlice(),
    };
    safeWriteJSON(KEY, snapshot);

    const initial = makeInitialState();
    const result = applySavedToInitial(initial);
    expect(result.run.upcomingBossId).toBeNull();
  });
});
