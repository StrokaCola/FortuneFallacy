// Vault Heart — Each 10 shards held: ×1.10 mult (compounds across
// thresholds). 10 shards = ×1.10, 20 = ×1.21, 30 = ×1.33, 50 = ×1.61.
// The top of the shard-scaler ladder below mythic Hoarder's Crown.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const SHARDS_PER_STEP = 10;
const MULT_PER_STEP = 1.10;

register({
  id: 'vault_heart',
  phase: Phase.UPGRADES,
  // Late multiplicative band — runs after additive mult contributions
  // (magpie 90, usurer 90, economy_engine 95) so the ×1.10 amplifies
  // the full additive stack the player has built.
  priority: 200,
  apply: (ctx) => {
    const shards = ctx.state.run.shards;
    const steps = Math.floor(shards / SHARDS_PER_STEP);
    if (steps <= 0) return ctx;
    const factor = Math.pow(MULT_PER_STEP, steps);
    const newMult = ctx.mult * factor;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'vault_heart', 0, newMult - ctx.mult),
    };
  },
});
