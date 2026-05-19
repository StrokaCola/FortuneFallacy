// Hoarder's Crown (mythic) — Triple-threshold shard economy payoff.
//   Per shard above 10: +0.2 Mult.
//   Per shard above 20: also +1 Chip.
//   Per shard above 30: also ×1.10 Mult (compounds per shard).
// The compounding tier is the run-defining ceiling — at 50 shards held
// the third tier alone is ×1.10^20 ≈ ×6.73.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const T1_THRESHOLD = 10;   // +0.2 mult per shard above
const T1_MULT = 0.2;
const T2_THRESHOLD = 20;   // +1 chip per shard above
const T2_CHIPS = 1;
const T3_THRESHOLD = 30;   // ×1.10 mult per shard above (compounds)
const T3_FACTOR = 1.10;

register({
  id: 'hoarders_crown',
  phase: Phase.UPGRADES,
  // Late multiplicative band (matches vault_heart at 200) so the ×1.10
  // tier amplifies the full additive stack the player has built.
  priority: 210,
  apply: (ctx) => {
    const shards = ctx.state.run.shards;
    if (shards <= T1_THRESHOLD) return ctx;
    const tier1 = Math.max(0, shards - T1_THRESHOLD);
    const tier2 = Math.max(0, shards - T2_THRESHOLD);
    const tier3 = Math.max(0, shards - T3_THRESHOLD);
    const addMult = tier1 * T1_MULT;
    const addChips = tier2 * T2_CHIPS;
    const multAfterAdd = ctx.mult + addMult;
    const chipsAfterAdd = ctx.chips + addChips;
    const multAfterCompound = tier3 > 0
      ? multAfterAdd * Math.pow(T3_FACTOR, tier3)
      : multAfterAdd;
    return {
      ...ctx,
      chips: chipsAfterAdd,
      mult: multAfterCompound,
      events: emitUpgrade(
        ctx,
        'hoarders_crown',
        addChips,
        multAfterCompound - ctx.mult,
      ),
    };
  },
});
