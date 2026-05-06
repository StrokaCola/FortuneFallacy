import { describe, it, expect } from 'vitest';
import { diceHandler } from './dice';
import { initialRoundSlice } from '../../state/slices/round';
import type { GameState } from '../../state/store';

const baseState = (): GameState => ({
  run: { seed: 1, shards: 0, ante: 1, goalIdx: 0, catalysts: [], vouchers: [], consumables: [], handsPlayed: 0, compoundingStacks: 0 },
  round: { ...initialRoundSlice() },
  shop: { open: false, offers: [], rerollCost: 5 },
  meta: { playerName: '', unlocks: [], highScores: [] },
  ui: { screen: 'round', paused: false },
  pingCount: 0,
} as unknown as GameState);

describe('TOGGLE_LOCK scoringOrder rewrite', () => {
  // Build state with all dice unlocked (initial state has all locked).
  const unlockedState = (): GameState => {
    const s = baseState();
    return {
      ...s,
      round: {
        ...s.round,
        dice: s.round.dice.map((d) => ({ ...d, locked: false })),
        scoringOrder: [],
      },
    };
  };

  it('locking d2 first sets scoringOrder=[2]', () => {
    const r = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 2 }, unlockedState());
    expect(r.state.round.scoringOrder).toEqual([2]);
  });

  it('locking d4 then d0 then d2 yields id-ascending [0,2,4] (left-to-right)', () => {
    let s = unlockedState();
    s = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 4 }, s).state;
    s = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 0 }, s).state;
    s = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 2 }, s).state;
    expect(s.round.scoringOrder).toEqual([0, 2, 4]);
  });

  it('unlocking removes the index and preserves id-ascending order', () => {
    let s = unlockedState();
    s = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 0 }, s).state;
    s = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 2 }, s).state;
    s = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 4 }, s).state;
    expect(s.round.scoringOrder).toEqual([0, 2, 4]);
    s = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 2 }, s).state;
    expect(s.round.scoringOrder).toEqual([0, 4]);
  });

  it('relocking after unlock places back in id-position', () => {
    let s = unlockedState();
    s = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 4 }, s).state;
    s = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 0 }, s).state;
    expect(s.round.scoringOrder).toEqual([0, 4]);
    // Now lock d2 — should slot between 0 and 4.
    s = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 2 }, s).state;
    expect(s.round.scoringOrder).toEqual([0, 2, 4]);
  });
});

describe('REORDER_HOLD', () => {
  it('initializes scoringOrder to [0,1,2,3,4]', () => {
    const s = baseState();
    expect(s.round.scoringOrder).toEqual([0, 1, 2, 3, 4]);
  });

  it('replaces scoringOrder with newOrder when valid', () => {
    const s = baseState();
    const r = diceHandler({ type: 'REORDER_HOLD', newOrder: [4, 0, 2, 1, 3] }, s);
    expect(r.state.round.scoringOrder).toEqual([4, 0, 2, 1, 3]);
  });

  it('rejects newOrder with wrong length (no-op)', () => {
    const s = baseState();
    const r = diceHandler({ type: 'REORDER_HOLD', newOrder: [0, 1] }, s);
    expect(r.state.round.scoringOrder).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects newOrder with duplicates (no-op)', () => {
    const s = baseState();
    const r = diceHandler({ type: 'REORDER_HOLD', newOrder: [0, 0, 1, 2, 3] }, s);
    expect(r.state.round.scoringOrder).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects newOrder containing unlocked die idx (no-op)', () => {
    const s = baseState();
    // Die at index 2 is unlocked; locked dice are [0,1,3,4] — 4 locked dice
    const sUnlocked = { ...s, round: { ...s.round, dice: s.round.dice.map((d, i) => i === 2 ? { ...d, locked: false } : d) } };
    // newOrder has length 4 (matches locked count) and no dupes, but contains
    // idx 2 which is unlocked → should reject on the every-locked-includes check.
    const r = diceHandler({ type: 'REORDER_HOLD', newOrder: [0, 1, 2, 3] }, sUnlocked);
    // No-op preserves initial scoringOrder (since we mutated dice without going through TOGGLE_LOCK).
    expect(r.state.round.scoringOrder).toEqual([0, 1, 2, 3, 4]);
  });

  it('emits onReorderRejected with reason on validation failure', () => {
    const s = baseState();
    const lengthMismatch = diceHandler({ type: 'REORDER_HOLD', newOrder: [0, 1] }, s);
    expect(lengthMismatch.events).toEqual([
      { type: 'onReorderRejected', payload: { reason: 'length-mismatch', newOrder: [0, 1], locked: [0, 1, 2, 3, 4] } },
    ]);

    const duplicate = diceHandler({ type: 'REORDER_HOLD', newOrder: [0, 0, 1, 2, 3] }, s);
    expect(duplicate.events[0]?.type).toBe('onReorderRejected');
    expect((duplicate.events[0] as { payload: { reason: string } }).payload.reason).toBe('duplicate-index');

    const sUnlocked = { ...s, round: { ...s.round, dice: s.round.dice.map((d, i) => i === 2 ? { ...d, locked: false } : d) } };
    const unlocked = diceHandler({ type: 'REORDER_HOLD', newOrder: [0, 1, 2, 3] }, sUnlocked);
    expect(unlocked.events[0]?.type).toBe('onReorderRejected');
    expect((unlocked.events[0] as { payload: { reason: string } }).payload.reason).toBe('unlocked-index');
  });

  it('emits no events on successful reorder', () => {
    const s = baseState();
    const r = diceHandler({ type: 'REORDER_HOLD', newOrder: [4, 0, 2, 1, 3] }, s);
    expect(r.events).toEqual([]);
  });
});

describe('ATTACH_MOD / DETACH_MOD — mod edition parallel sync', () => {
  // Build state with dice unlocked + ownedMods pre-seeded with editions.
  const seededState = (): GameState => {
    const s = baseState();
    return {
      ...s,
      run: {
        ...s.run,
        ownedMods: ['amplify', 'sharpened'],
        ownedModEditions: ['foil', null],
        diceMods: Array.from({ length: 5 }, () => [] as string[]),
        diceModEditions: Array.from({ length: 5 }, () => [] as (string | null)[]),
      },
    } as unknown as GameState;
  };

  it('ATTACH_MOD transfers edition from ownedModEditions to diceModEditions', () => {
    const s = seededState();
    const r = diceHandler({ type: 'ATTACH_MOD', dieIdx: 2, modId: 'amplify' }, s);
    expect(r.state.run.ownedMods).toEqual(['sharpened']);
    expect(r.state.run.ownedModEditions).toEqual([null]);
    expect(r.state.run.diceMods[2]).toEqual(['amplify']);
    expect(r.state.run.diceModEditions?.[2]).toEqual(['foil']);
  });

  it('ATTACH_MOD with no edition transfers null', () => {
    const s = seededState();
    const r = diceHandler({ type: 'ATTACH_MOD', dieIdx: 1, modId: 'sharpened' }, s);
    expect(r.state.run.diceModEditions?.[1]).toEqual([null]);
    expect(r.state.run.ownedModEditions).toEqual(['foil']);
  });

  it('DETACH_MOD returns the edition to ownedModEditions', () => {
    let s = seededState();
    s = diceHandler({ type: 'ATTACH_MOD', dieIdx: 2, modId: 'amplify' }, s).state;
    // Now amplify is on die 2 with foil. Detach it.
    const r = diceHandler({ type: 'DETACH_MOD', dieIdx: 2, modIdx: 0 }, s);
    expect(r.state.run.diceMods[2]).toEqual([]);
    expect(r.state.run.diceModEditions?.[2]).toEqual([]);
    // Returned to owned inventory at the END of the array.
    expect(r.state.run.ownedMods).toContain('amplify');
    const idx = r.state.run.ownedMods.indexOf('amplify');
    expect(r.state.run.ownedModEditions?.[idx]).toBe('foil');
  });

  it('attach + detach roundtrip preserves edition identity', () => {
    let s = seededState();
    s = diceHandler({ type: 'ATTACH_MOD', dieIdx: 0, modId: 'amplify' }, s).state;
    s = diceHandler({ type: 'DETACH_MOD', dieIdx: 0, modIdx: 0 }, s).state;
    // amplify back in ownedMods, edition preserved
    const idx = s.run.ownedMods.indexOf('amplify');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(s.run.ownedModEditions?.[idx]).toBe('foil');
  });
});

describe('FORGE_MOD — combine duplicates into editioned mod', () => {
  const baseWithMods = (mods: string[], editions: (string | null)[], shards = 10): GameState => {
    const s = baseState();
    return {
      ...s,
      run: {
        ...s.run,
        ownedMods: mods,
        ownedModEditions: editions,
        shards,
      },
    } as unknown as GameState;
  };

  it('consumes 2 duplicates + 5 shards, pushes 1 editioned copy', () => {
    const s = baseWithMods(['amplify', 'amplify', 'sharpened'], [null, null, null], 10);
    const r = diceHandler(
      { type: 'FORGE_MOD', modId: 'amplify', targetEdition: 'foil' },
      s,
    );
    expect(r.state.run.shards).toBe(5);
    expect(r.state.run.ownedMods).toEqual(['sharpened', 'amplify']);
    expect(r.state.run.ownedModEditions).toEqual([null, 'foil']);
  });

  it('refuses when fewer than 2 duplicates owned', () => {
    const s = baseWithMods(['amplify', 'sharpened'], [null, null], 10);
    const r = diceHandler(
      { type: 'FORGE_MOD', modId: 'amplify', targetEdition: 'foil' },
      s,
    );
    expect(r.state).toBe(s);
  });

  it('refuses when shards insufficient', () => {
    const s = baseWithMods(['amplify', 'amplify'], [null, null], 2);
    const r = diceHandler(
      { type: 'FORGE_MOD', modId: 'amplify', targetEdition: 'holo' },
      s,
    );
    expect(r.state).toBe(s);
  });
});

describe('TOGGLE_LOCK — crescendo_run counter reset', () => {
  const lockedState = (rollsWithoutLock = 5): GameState => {
    const s = baseState();
    return {
      ...s,
      round: {
        ...s.round,
        rollsWithoutLock,
        // Start with all unlocked so toggling LOCKS rather than unlocks.
        dice: s.round.dice.map((d) => ({ ...d, locked: false })),
      },
    };
  };

  it('locking a die resets rollsWithoutLock to 0', () => {
    const s = lockedState(5);
    const r = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 1 }, s);
    expect(r.state.round.rollsWithoutLock).toBe(0);
  });

  it('unlocking a die does NOT reset rollsWithoutLock', () => {
    // Start with a locked die so toggling unlocks.
    const s = baseState();
    const sWithStreak = {
      ...s,
      round: { ...s.round, rollsWithoutLock: 5 },
    };
    const r = diceHandler({ type: 'TOGGLE_LOCK', dieIdx: 0 }, sWithStreak);
    expect(r.state.round.rollsWithoutLock).toBe(5);
  });
});
