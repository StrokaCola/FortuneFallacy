// projectScore() unit tests — 2026-05-18 P1 score preview chip.
// Pure function over a minimal GameState shape. Verifies projection
// hides on inactive rounds, scales with combo tier, and respects
// constellation base-chip / base-mult modifiers.

import { describe, it, expect } from 'vitest';
import { projectScore } from './projection';
import type { GameState } from '../../state/store';

function makeState(overrides: {
  active?: boolean;
  target?: number;
  dice?: { face: number; locked: boolean }[];
  constellationId?: string;
} = {}): GameState {
  return {
    run: {
      seed: 1,
      constellationId: overrides.constellationId ?? 'lyra',
    },
    round: {
      active: overrides.active ?? true,
      target: overrides.target ?? 500,
      dice: (overrides.dice ?? [
        { id: 0, face: 1, locked: false },
        { id: 1, face: 2, locked: false },
        { id: 2, face: 3, locked: false },
        { id: 3, face: 4, locked: false },
        { id: 4, face: 5, locked: false },
      ]).map((d, i) => ({ id: i, ...d })),
    },
  } as unknown as GameState;
}

describe('projectScore', () => {
  it('returns null when round inactive', () => {
    expect(projectScore(makeState({ active: false }))).toBeNull();
  });

  it('returns null when target is 0', () => {
    expect(projectScore(makeState({ target: 0 }))).toBeNull();
  });

  it('returns null when no dice are locked', () => {
    expect(projectScore(makeState())).toBeNull();
  });

  it('projects Chance score for a single locked die', () => {
    // Lock one die showing 4. Chance combo: chips 5 + face 4 = 9; mult 1 → 9.
    const out = projectScore(makeState({
      dice: [
        { face: 4, locked: true },
        { face: 1, locked: false },
        { face: 2, locked: false },
        { face: 3, locked: false },
        { face: 5, locked: false },
      ],
    }));
    expect(out).toBe(9);
  });

  it('projects One Pair when two locked dice match', () => {
    // Lock two 3s. one_pair: chips 10 + 3+3 = 16; mult 2 → 32.
    const out = projectScore(makeState({
      dice: [
        { face: 3, locked: true },
        { face: 3, locked: true },
        { face: 1, locked: false },
        { face: 2, locked: false },
        { face: 5, locked: false },
      ],
    }));
    expect(out).toBe(32);
  });

  it('projects Three of a Kind correctly', () => {
    // Lock three 6s. three_kind: chips 30 + 18 = 48; mult 5 → 240.
    const out = projectScore(makeState({
      dice: [
        { face: 6, locked: true },
        { face: 6, locked: true },
        { face: 6, locked: true },
        { face: 1, locked: false },
        { face: 2, locked: false },
      ],
    }));
    expect(out).toBe(240);
  });

  it('Eclipse constellation halves base chips and mult', () => {
    // Eclipse has baseChipsMult 0.5 and baseMultMult 0.5. Eclipse faces
    // are 0/1 so use a 1+1 pair for "One Pair".
    // chips = round((10 + 2) * 0.5) = round(6) = 6
    // mult = 2 * 0.5 = 1
    // total = 6 * 1 = 6
    const out = projectScore(makeState({
      constellationId: 'eclipse',
      dice: [
        { face: 1, locked: true },
        { face: 1, locked: true },
        { face: 0, locked: false },
        { face: 0, locked: false },
        { face: 1, locked: false },
      ],
    }));
    expect(out).toBe(6);
  });

  it('caps at 0 for degenerate inputs', () => {
    const out = projectScore(makeState({
      dice: [{ face: 0, locked: true }],
    }));
    expect(out).toBeGreaterThanOrEqual(0);
  });

  it('is stable across calls with the same state', () => {
    const s = makeState({
      dice: [
        { face: 5, locked: true },
        { face: 5, locked: true },
        { face: 3, locked: false },
        { face: 1, locked: false },
        { face: 2, locked: false },
      ],
    });
    expect(projectScore(s)).toBe(projectScore(s));
  });
});
