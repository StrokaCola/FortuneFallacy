// Magpie — Each 5 shards held: +1 mult. Mid-tier shard-scaler that
// sits between Counter's Purse (common, +chip per 3) and Vault Heart
// (rare, ×1.10 per 10).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const SHARDS_PER_MULT = 5;

register({
  id: 'magpie',
  phase: Phase.UPGRADES,
  // Match usurer's priority band (90) so the read sees post-spend shards.
  priority: 90,
  apply: (ctx) => {
    const shards = ctx.state.run.shards;
    if (shards < SHARDS_PER_MULT) return ctx;
    const dMult = Math.floor(shards / SHARDS_PER_MULT);
    return {
      ...ctx,
      mult: ctx.mult + dMult,
      events: emitUpgrade(ctx, 'magpie', 0, dMult),
    };
  },
});
