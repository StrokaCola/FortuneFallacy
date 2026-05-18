// Iron Six: each scoring 6 also gives +2 mult (in addition to Six Bias chips).
// Counts faces in the SCORING set only (matches Six Bias semantics).
//
// 2026-05-18 balance audit buff: per-6 mult bumped 1 → 2. Pre-audit
// +1 averaged ~0.85 mult per Lyra hand (5 dice × 17% face-6 rate)
// — below the floor that makes a common catalyst worth a slot.
// Doubling the per-6 bonus brings it in line with other face commons
// like Even Keeled (+23%).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_SIX = 2;

register({
  id: 'iron_six',
  phase: Phase.UPGRADES,
  priority: 11,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringFaces = order
      .filter((idx) => idx >= 0 && idx < faces.length)
      .map((i) => faces[i]!);
    const sixes = scoringFaces.filter((f) => f === 6).length;
    if (sixes === 0) return ctx;
    const bonus = sixes * MULT_PER_SIX;
    return {
      ...ctx,
      mult: ctx.mult + bonus,
      events: emitUpgrade(ctx, 'iron_six', 0, bonus),
    };
  },
});
