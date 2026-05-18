import { describe, it, expect } from 'vitest';
import {
  aliveTension,
  isOneRollFromBust,
  peekNextStorm,
  isClutch,
} from './aliveness';
import type { GameState } from '../../state/store';

function makeState(round: Partial<GameState['round']> = {}, run: Partial<GameState['run']> = {}): GameState {
  return {
    run: {
      seed: 1,
      shards: 10,
      ante: 1,
      goalIdx: 0,
      ...run,
    },
    round: {
      active: true,
      target: 500,
      score: 0,
      handsLeft: 3,
      handsMax: 3,
      ...round,
    },
  } as unknown as GameState;
}

describe('aliveTension', () => {
  it('is 0 when round inactive', () => {
    expect(aliveTension(makeState({ active: false }))).toBe(0);
  });

  it('is 0 when target is 0', () => {
    expect(aliveTension(makeState({ target: 0 }))).toBe(0);
  });

  it('is 0 when score already meets target', () => {
    expect(aliveTension(makeState({ score: 500, target: 500 }))).toBe(0);
  });

  it('is 1 when handsLeft is 0 with missing score', () => {
    expect(aliveTension(makeState({ handsLeft: 0, score: 100 }))).toBe(1);
  });

  it('rises into the 0.4-1.0 band on the last hand', () => {
    const t = aliveTension(makeState({ handsLeft: 1, score: 100, target: 1000 }));
    expect(t).toBeGreaterThanOrEqual(0.4);
    expect(t).toBeLessThanOrEqual(1);
  });

  it('stays calm with plenty of hands left', () => {
    const t = aliveTension(makeState({ handsLeft: 3, score: 0, target: 1000 }));
    expect(t).toBeLessThanOrEqual(0.25);
  });

  it('increases as handsLeft drops', () => {
    const tFull = aliveTension(makeState({ handsLeft: 3, score: 200, target: 1000 }));
    const tMid = aliveTension(makeState({ handsLeft: 2, score: 200, target: 1000 }));
    const tLast = aliveTension(makeState({ handsLeft: 1, score: 200, target: 1000 }));
    expect(tMid).toBeGreaterThanOrEqual(tFull);
    expect(tLast).toBeGreaterThanOrEqual(tMid);
  });
});

describe('isOneRollFromBust', () => {
  it('is false in a comfortable state', () => {
    expect(isOneRollFromBust(makeState({ handsLeft: 3, score: 400, target: 500 }))).toBe(false);
  });

  it('is true on the last hand with most of the target still missing', () => {
    expect(isOneRollFromBust(makeState({ handsLeft: 1, score: 50, target: 1000 }))).toBe(true);
  });

  it('is false on the last hand when the player is comfortably above target', () => {
    expect(isOneRollFromBust(makeState({ handsLeft: 1, score: 900, target: 1000 }))).toBe(false);
  });
});

describe('peekNextStorm', () => {
  it('returns null or a string id', () => {
    const result = peekNextStorm(makeState({}, { seed: 1, goalIdx: 0 }));
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('is deterministic for the same seed + goalIdx', () => {
    const a = peekNextStorm(makeState({}, { seed: 42, goalIdx: 0 }));
    const b = peekNextStorm(makeState({}, { seed: 42, goalIdx: 0 }));
    expect(a).toBe(b);
  });

  it('returns null when the next blind would be a boss', () => {
    // Boss blinds are at blindIndex 2 (goalIdx % 3 === 2). Set goalIdx so
    // next goalIdx (current + 1) lands on a boss.
    const result = peekNextStorm(makeState({}, { seed: 1, goalIdx: 1 }));
    expect(result).toBeNull();
  });
});

describe('isClutch', () => {
  it('is false when inactive', () => {
    expect(isClutch(makeState({ active: false }))).toBe(false);
  });

  it('is false with plenty of hands left', () => {
    expect(isClutch(makeState({ handsLeft: 3, score: 400, target: 500 }))).toBe(false);
  });

  it('is true when within 25% on the last hand', () => {
    expect(isClutch(makeState({ handsLeft: 1, score: 400, target: 500 }))).toBe(true);
  });

  it('is false when already over target', () => {
    expect(isClutch(makeState({ handsLeft: 1, score: 500, target: 500 }))).toBe(false);
  });

  it('is true on the penultimate hand within 25%', () => {
    expect(isClutch(makeState({ handsLeft: 2, score: 400, target: 500 }))).toBe(true);
  });
});
