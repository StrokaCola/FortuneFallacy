// The Patient — Every 3rd hand of the run: +50 chips and +3 mult.
// Same rhythm as Patience Counter (the catalyst whose 5-hit count
// unlocks this one) but tighter cadence and smaller per-fire payoff.
//
// Fires when the upcoming hand index (handsPlayed + 1) is divisible
// by 3 — so hands 3, 6, 9, 12, ... of the run. Resets to the
// run-scoped counter (never per-blind) so a player can plan around
// the rhythm across multiple blinds.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'the_patient',
  phase: Phase.UPGRADES,
  priority: 80,
  apply: (ctx) => {
    const nextHandIdx = (ctx.state.run.handsPlayed ?? 0) + 1;
    if (nextHandIdx % 3 !== 0) return ctx;
    return {
      ...ctx,
      chips: ctx.chips + 50,
      mult: ctx.mult + 3,
      events: emitUpgrade(ctx, 'the_patient', 50, 3),
    };
  },
});
