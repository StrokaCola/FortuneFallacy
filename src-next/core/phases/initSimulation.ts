import type { PhaseFn } from '../pipeline/types';
import { getDiceSpec } from '../run/diceContext';

// WILD sentinel value used over the wire as a numeric face. The pipeline
// substitutes this back to the symbolic 'WILD' during evaluation.
export const WILD_SENTINEL = -1;

export const initSimulation: PhaseFn = (ctx) => {
  const dice = ctx.state.round.dice;
  const spec = getDiceSpec(ctx.state);
  const diceToRoll = dice
    .map((d, i) => (d.locked ? -1 : i))
    .filter((i) => i >= 0);

  // Per-die predetermined face: locked dice keep their current face; unlocked
  // dice draw a uniformly random index into that die's spec face list, then
  // map to the actual face value (or WILD_SENTINEL for wildcard faces).
  const predeterminedFaces = dice.map((d, i) => {
    if (d.locked) return d.face;
    const dieSpec = spec[i];
    if (!dieSpec || dieSpec.faces.length === 0) return ctx.rng.int(1, 6);
    const idx = ctx.rng.int(0, dieSpec.faces.length - 1);
    const face = dieSpec.faces[idx]!;
    if (typeof face === 'number') return face;
    if (face === 'WILD') return WILD_SENTINEL;
    return 0; // BLANK
  });
  return {
    ...ctx,
    simRequest: { diceToRoll, seed: ctx.rng.seed, predeterminedFaces },
  };
};
