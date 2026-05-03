import type { PhaseFn } from '../pipeline/types';
import { detectCombo } from '../scoring/detectCombo';

export const evaluation: PhaseFn = (ctx) => {
  const allFaces = ctx.sim?.finalFaces ?? [];
  // Held-only scoring: only dice in scoringOrder contribute to combo + base chips.
  // scoringOrder also defines left-to-right ordering for downstream position-aware
  // mods (vanguard, capstone, conduit, etc.). Fallback to natural order when
  // scoringOrder is undefined preserves back-compat for tests / migration paths.
  const order = ctx.state.round.scoringOrder ?? allFaces.map((_, i) => i);
  const heldIdxs = order.filter((idx) => idx >= 0 && idx < allFaces.length);
  const heldFaces = heldIdxs.map((i) => allFaces[i]!);
  const combo = detectCombo(heldFaces);
  const sumFaces = heldFaces.reduce((s, f) => s + f, 0);
  return {
    ...ctx,
    combo: {
      id: combo.id,
      tier: combo.tier,
      baseChips: combo.chips,
      baseMult: combo.mult,
      scoringFaces: heldFaces,
    },
    chips: combo.chips + sumFaces,
    mult: combo.mult,
  };
};
