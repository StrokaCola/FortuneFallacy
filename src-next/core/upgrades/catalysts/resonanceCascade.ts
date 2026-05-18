// Resonance Cascade (2026-05-18 audit add): collision rare. Each
// collision pair this hand banks +1 stack; each stack contributes
// +0.05× mult (additive into the running mult) on this AND every
// future hand of the run. Cap at +20 stacks (effective +1.0× mult).
// Stacks reset to 0 on bust along with the rest of catalystStacks.
//
// Increment side lives in core/round/scalingHooks.ts — counts unique
// collision pairs per scored hand and bumps the stack counter. This
// file only applies the bonus during the UPGRADES phase.
//
// Intent: bridges physics → permanent scoring scaling. Collision
// archetype already has Kinetic Charge / Chain Reaction / Kindred
// Clatter for per-hand bonuses; this adds the long-term snowball.

import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade, emitUpgradePhase } from './_helpers';

export const RESONANCE_CASCADE_MULT_PER_STACK = 0.05;
export const RESONANCE_CASCADE_STACK_CAP = 20;

// Apply side — runs every hand during UPGRADES and adds the
// accumulated stack bonus to mult.
register({
  id: 'resonance_cascade',
  phase: Phase.UPGRADES,
  priority: 175,
  apply: (ctx) => {
    const stacks = ctx.state.run.catalystStacks?.['resonance_cascade'] ?? 0;
    if (stacks <= 0) return ctx;
    const bonus = stacks * RESONANCE_CASCADE_MULT_PER_STACK;
    return {
      ...ctx,
      mult: ctx.mult + bonus,
      events: emitUpgrade(ctx, 'resonance_cascade', 0, bonus),
    };
  },
});

// Increment side — ON_COLLISION pass. Same-id pipeline registry
// would reject the second register() call, so use a distinct
// registry id for the increment hook. Ownership of the actual
// catalyst is read from state.run.catalysts, not the registry id.
register({
  id: 'resonance_cascade__inc',
  phase: Phase.ON_COLLISION,
  priority: 40,
  apply: (ctx) => {
    if (!ctx.state.run.catalysts.includes('resonance_cascade')) return ctx;
    const pairs = ctx.sim?.collisionPairs;
    if (!pairs || pairs.length === 0) return ctx;
    const cur = ctx.state.run.catalystStacks?.['resonance_cascade'] ?? 0;
    if (cur >= RESONANCE_CASCADE_STACK_CAP) return ctx;
    // Dedupe to unordered pairs — same pattern as Kindred Clatter so
    // a long rapier contact doesn't pile stacks.
    const seen = new Set<string>();
    for (const [a, b] of pairs) {
      if (a === b) continue;
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      seen.add(`${lo}:${hi}`);
    }
    if (seen.size === 0) return ctx;
    const gained = Math.min(seen.size, RESONANCE_CASCADE_STACK_CAP - cur);
    const next = cur + gained;
    return {
      ...ctx,
      state: {
        ...ctx.state,
        run: {
          ...ctx.state.run,
          catalystStacks: {
            ...(ctx.state.run.catalystStacks ?? {}),
            resonance_cascade: next,
          },
        },
      },
      // Event id remains the player-facing 'resonance_cascade' so the
      // CatalystStrip pulses the right card on the collision tick.
      events: emitUpgradePhase(ctx, 'resonance_cascade', Phase.ON_COLLISION, 0, 0),
    };
  },
});
