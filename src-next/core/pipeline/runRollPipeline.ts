import type { GameState } from '../../state/store';
import type { SimulationResult } from '../../events/types';
import type { PipelineCtx } from './types';
import { mulberry32 } from '../rng';
import { deriveMetrics } from '../derived/simulationMetrics';
import { preRollModifiers } from '../phases/preRollModifiers';
import { initSimulation }   from '../phases/initSimulation';
import { postRollModifiers } from '../phases/postRollModifiers';
import { evaluation }       from '../phases/evaluation';
import { upgrades }         from '../phases/upgrades';
import { scoring }          from '../phases/scoring';
import { emitEvents }       from '../phases/emitEvents';

export function runRollPipelineUpToSim(state: GameState): PipelineCtx {
  const rng = mulberry32(state.run.seed ^ state.run.goalIdx);
  let ctx: PipelineCtx = {
    state,
    chips: 0,
    mult: 0,
    total: 0,
    events: [],
    rng,
  };
  ctx = preRollModifiers(ctx);
  ctx = initSimulation(ctx);
  return ctx;
}

export function runRollPipelineAfterSim(ctx: PipelineCtx, simResult: SimulationResult): PipelineCtx {
  let next: PipelineCtx = { ...ctx, sim: simResult, metrics: deriveMetrics(simResult) };
  next = postRollModifiers(next);
  next = evaluation(next);
  next = upgrades(next);
  next = scoring(next);
  next = emitEvents(next);
  return next;
}
