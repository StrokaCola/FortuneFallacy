// Counter's Purse — Each 3 shards held: +1 chip per scored die this
// hand. Reads the live shard balance at scoring time; pairs naturally
// with Stipend / Salt of the Earth and the new Magpie / Vault Heart in
// a shard-hoarder build.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const SHARDS_PER_TIER = 3;

register({
  id: 'counter_purse',
  phase: Phase.UPGRADES,
  // Mid priority — same band as economy_engine (95) so the read sees
  // post-spend shard balance from shard_sink (90) and friends.
  priority: 95,
  apply: (ctx) => {
    const shards = ctx.state.run.shards;
    if (shards < SHARDS_PER_TIER) return ctx;
    const scoredCount = (ctx.state.round.scoringOrder ?? []).length;
    if (scoredCount === 0) return ctx;
    const perDie = Math.floor(shards / SHARDS_PER_TIER);
    const dChips = perDie * scoredCount;
    if (dChips === 0) return ctx;
    return {
      ...ctx,
      chips: ctx.chips + dChips,
      events: emitUpgrade(ctx, 'counter_purse', dChips, 0),
    };
  },
});
