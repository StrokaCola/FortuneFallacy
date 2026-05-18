// Prime Resonance: mult is raised to the power 1.10 per scoring die.
// 5 scoring dice (Lyra default): mult^(1.10^5) ≈ mult^1.61 — a ~61%
// power-law boost on the mult axis. Compounds late-blind because
// catalyst stacks already inflated mult.
//
// 2026-05-18 balance audit: per-die exponent raised 1.05 → 1.10. Prior
// value gave only +11% impact at 5 dice (×1.28 mult^1.28) — strict
// trap rare. New value lands the catalyst around +60% impact, putting
// it in competitive range with Nova Burst (+36%) and other late-pipe
// scaling rares.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const PER_DIE_BASE = 1.10;

register({
  id: 'prime_resonance',
  phase: Phase.UPGRADES,
  // Run very late in the upgrade pass so it operates on the fully-built mult.
  priority: 180,
  apply: (ctx) => {
    if (!ctx.combo) return ctx;
    const scoringCount = ctx.combo.scoringFaces.length;
    if (scoringCount === 0 || ctx.mult <= 1) return ctx;
    const exponent = Math.pow(PER_DIE_BASE, scoringCount);
    const newMult = Math.pow(ctx.mult, exponent);
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'prime_resonance', 0, newMult - ctx.mult),
    };
  },
});
