import { describe, it, expect } from 'vitest';
import { rollHandler } from './roll';
import type { GameState } from '../../state/store';

// Side-effect: load catalyst registry so SCORE_HAND has the upgrades available.
import '../../core/upgrades/catalysts';

function makeState(overrides: Partial<{ shards: number; catalysts: string[]; handsPlayed: number; handsLeft: number; }> = {}): GameState {
  return {
    run: {
      seed: 1,
      shards: overrides.shards ?? 5,
      ante: 1,
      goalIdx: 0,
      catalysts: overrides.catalysts ?? [],
      vouchers: [],
      consumables: [],
      handsPlayed: overrides.handsPlayed ?? 0,
      compoundingStacks: 0,
      rollCounter: 0,
      ownedMods: [],
      diceMods: [[], [], [], [], []],
    },
    round: {
      active: true,
      blindId: 'small_blind',
      blindIndex: 0,
      isBoss: false,
      target: 100,
      score: 0,
      handsLeft: overrides.handsLeft ?? 3,
      handsMax: 3,
      rerollsLeft: 2,
      dice: Array.from({ length: 5 }, (_, id) => ({ id, face: 3, locked: false })),
      hand: [],
      handInProgress: false,
      scoring: false,
      firstRollDone: false,
      chainLen: 0,
      chainTier: -1,
      shardSinkPrimedThisHand: false,
    },
    meta: { playerName: 'test', highScores: [] },
    ui: { screen: 'round', paused: false },
    shop: { open: false, offers: [], rerollCost: 0 },
    pingCount: 0,
  } as unknown as GameState;
}

type SimReq = { diceToRoll: number[]; seed: number; predeterminedFaces: number[] };

function simRequestFrom(events: Array<{ type: string; payload: unknown }>): SimReq | null {
  const ev = events.find((e) => e.type === 'onSimulationStart');
  if (!ev) return null;
  return (ev.payload as { request: SimReq }).request;
}

describe('ROLL_REQUESTED determinism', () => {
  it('produces identical predeterminedFaces for identical inputs', () => {
    const a = rollHandler({ type: 'ROLL_REQUESTED' }, makeState());
    const b = rollHandler({ type: 'ROLL_REQUESTED' }, makeState());
    const reqA = simRequestFrom(a.events as Array<{ type: string; payload: unknown }>)!;
    const reqB = simRequestFrom(b.events as Array<{ type: string; payload: unknown }>)!;
    expect(reqA.predeterminedFaces).toEqual(reqB.predeterminedFaces);
    expect(reqA.predeterminedFaces).toHaveLength(5);
    reqA.predeterminedFaces.forEach((f) => {
      expect(f).toBeGreaterThanOrEqual(1);
      expect(f).toBeLessThanOrEqual(6);
    });
  });

  it('advances rollCounter so each roll varies but stays reproducible', () => {
    const first = rollHandler({ type: 'ROLL_REQUESTED' }, makeState());
    expect(first.state.run.rollCounter).toBe(1);
    // Second roll uses the post-first state (firstRollDone=true so dice
    // are not auto-unlocked) and should advance rollCounter again.
    const second = rollHandler({ type: 'ROLL_REQUESTED' }, first.state);
    expect(second.state.run.rollCounter).toBe(2);
    const reqA = simRequestFrom(first.events as Array<{ type: string; payload: unknown }>)!;
    const reqB = simRequestFrom(second.events as Array<{ type: string; payload: unknown }>)!;
    // The two rolls should not be identical (extremely unlikely with mulberry32).
    expect(reqA.predeterminedFaces).not.toEqual(reqB.predeterminedFaces);
  });

  it('keeps locked dice on their existing face in predeterminedFaces', () => {
    const base = makeState();
    const withLock: GameState = {
      ...base,
      round: {
        ...base.round,
        firstRollDone: true,
        dice: base.round.dice.map((d, i) => (i === 2 ? { ...d, face: 6, locked: true } : d)),
      },
    };
    const result = rollHandler({ type: 'ROLL_REQUESTED' }, withLock);
    const req = simRequestFrom(result.events as Array<{ type: string; payload: unknown }>)!;
    expect(req.predeterminedFaces[2]).toBe(6);
    expect(req.diceToRoll).not.toContain(2);
  });
});

describe('REROLL_REQUESTED determinism', () => {
  it('advances rollCounter and decrements rerollsLeft', () => {
    const result = rollHandler({ type: 'REROLL_REQUESTED' }, makeState());
    expect(result.state.run.rollCounter).toBe(1);
    expect(result.state.round.rerollsLeft).toBe(1);
    const req = simRequestFrom(result.events as Array<{ type: string; payload: unknown }>);
    expect(req?.predeterminedFaces).toHaveLength(5);
  });

  it('no-ops when rerollsLeft is 0', () => {
    const base = makeState();
    const exhausted: GameState = { ...base, round: { ...base.round, rerollsLeft: 0 } };
    const result = rollHandler({ type: 'REROLL_REQUESTED' }, exhausted);
    expect(result.state).toBe(exhausted);
    expect(result.state.run.rollCounter).toBe(0);
  });
});

describe('SCORE_HAND', () => {
  it('increments handsPlayed by 1', () => {
    const s = makeState({ handsPlayed: 4 });
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.handsPlayed).toBe(5);
  });

  it('deducts 1 shard when shard_sink owned and shards >= 1', () => {
    const s = makeState({ catalysts: ['shard_sink'], shards: 5 });
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    // Shard count: started at 5, -1 from sink, +0 from gilded mods = 4
    expect(result.state.run.shards).toBe(4);
    // The flag is reset to false in final state
    expect(result.state.round.shardSinkPrimedThisHand).toBe(false);
  });

  it('does not deduct shard when shard_sink not owned', () => {
    const s = makeState({ shards: 5 });
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.shards).toBe(5);
    expect(result.state.round.shardSinkPrimedThisHand).toBe(false);
  });

  it('does not deduct shard when shard_sink owned but shards = 0', () => {
    const s = makeState({ catalysts: ['shard_sink'], shards: 0 });
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.shards).toBe(0);
    expect(result.state.round.shardSinkPrimedThisHand).toBe(false);
  });
});

// Regression tests for the 2026-05-11 scaling die-mod system. These guard
// against the SCORE_HAND state-merge bug where `final.state.run.diceModStacks`
// (the pipeline-incremented counter array) was dropped before reaching the
// store, so Dormant/Tally/Cadence/Glutton/Ballast/Pyre Mark counters never
// advanced after a hand. See plan in fix-die-counter-bug-S2dPN.
describe('SCORE_HAND scaling die-mod stack persistence', () => {
  function stateWithMod(
    dieIdx: number,
    modId: string,
    initialStack: number,
    overrides: { locked?: boolean; face?: number } = {},
  ): GameState {
    const base = makeState();
    const diceMods = base.run.diceMods.map((row, i) => (i === dieIdx ? [modId] : row));
    const diceModStacks = base.run.diceMods.map((row, i) =>
      i === dieIdx ? [initialStack] : row.map(() => 0),
    );
    const dice = base.round.dice.map((d, i) =>
      i === dieIdx
        ? { ...d, locked: overrides.locked ?? false, face: overrides.face ?? d.face }
        : d,
    );
    return {
      ...base,
      run: { ...base.run, diceMods, diceModStacks },
      round: { ...base.round, dice },
    } as GameState;
  }

  it('Dormant: counter ticks 0 → 1 after one hand (silent fire, no mult yet)', () => {
    const s = stateWithMod(0, 'dormant', 0);
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.diceModStacks?.[0]?.[0]).toBe(1);
  });

  it('Dormant: awakens at 10 stacks and grants +20 mult on the awakening hand', () => {
    const sBelow = stateWithMod(0, 'dormant', 9);
    const sAwake = stateWithMod(0, 'dormant', 10);
    const below = rollHandler({ type: 'SCORE_HAND' }, sBelow);
    const awake = rollHandler({ type: 'SCORE_HAND' }, sAwake);
    // Below threshold: still silent, stack ticks to 10.
    expect(below.state.run.diceModStacks?.[0]?.[0]).toBe(10);
    // At threshold: contributes +20 mult; stack stops growing (curStack >= awakenAt).
    expect(awake.state.run.diceModStacks?.[0]?.[0]).toBe(10);
    const belowMult = below.state.round.lastScoringCtx?.mult ?? 0;
    const awakeMult = awake.state.round.lastScoringCtx?.mult ?? 0;
    expect(awakeMult).toBeGreaterThan(belowMult);
  });

  it('Tally Mark: counter ticks every hand, contributes chips from prior stack', () => {
    const s = stateWithMod(0, 'tally_mark', 3);
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.diceModStacks?.[0]?.[0]).toBe(4);
  });

  it('Cadence: counter ticks every hand', () => {
    const s = stateWithMod(0, 'cadence', 2);
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.diceModStacks?.[0]?.[0]).toBe(3);
  });

  it('Glutton: increments only when die rolls 6', () => {
    const six = stateWithMod(0, 'glutton', 0, { face: 6 });
    const five = stateWithMod(0, 'glutton', 0, { face: 5 });
    const sixResult = rollHandler({ type: 'SCORE_HAND' }, six);
    const fiveResult = rollHandler({ type: 'SCORE_HAND' }, five);
    expect(sixResult.state.run.diceModStacks?.[0]?.[0]).toBe(1);
    expect(fiveResult.state.run.diceModStacks?.[0]?.[0]).toBe(0);
  });

  it('Ballast: increments only when die was locked at score time', () => {
    const locked = stateWithMod(0, 'ballast', 0, { locked: true });
    const unlocked = stateWithMod(0, 'ballast', 0, { locked: false });
    const lockedResult = rollHandler({ type: 'SCORE_HAND' }, locked);
    const unlockedResult = rollHandler({ type: 'SCORE_HAND' }, unlocked);
    expect(lockedResult.state.run.diceModStacks?.[0]?.[0]).toBe(1);
    expect(unlockedResult.state.run.diceModStacks?.[0]?.[0]).toBe(0);
  });

  it('Pyre Mark: increments only when die rolls 1', () => {
    const one = stateWithMod(0, 'pyre_mark', 0, { face: 1 });
    const two = stateWithMod(0, 'pyre_mark', 0, { face: 2 });
    const oneResult = rollHandler({ type: 'SCORE_HAND' }, one);
    const twoResult = rollHandler({ type: 'SCORE_HAND' }, two);
    expect(oneResult.state.run.diceModStacks?.[0]?.[0]).toBe(1);
    expect(twoResult.state.run.diceModStacks?.[0]?.[0]).toBe(0);
  });

  it('Encore: Dormant on last-scoring die ticks twice (primary + Encore re-fire)', () => {
    // Last scoring die = highest scoring-order index. With scoringOrder
    // unset, the pipeline defaults to [0..N), so die 4 is the last.
    const base = makeState({ catalysts: ['encore'] });
    const diceMods = base.run.diceMods.map((row, i) => (i === 4 ? ['dormant'] : row));
    const diceModStacks = base.run.diceMods.map((row, i) => (i === 4 ? [0] : row.map(() => 0)));
    const s: GameState = {
      ...base,
      run: { ...base.run, diceMods, diceModStacks },
    } as GameState;
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.diceModStacks?.[4]?.[0]).toBe(2);
  });

  it('Polaris: Dormant on the high-face die ticks twice (primary + Polaris re-fire)', () => {
    // Polaris retriggers the highest-face scoring die. Put Dormant on die 0
    // and give it face=6 (highest); the others stay at 3.
    const base = makeState({ catalysts: ['polaris'] });
    const diceMods = base.run.diceMods.map((row, i) => (i === 0 ? ['dormant'] : row));
    const diceModStacks = base.run.diceMods.map((row, i) => (i === 0 ? [0] : row.map(() => 0)));
    const dice = base.round.dice.map((d, i) => (i === 0 ? { ...d, face: 6 } : d));
    const s: GameState = {
      ...base,
      run: { ...base.run, diceMods, diceModStacks },
      round: { ...base.round, dice },
    } as GameState;
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.diceModStacks?.[0]?.[0]).toBe(2);
  });
});

describe('patience_counter integration', () => {
  it('triggers x3 mult on the 5th hand of run', () => {
    const s = makeState({ catalysts: ['patience_counter'], handsPlayed: 4 });
    // handsPlayed=4 means this is the 5th hand. Should trigger.
    const result = rollHandler({ type: 'SCORE_HAND' }, s);
    expect(result.state.run.handsPlayed).toBe(5);
    // Baseline (no patience) for the same dice: run a 4th hand (handsPlayed=3) to get the
    // mult without patience, then compare. The 5th hand should be exactly 3x the baseline.
    const baseline = rollHandler({ type: 'SCORE_HAND' }, makeState({ catalysts: ['patience_counter'], handsPlayed: 3 }));
    const baseMult = baseline.state.round.lastScoringCtx?.mult ?? 1;
    expect(result.state.round.lastScoringCtx?.mult).toBe(baseMult * 3);
  });

  it('does not trigger on the 4th hand of run', () => {
    // Same dice + patience_counter, but handsPlayed=3 (this is the 4th hand). No trigger.
    const withCatalyst = rollHandler(
      { type: 'SCORE_HAND' },
      makeState({ catalysts: ['patience_counter'], handsPlayed: 3 }),
    );
    // Without patience_counter, same dice — the mult must match (catalyst inert this hand).
    const withoutCatalyst = rollHandler(
      { type: 'SCORE_HAND' },
      makeState({ catalysts: [], handsPlayed: 3 }),
    );
    expect(withCatalyst.state.run.handsPlayed).toBe(4);
    expect(withCatalyst.state.round.lastScoringCtx?.mult).toBe(
      withoutCatalyst.state.round.lastScoringCtx?.mult,
    );
  });
});
