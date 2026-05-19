// Singularity Engine (mythic) — Each shard the player holds at scoring
// time grants +0.5 mult AND +5 chips. Reads live shard balance, so it
// pairs with hoarder builds (Magpie, Vault Heart, Hoarder's Crown,
// Usurer, Economy Engine) for a build-defining ceiling.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_SHARD = 0.5;
const CHIPS_PER_SHARD = 5;

register({
  id: 'singularity_engine',
  phase: Phase.UPGRADES,
  // Same band as economy_engine (95) so the read sees post-spend shards
  // from shard_sink (90) / recursive_sink (95). Sits before Vault Heart's
  // 200 so its additive mult gets amplified by the late multiplicatives.
  priority: 100,
  apply: (ctx) => {
    const shards = ctx.state.run.shards;
    if (shards <= 0) return ctx;
    const dChips = shards * CHIPS_PER_SHARD;
    const dMult = shards * MULT_PER_SHARD;
    return {
      ...ctx,
      chips: ctx.chips + dChips,
      mult: ctx.mult + dMult,
      events: emitUpgrade(ctx, 'singularity_engine', dChips, dMult),
    };
  },
});
