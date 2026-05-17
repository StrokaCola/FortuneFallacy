// Salt of the Earth — Each hand: +1 shard if shards < 5, otherwise no
// effect. Anti-Stipend by design: Stipend's flat +1/hand caps at 6
// shards; Salt only fires below 5, so it's a recovery tool that
// bounces the wallet back after shop spends without ever
// accumulating beyond the bottom of the pile.
//
// Phase: PRE_ROLL_MODIFIERS so the shard grant lands BEFORE the
// player's hand scores. This way Shard Sink (which spends 1 shard
// for ×1.5 mult) can find a refilled wallet on the same hand.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'salt_of_earth',
  phase: Phase.PRE_ROLL_MODIFIERS,
  priority: 10,
  apply: (ctx) => {
    const shards = ctx.state.run.shards ?? 0;
    if (shards >= 5) return ctx;
    return {
      ...ctx,
      state: {
        ...ctx.state,
        run: { ...ctx.state.run, shards: shards + 1 },
      },
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: { id: 'salt_of_earth', phase: Phase.PRE_ROLL_MODIFIERS, deltaChips: 0, deltaMult: 0 },
        },
      ],
    };
  },
});
