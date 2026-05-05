import type { PhaseFn } from '../pipeline/types';
import { getDiceSpec } from '../run/diceContext';
import { spatialIdxForValue } from '../../data/dice';

// WILD sentinel value used over the wire as a numeric face. The pipeline
// substitutes this back to the symbolic 'WILD' during evaluation.
export const WILD_SENTINEL = -1;

export const initSimulation: PhaseFn = (ctx) => {
  const dice = ctx.state.round.dice;
  const spec = getDiceSpec(ctx.state);
  const diceToRoll = dice
    .map((d, i) => (d.locked ? -1 : i))
    .filter((i) => i >= 0);

  // For each die we produce two parallel arrays:
  //   predeterminedFaces — the rolled VALUE that the game stores on the die
  //     (this is what the HUD reads).
  //   predeterminedFaceIdx — the 1-based SPATIAL face index that physics
  //     should orient up. For d6 with `faces:[1..6]` they match, but for
  //     Fibonacci [1,1,2,3,5,8] / Eclipse [0,0,0,1,1,1] / Ophiuchus the
  //     value diverges from the spatial index, and we need the spatial
  //     index for `faceCorrection` to land the correct face up.
  const predeterminedFaces: number[] = [];
  const predeterminedFaceIdx: number[] = [];
  dice.forEach((d, i) => {
    const dieSpec = spec[i];
    if (d.locked) {
      predeterminedFaces.push(d.face);
      // For a locked die, find the first spatial face that matches the
      // current value. With duplicate values (e.g. Fibonacci's two 1s) this
      // arbitrarily picks the first occurrence — fine because the die isn't
      // physically re-simulated, so the choice never produces a visible snap.
      const idx = dieSpec ? spatialIdxForValue(dieSpec.faces, d.face) : d.face;
      predeterminedFaceIdx.push(idx);
      return;
    }
    if (!dieSpec || dieSpec.faces.length === 0) {
      const fallback = ctx.rng.int(1, 6);
      predeterminedFaces.push(fallback);
      predeterminedFaceIdx.push(fallback);
      return;
    }
    const idx = ctx.rng.int(0, dieSpec.faces.length - 1);
    const face = dieSpec.faces[idx]!;
    if (typeof face === 'number') {
      predeterminedFaces.push(face);
    } else if (face === 'WILD') {
      predeterminedFaces.push(WILD_SENTINEL);
    } else {
      predeterminedFaces.push(0); // BLANK
    }
    predeterminedFaceIdx.push(idx + 1);
  });
  // Per-die shape from the constellation's dice spec. Falls back to 'd6'
  // for any unspecified entry so legacy callers / tests stay valid.
  const diceShapes = dice.map((_, i) => spec[i]?.shape ?? 'd6');

  return {
    ...ctx,
    simRequest: {
      diceToRoll,
      seed: ctx.rng.seed,
      predeterminedFaces,
      predeterminedFaceIdx,
      diceShapes,
    },
  };
};

