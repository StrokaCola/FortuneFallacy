// Bloodied Coin — Each owned Risk-archetype catalyst grants +6 mult
// per hand. Risk-tribal payoff that rewards stacking the tradeoff
// catalysts (Bone Tax, Hollow Bishop, Witch's Bargain) without
// touching their individual costs.
//
// Unlocked at the moment a player commits 3+ risk catalysts in a
// single blind clear (see checkRoadmapUnlocks in transitions.ts).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';
import { lookupCatalyst } from '../../../data/catalysts';

const PER_RISK_MULT = 6;

register({
  id: 'bloodied_coin',
  phase: Phase.UPGRADES,
  priority: 125,
  apply: (ctx) => {
    const owned = ctx.state.run.catalysts;
    let riskCount = 0;
    for (const cid of owned) {
      if (cid === 'bloodied_coin') continue;
      if (lookupCatalyst(cid)?.archetype === 'risk') riskCount++;
    }
    if (riskCount === 0) return ctx;
    const bonus = riskCount * PER_RISK_MULT;
    return {
      ...ctx,
      mult: ctx.mult + bonus,
      events: emitUpgrade(ctx, 'bloodied_coin', 0, bonus),
    };
  },
});
