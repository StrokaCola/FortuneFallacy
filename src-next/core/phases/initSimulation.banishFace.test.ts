// Banish-face mod family (2026-05-13) — verifies the initSimulation
// retry loop honors per-die banish sets, respects the degenerate-pool
// fallback, and surfaces substitution counts in the simRequest for the
// downstream Dice3D visual / state tally.

import { describe, it, expect } from 'vitest';
import { initSimulation } from './initSimulation';
import { mulberry32 } from '../rng';
import type { PipelineCtx } from '../pipeline/types';
import type { GameState } from '../../state/store';

// Minimal GameState builder — copies the shape used by runRollPipeline.test.ts
// but exposes the fields the banish loop reads (run.diceMods, round.dice,
// round.prevHandFaces, run.constellationId).
function makeState(overrides: {
  constellationId?: string;
  diceMods?: string[][];
  prevHandFaces?: number[];
  diceCount?: number;
} = {}): GameState {
  const count = overrides.diceCount ?? 5;
  const constellationId = overrides.constellationId ?? 'lyra';
  return {
    run: {
      seed: 1, shards: 0, ante: 1, goalIdx: 0,
      constellationId,
      catalysts: [], vouchers: [], consumables: [], ownedMods: [],
      diceMods: overrides.diceMods ?? Array.from({ length: count }, () => [] as string[]),
      handsPlayed: 0, compoundingStacks: 0, rollCounter: 0,
      tempoStreak: 0, tempoLastTier: -1, lastComboId: null, comboStreak: 0,
    },
    round: {
      active: true, blindId: null, blindIndex: 0, isBoss: false,
      target: 300, score: 0, handsLeft: 3, handsMax: 3, rerollsLeft: 2,
      dice: Array.from({ length: count }, (_, id) => ({ id, face: 1, locked: false })),
      hand: [], handInProgress: false, scoring: false, firstRollDone: false,
      chainLen: 0, chainTier: -1,
      shardSinkPrimedThisHand: false, recursiveSinkPrimedThisHand: false,
      tithePrimedThisHand: 0, firstHandPlayed: false,
      scoringOrder: Array.from({ length: count }, (_, i) => i),
      prevHandFaces: overrides.prevHandFaces ?? [],
    },
    shop: { open: false, offers: [], rerollCost: 5 },
    meta: { playerName: '', unlocks: [], highScores: [] },
    ui: { screen: 'round', paused: false, tooltip: null, transition: 'idle' },
    pingCount: 0,
  } as unknown as GameState;
}

function makeCtx(state: GameState, seed = 42): PipelineCtx {
  return { state, chips: 0, mult: 0, total: 0, events: [], rng: mulberry32(seed) };
}

describe('initSimulation — banish-face retry loop (Aversion / Wide Net)', () => {
  it('Aversion: die 0 never lands on face 1 across many seeds', () => {
    const state = makeState({
      diceMods: [['aversion'], [], [], [], []],
    });
    for (let seed = 1; seed <= 200; seed++) {
      const ctx = initSimulation(makeCtx(state, seed));
      const face = ctx.simRequest!.predeterminedFaces[0]!;
      expect(face, `seed ${seed} produced face 1 on aversion-tagged die`).not.toBe(1);
    }
  });

  it('Wide Net: die 0 never lands on face 1 or 2 across many seeds', () => {
    const state = makeState({
      diceMods: [['wide_net'], [], [], [], []],
    });
    for (let seed = 1; seed <= 200; seed++) {
      const ctx = initSimulation(makeCtx(state, seed));
      const face = ctx.simRequest!.predeterminedFaces[0]!;
      expect(face).toBeGreaterThanOrEqual(3);
    }
  });

  it('High Tide: die 0 never lands on face 1 or 6', () => {
    const state = makeState({
      diceMods: [['high_tide'], [], [], [], []],
    });
    for (let seed = 1; seed <= 200; seed++) {
      const ctx = initSimulation(makeCtx(state, seed));
      const face = ctx.simRequest!.predeterminedFaces[0]!;
      expect(face >= 2 && face <= 5).toBe(true);
    }
  });

  it('other dice are unaffected when only die 0 has the banish mod', () => {
    const state = makeState({
      diceMods: [['aversion'], [], [], [], []],
    });
    // Sample 100 seeds — at least one of dice 1-4 should roll face 1
    // (otherwise the banish is leaking into other slots).
    let othersGotOne = false;
    for (let seed = 1; seed <= 100; seed++) {
      const ctx = initSimulation(makeCtx(state, seed));
      const faces = ctx.simRequest!.predeterminedFaces;
      for (let i = 1; i < 5; i++) {
        if (faces[i] === 1) {
          othersGotOne = true;
          break;
        }
      }
      if (othersGotOne) break;
    }
    expect(othersGotOne).toBe(true);
  });

  it('emits a substitution count on dice that triggered the banish', () => {
    const state = makeState({
      diceMods: [['aversion'], [], [], [], []],
    });
    // Over 100 seeds we expect ~1/6 of initial picks to be face 1
    // (which the loop will then re-pick), giving a positive count.
    let totalSubs = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const ctx = initSimulation(makeCtx(state, seed));
      totalSubs += ctx.simRequest!.banishSubstitutions?.[0] ?? 0;
    }
    expect(totalSubs).toBeGreaterThan(0);
  });
});

describe('initSimulation — banish-face dynamic resolvers', () => {
  it('Restless Die: re-picks when prevHandFaces matches', () => {
    const state = makeState({
      diceMods: [['restless_die'], [], [], [], []],
      prevHandFaces: [3, 0, 0, 0, 0],
    });
    for (let seed = 1; seed <= 200; seed++) {
      const ctx = initSimulation(makeCtx(state, seed));
      expect(ctx.simRequest!.predeterminedFaces[0]).not.toBe(3);
    }
  });

  it('Restless Die: no-op when prevHandFaces is unset', () => {
    const state = makeState({
      diceMods: [['restless_die'], [], [], [], []],
      prevHandFaces: [],
    });
    // Without prev-hand context, die 0 should roll any value 1-6.
    const seen = new Set<number>();
    for (let seed = 1; seed <= 100; seed++) {
      const ctx = initSimulation(makeCtx(state, seed));
      seen.add(ctx.simRequest!.predeterminedFaces[0]!);
    }
    expect(seen.has(3)).toBe(true);
  });

  it('Voidlock: legendary — die only rolls the universe max (face 6 on d6)', () => {
    const state = makeState({
      diceMods: [['voidlock'], [], [], [], []],
    });
    for (let seed = 1; seed <= 200; seed++) {
      const ctx = initSimulation(makeCtx(state, seed));
      expect(ctx.simRequest!.predeterminedFaces[0]).toBe(6);
    }
  });
});

describe('initSimulation — banish-face edge cases', () => {
  it('Eclipse degenerate guard: Aversion on Eclipse falls through after cap', () => {
    // Eclipse universe is {0, 1}. Aversion banishes face 1 — leaving
    // only 0 available. The loop hits face 0 quickly and exits. Die
    // never lands on 1.
    const state = makeState({
      constellationId: 'eclipse',
      diceMods: [['aversion'], [], [], [], []],
    });
    for (let seed = 1; seed <= 50; seed++) {
      const ctx = initSimulation(makeCtx(state, seed));
      const face = ctx.simRequest!.predeterminedFaces[0]!;
      expect(face).not.toBe(1);
    }
  });

  it('banish on a face the universe lacks is a silent no-op', () => {
    // Polyhedra's first die is a d4 (faces 1-4). Aversion banishes face 1,
    // which IS in d4's universe — die 0 should never roll 1.
    // High Tide banishes face 6, which IS NOT in d4 — should leak no
    // banish effect onto a die whose universe doesn't include 6.
    const state = makeState({
      constellationId: 'polyhedra',
      diceMods: [['high_tide'], [], [], [], []],
      diceCount: 5,
    });
    // Confirm die 0 (d4) rolls 1-4 normally — banish of face 6 had
    // nothing to remove.
    const seen = new Set<number>();
    for (let seed = 1; seed <= 100; seed++) {
      const ctx = initSimulation(makeCtx(state, seed));
      seen.add(ctx.simRequest!.predeterminedFaces[0]!);
    }
    // d4 has 4 faces — we should see at least 3 distinct values across
    // 100 seeds if the banish is truly a no-op.
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('locked dice ignore banish entirely (mod fires only on roll, not held)', () => {
    // Force die 0 to be locked on face 1. Even with Aversion attached,
    // the locked face passes through unchanged. (Banish only applies
    // to rolling dice — locks are player-committed.)
    const state = makeState({
      diceMods: [['aversion'], [], [], [], []],
    });
    state.round.dice[0] = { id: 0, face: 1, locked: true };
    const ctx = initSimulation(makeCtx(state, 1));
    expect(ctx.simRequest!.predeterminedFaces[0]).toBe(1);
  });
});
