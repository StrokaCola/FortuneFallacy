// Stipend grants +1 shard at the start of each hand (capped at 6 shards).
// Pure side-effect handled in actions/handlers/roll.ts SCORE_HAND BEFORE
// shardSink/tithe prime, so the new shard is available to spend immediately.
//
// No pipeline registration needed. This file exists for symmetry with the
// other catalysts and so the registry index can `import './stipend'`.
//
// See `grantStipend` below for the helper used by roll.ts.
import type { GameState } from '../../../state/store';

export const STIPEND_CAP = 6;

export function grantStipend(state: GameState): GameState {
  if (!state.run.catalysts.includes('stipend')) return state;
  if (state.run.shards >= STIPEND_CAP) return state;
  return { ...state, run: { ...state.run, shards: state.run.shards + 1 } };
}
