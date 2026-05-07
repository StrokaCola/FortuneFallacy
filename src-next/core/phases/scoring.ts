import type { PhaseFn } from '../pipeline/types';
import { applyChain } from '../scoring/constellationChain';
import { getChainConfig } from '../run/diceContext';
import { safeMul, safeRound } from '../scoring/safeMath';

export const scoring: PhaseFn = (ctx) => {
  const tier = ctx.combo?.tier ?? 0;
  const chain = applyChain(
    tier,
    ctx.state.round.chainLen,
    ctx.state.round.chainTier,
    getChainConfig(ctx.state),
  );
  const base = safeMul(ctx.chips, ctx.mult);
  const total = safeRound(safeMul(base, chain.chainMult));
  return {
    ...ctx,
    chain: { len: chain.chainLen, tier: chain.chainTier, mult: chain.chainMult, broke: chain.broke },
    total,
  };
};
