import { getByPhase } from '../upgrades/registry';
import { Phase, type PhaseFn } from '../pipeline/types';

export const preRollModifiers: PhaseFn = (ctx) => {
  let next = ctx;
  for (const u of getByPhase(Phase.PRE_ROLL_MODIFIERS)) next = u.apply(next);
  return next;
};
