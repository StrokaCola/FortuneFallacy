// Shard Lung: at score-time, spends half of the player's current shards
// (rounded down) and adds +1 mult per shard spent. The round-start ante
// shard grant is handled separately in core/round/transitions.ts startBlind.
//
// Skips silently when the player holds 0 shards. The state mutation
// flows back through PipelineCtx.state — the new shards value sticks
// because runRollPipelineAfterSim writes the ctx state into the store.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'shard_lung',
  phase: Phase.UPGRADES,
  // Run AFTER stipend / shard_sink (low-priority shard sources/sinks) so
  // shard_lung sees the post-spend balance and isn't double-counting any
  // shards that shard_sink already burned this hand.
  priority: 92,
  apply: (ctx) => {
    const shards = ctx.state.run.shards ?? 0;
    if (shards <= 0) return ctx;
    const spend = Math.floor(shards / 2);
    if (spend === 0) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + spend,
      state: {
        ...ctx.state,
        run: { ...ctx.state.run, shards: shards - spend },
      },
      events: emitUpgrade(ctx, 'shard_lung', 0, spend),
    };
  },
});
