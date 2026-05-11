// Lunar Phases: 8-stage moon cycle. Each hand advances by one. On full
// moon (phase 8) the catalyst bakes +0.1× mult permanent then resets to 0.
//
// State lives in run.lunarPhase (0..7) and run.lunarBakedMult (the cumulative
// permanent ×mult bonus). Phase advance + reset happens in
// actions/handlers/roll.ts SCORE_HAND. Apply here just reads the baked bonus.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'lunar_phases',
  phase: Phase.UPGRADES,
  priority: 88,
  apply: (ctx) => {
    const baked = ctx.state.run.lunarBakedMult ?? 0;
    if (baked <= 0) return ctx;
    const newMult = ctx.mult * (1 + baked);
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'lunar_phases', 0, newMult - ctx.mult),
    };
  },
});
