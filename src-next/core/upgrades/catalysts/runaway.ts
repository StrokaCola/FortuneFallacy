// Runaway (2026-05-18 audit add): scaling uncommon. Each scored
// straight (small or large) banks +1 stack. Each stack contributes
// +0.10× mult per hand (multiplicative on the running mult).
// Stacks live on run.catalystStacks['runaway'] and reset to 0 on
// bust along with the rest of catalystStacks.
//
// Intended Triumvirate / Lyra straight-builder synergy — the
// archetype lacked a snowball lane. The 0.10× per stack is modest
// enough that early stacks feel small but a 5-straight run lands a
// 50% mult bonus.
//
// Stack increment lives in core/round/scalingHooks.ts
// (accrueScalingStacks). This file just applies the bonus.

import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_STACK = 0.10;

register({
  id: 'runaway',
  phase: Phase.UPGRADES,
  priority: 170,
  apply: (ctx) => {
    const stacks = ctx.state.run.catalystStacks?.['runaway'] ?? 0;
    if (stacks <= 0) return ctx;
    const factor = 1 + stacks * MULT_PER_STACK;
    const newMult = ctx.mult * factor;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'runaway', 0, newMult - ctx.mult),
    };
  },
});
