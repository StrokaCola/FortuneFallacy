import { describe, it, expect } from 'vitest';
import { runRollPipelineUpToSim, runRollPipelineAfterSim } from './runRollPipeline';
import { mulberry32 } from '../rng';
import type { GameState } from '../../state/store';
import type { PipelineCtx } from './types';
import type { SimulationResult } from '../../events/types';

function makeState(scoringOrder = [0, 1, 2, 3, 4]): GameState {
  return {
    run: {
      seed: 1, shards: 0, ante: 1, goalIdx: 0,
      constellationId: 'lyra',
      catalysts: [], vouchers: [], consumables: [], ownedMods: [],
      diceMods: Array.from({ length: 5 }, () => [] as string[]),
      handsPlayed: 0, compoundingStacks: 0, rollCounter: 0,
      tempoStreak: 0, tempoLastTier: -1, lastComboId: null, comboStreak: 0,
    },
    round: {
      active: true, blindId: null, blindIndex: 0, isBoss: false,
      target: 300, score: 0, handsLeft: 3, handsMax: 3, rerollsLeft: 2,
      dice: Array.from({ length: 5 }, (_, id) => ({ id, face: id + 1, locked: false })),
      hand: [], handInProgress: false, scoring: false, firstRollDone: false,
      chainLen: 0, chainTier: -1,
      shardSinkPrimedThisHand: false, recursiveSinkPrimedThisHand: false,
      tithePrimedThisHand: 0, firstHandPlayed: false,
      scoringOrder,
    },
    shop: { open: false, offers: [], rerollCost: 5 },
    meta: { playerName: '', unlocks: [], highScores: [] },
    ui: { screen: 'round', paused: false, tooltip: null, transition: 'idle' },
    pingCount: 0,
  } as unknown as GameState;
}

function makeSimResult(finalFaces: number[]): SimulationResult {
  return {
    finalFaces,
    restPositions: finalFaces.map(() => ({ x: 0, y: 0, z: 0 })),
    settleMs: finalFaces.map(() => 100),
    peakVelocity: 1,
    collisionCount: 3,
    bounceHeights: finalFaces.map(() => 0.1),
  };
}

describe('runRollPipelineAfterSim', () => {
  it('produces a positive total from a straight [1,2,3,4,5]', () => {
    const state = makeState();
    const ctx: PipelineCtx = { state, chips: 0, mult: 0, total: 0, events: [], rng: mulberry32(42) };
    const simResult = makeSimResult([1, 2, 3, 4, 5]);

    const out = runRollPipelineAfterSim(ctx, simResult);
    expect(out.total).toBeGreaterThan(0);
  });

  it('emits onScoreCalculated event', () => {
    const state = makeState();
    const ctx: PipelineCtx = { state, chips: 0, mult: 0, total: 0, events: [], rng: mulberry32(42) };
    const out = runRollPipelineAfterSim(ctx, makeSimResult([1, 2, 3, 4, 5]));

    const scoreEvt = out.events.find((e) => e.type === 'onScoreCalculated');
    expect(scoreEvt).toBeDefined();
  });

  it('emits onComboDetected event with correct combo id for a straight', () => {
    const state = makeState();
    const ctx: PipelineCtx = { state, chips: 0, mult: 0, total: 0, events: [], rng: mulberry32(42) };
    const out = runRollPipelineAfterSim(ctx, makeSimResult([1, 2, 3, 4, 5]));

    const comboEvt = out.events.find((e) => e.type === 'onComboDetected');
    expect(comboEvt).toBeDefined();
    expect((comboEvt as { type: 'onComboDetected'; payload: { combo: string } }).payload.combo).toContain('straight');
  });

  it('scores only held dice (scoringOrder subset)', () => {
    // Only hold d0=1 and d1=2 → chance combo, chips = chance-floor + sum of those two faces
    const state = makeState([0, 1]);
    const ctx: PipelineCtx = { state, chips: 0, mult: 0, total: 0, events: [], rng: mulberry32(42) };
    const out = runRollPipelineAfterSim(ctx, makeSimResult([1, 2, 3, 4, 5]));

    const scoreEvt = out.events.find((e) => e.type === 'onScoreCalculated') as
      { type: 'onScoreCalculated'; payload: { chips: number; mult: number; total: number } } | undefined;
    expect(scoreEvt).toBeDefined();
    // chips = chance floor (5) + sum of held faces (1+2=3) = 8
    expect(scoreEvt!.payload.chips).toBe(8);
  });

  it('attaches chain data to the context output', () => {
    const state = makeState();
    const ctx: PipelineCtx = { state, chips: 0, mult: 0, total: 0, events: [], rng: mulberry32(42) };
    const out = runRollPipelineAfterSim(ctx, makeSimResult([3, 3, 3, 3, 3]));

    expect(out.chain).toBeDefined();
    expect(typeof out.chain!.mult).toBe('number');
  });
});

describe('runRollPipelineUpToSim', () => {
  it('produces a simRequest with 5 predeterminedFaces for lyra (5×d6)', () => {
    const state = makeState();
    const ctx = runRollPipelineUpToSim(state);

    expect(ctx.simRequest).toBeDefined();
    expect(ctx.simRequest!.predeterminedFaces).toHaveLength(5);
  });

  it('each predeterminedFace is in [1, 6] for a standard d6 lyra run', () => {
    const state = makeState();
    const ctx = runRollPipelineUpToSim(state);

    for (const face of ctx.simRequest!.predeterminedFaces) {
      expect(face).toBeGreaterThanOrEqual(1);
      expect(face).toBeLessThanOrEqual(6);
    }
  });

  it('is deterministic — same seed produces same simRequest', () => {
    const state = makeState();
    const a = runRollPipelineUpToSim(state);
    const b = runRollPipelineUpToSim(state);

    expect(a.simRequest!.predeterminedFaces).toEqual(b.simRequest!.predeterminedFaces);
  });

  it('different rollCounter values produce different predetermined faces', () => {
    const stateA = makeState();
    const stateB = { ...makeState(), run: { ...makeState().run, rollCounter: 7 } };

    const a = runRollPipelineUpToSim(stateA);
    const b = runRollPipelineUpToSim(stateB);

    // Different seeds → overwhelmingly likely different faces
    expect(a.simRequest!.predeterminedFaces).not.toEqual(b.simRequest!.predeterminedFaces);
  });
});
