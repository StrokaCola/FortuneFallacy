import type { PhaseFn } from '../pipeline/types';

export const initSimulation: PhaseFn = (ctx) => {
  const dice = ctx.state.round.dice;
  const diceToRoll = dice
    .map((d, i) => (d.locked ? -1 : i))
    .filter((i) => i >= 0);
  // Decide every face up-front from the seeded RNG. Locked dice keep their
  // current face (the simulation merges these back via mergeWithLocks anyway,
  // but storing them here keeps the request self-describing). Unlocked dice
  // get fresh values from ctx.rng so the result is fully reproducible from
  // the run seed alone — physics is purely cosmetic from this point on.
  const predeterminedFaces = dice.map((d) =>
    d.locked ? d.face : ctx.rng.int(1, 6),
  );
  return {
    ...ctx,
    simRequest: { diceToRoll, seed: ctx.rng.seed, predeterminedFaces },
  };
};
