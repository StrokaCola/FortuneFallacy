import { getByPhase } from '../upgrades/registry';
import { Phase, type PhaseFn } from '../pipeline/types';

export const onCollision: PhaseFn = (ctx) => {
  let next = ctx;
  for (const u of getByPhase(Phase.ON_COLLISION)) next = u.apply(next);
  return next;
};
