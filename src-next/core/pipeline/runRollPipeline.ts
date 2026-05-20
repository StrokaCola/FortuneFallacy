import type { GameState } from '../../state/store';
import type { SimulationResult } from '../../events/types';
import type { PipelineCtx } from './types';
import { mulberry32 } from '../rng';
import { deriveMetrics } from '../derived/simulationMetrics';
import { preRollModifiers } from '../phases/preRollModifiers';
import { initSimulation }   from '../phases/initSimulation';
import { postRollModifiers } from '../phases/postRollModifiers';
import { evaluation }       from '../phases/evaluation';
import { applyAffixesPhase } from '../phases/applyAffixes';
import { onCollision }      from '../phases/onCollision';
import { unheldScan }       from '../phases/unheldScan';
import { upgrades }         from '../phases/upgrades';
import { scoring }          from '../phases/scoring';
import { emitEvents }       from '../phases/emitEvents';

// Mix the run-level roll counter into the pipeline seed so each physical
// roll within a round produces a different (but reproducible) outcome.
// The 0x9E3779B1 constant is the integer fractional bits of the golden
// ratio — a cheap, well-known way to spread a small counter across all
// 32 bits before XOR'ing.
const ROLL_COUNTER_HASH = 0x9E3779B1;

export function runRollPipelineUpToSim(state: GameState): PipelineCtx {
  const rollCounter = state.run.rollCounter ?? 0;
  const rng = mulberry32(
    (state.run.seed ^ state.run.goalIdx ^ Math.imul(rollCounter, ROLL_COUNTER_HASH)) >>> 0,
  );
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
  // applyAffixesPhase is a STRICT no-op outside void mode — gated on
  // state.run.mode === 'void' inside the phase. Slots in after combo
  // detection so affix effects can read the comboId + resolved dice
  // values, and before catalyst/scoring sweeps so any chip/mult bonus
  // rides downstream multipliers (matching how the base combo's chips
  // ride catalyst mults).
  next = applyAffixesPhase(next);
  next = onCollision(next);
  next = unheldScan(next);
  next = upgrades(next);
  next = scoring(next);
  next = emitEvents(next);
  return next;
}
