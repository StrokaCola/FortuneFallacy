// Economy Engine: each shard the player holds at scoring time grants
// +0.1 mult. Uncapped — pairs with Stipend (steady accrual), Shard
// Streak voucher, and Shard Lung for runaway shard-economy builds.
// Note: priority 95 means this runs BEFORE shard-spending catalysts
// (shard_sink @ 30, recursive_sink @ 35) have already burned shards
// — wait, those run earlier; this still reads the post-spend balance.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_SHARD = 0.1;

register({
  id: 'economy_engine',
  phase: Phase.UPGRADES,
  // After shard-spending catalysts so the read sees what's left.
  priority: 95,
  apply: (ctx) => {
    const shards = ctx.state.run.shards;
    if (shards <= 0) return ctx;
    const dMult = shards * MULT_PER_SHARD;
    return {
      ...ctx,
      mult: ctx.mult + dMult,
      events: emitUpgrade(ctx, 'economy_engine', 0, dMult),
    };
  },
});
