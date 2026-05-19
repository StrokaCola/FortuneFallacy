// Voidforge (mythic) — Each blind cleared this run grants +1 permanent
// mult to every hand. Stack accrued in core/round/scalingHooks.ts
// accrueBlindCleared; reset to 0 in transitions.bustBlind via the
// catalystStacks wipe. Pure additive — sits before late multiplicatives
// so its accumulated bonus rides downstream amplifiers.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'voidforge',
  phase: Phase.UPGRADES,
  priority: 110,
  apply: (ctx) => {
    const stacks = (ctx.state.run.catalystStacks ?? {})['voidforge'] ?? 0;
    if (stacks <= 0) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + stacks,
      events: emitUpgrade(ctx, 'voidforge', 0, stacks),
    };
  },
});
