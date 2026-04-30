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
});
