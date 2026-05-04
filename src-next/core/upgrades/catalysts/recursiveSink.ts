// Recursive Sink: when shard_sink primes AND the player can afford an extra
// shard, pay 1 more for an additional ×1.25 mult. Skipped if the player
// can't afford the surcharge — Recursive Sink never breaks Shard Sink.
//
// The shard cost is pre-deducted in SCORE_HAND (see actions/handlers/roll.ts)
// via `recursiveSinkActive`. Inside the pipeline this catalyst only checks
// the `recursiveSinkPrimedThisHand` round flag and applies the multiplier.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';
import type { GameState } from '../../../state/store';

const EXTRA_MULT = 1.25;

// True iff recursive_sink is owned, shard_sink is owned and would prime
// (shards >= 1), AND there's still a shard left after sink draws (≥ 2 total).
export function recursiveSinkActive(state: GameState): boolean {
  if (!state.run.catalysts.includes('recursive_sink')) return false;
  if (!state.run.catalysts.includes('shard_sink')) return false;
  return state.run.shards >= 2;
}

register({
  id: 'recursive_sink',
  phase: Phase.UPGRADES,
  priority: 91,
  apply: (ctx) => {
    if (!ctx.state.round.recursiveSinkPrimedThisHand) return ctx;
    const newMult = ctx.mult * EXTRA_MULT;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'recursive_sink', 0, newMult - ctx.mult),
    };
  },
});
