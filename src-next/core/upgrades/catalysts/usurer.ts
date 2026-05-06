// Usurer: every shard the player holds above 10 grants +1 mult. Reads
// the live shard balance at scoring time — pairs naturally with Stipend
// (steady accrual) and Shard Streak voucher (+1 per cleared trial).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const SHARD_THRESHOLD = 10;

register({
  id: 'usurer',
  phase: Phase.UPGRADES,
  // Run AFTER shard-spending catalysts (shard_sink @ ~30, recursive_sink
  // @ ~35) so the read sees the post-spend balance and rewards holding,
  // not just hoarding-then-spending.
  priority: 90,
  apply: (ctx) => {
    const surplus = Math.max(0, ctx.state.run.shards - SHARD_THRESHOLD);
    if (surplus === 0) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + surplus,
      events: emitUpgrade(ctx, 'usurer', 0, surplus),
    };
  },
});
