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
