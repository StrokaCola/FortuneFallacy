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
  let total = safeRound(safeMul(base, chain.chainMult));
  // Phase 2B.2 — void-mode banCombo rule. Even if catalysts in the
  // UPGRADES phase added additive chips/mult against the zero'd-out
  // base, a banned combo "doesn't count" and the final score for the
  // hand is forced to 0. Catalyst fires still emit (and their bonuses
  // accumulate) so postmortem stats reflect the activity, but the
  // hand's net score is suppressed.
  if (ctx.state.run.mode === 'void') {
    const rules = ctx.state.run.activeBlindRules ?? [];
    const comboId = ctx.combo?.id ?? '';
    if (
      rules.length > 0 &&
      comboId &&
      rules.some((r) => r.kind === 'banCombo' && r.comboId === comboId)
    ) {
      total = 0;
    }
  }
  return {
    ...ctx,
    chain: { len: chain.chainLen, tier: chain.chainTier, mult: chain.chainMult, broke: chain.broke },
    total,
  };
};
