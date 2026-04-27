import type { PhaseFn } from '../pipeline/types';
import { detectCombo } from '../scoring/detectCombo';

export const evaluation: PhaseFn = (ctx) => {
  const faces = ctx.sim?.finalFaces ?? [];
  const combo = detectCombo(faces);
  const sumFaces = faces.reduce((s, f) => s + f, 0);
  return {
    ...ctx,
    combo: {
      id: combo.id,
      tier: combo.tier,
      baseChips: combo.chips,
      baseMult: combo.mult,
      scoringFaces: faces,
    },
    chips: combo.chips + sumFaces,
    mult: combo.mult,
  };
};
