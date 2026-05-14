// Regression test for the React #185 inside the Forge screen.
//
// `getDiceSpec()` previously allocated a fresh `[...base, ...]` array
// whenever the `extra_die` voucher pushed bonus > 0. Forge's
// `selectDiceSpec = (s) => getDiceSpec(s)` then handed Zustand a new
// reference on every render. Zustand compares snapshots with Object.is,
// saw the value as "changed" every tick, and recursed past React's
// nested-update cap — exactly what the player hit going to Forge with
// an extra-die voucher equipped.
//
// The fix memoizes by state identity. As long as state is the same
// immutable Zustand snapshot, the same DiceSpec reference is returned.

import { describe, it, expect } from 'vitest';
import type { GameState } from '../../state/store';
import { getDiceSpec } from './diceContext';
import { DEFAULT_CONSTELLATION_ID } from '../../data/constellations';

function makeState(opts: { vouchers?: string[] } = {}): GameState {
  return {
    run: {
      constellationId: DEFAULT_CONSTELLATION_ID,
      vouchers: opts.vouchers ?? [],
    },
  } as unknown as GameState;
}

describe('getDiceSpec stability', () => {
  it('returns the same reference across calls for the same state (no voucher)', () => {
    const s = makeState();
    const a = getDiceSpec(s);
    const b = getDiceSpec(s);
    expect(a).toBe(b);
  });

  it('returns the same reference across calls for the same state (extra_die voucher)', () => {
    // This is the path that triggered React #185 — the bonus > 0 branch
    // used to return a fresh array literal every call.
    const s = makeState({ vouchers: ['extra_die'] });
    const a = getDiceSpec(s);
    const b = getDiceSpec(s);
    expect(a).toBe(b);
    expect(a.length).toBe(getDiceSpec(makeState()).length + 1);
  });

  it('returns a NEW reference for a different state object', () => {
    const a = getDiceSpec(makeState({ vouchers: ['extra_die'] }));
    const b = getDiceSpec(makeState({ vouchers: ['extra_die'] }));
    // Different state inputs → different cached refs. (Memo is by
    // state identity, not by value.)
    expect(a).not.toBe(b);
  });
});
