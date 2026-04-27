import type { PhaseFn } from '../pipeline/types';
import { applyChain } from '../scoring/constellationChain';

export const scoring: PhaseFn = (ctx) => {
  const tier = ctx.combo?.tier ?? 0;
  const chain = applyChain(tier, ctx.state.round.chainLen, ctx.state.round.chainTier);
  const base = ctx.chips * ctx.mult;
  const total = Math.round(base * chain.chainMult);
  return {
    ...ctx,
    chain: { len: chain.chainLen, tier: chain.chainTier, mult: chain.chainMult, broke: chain.broke },
    total,
  };
};
