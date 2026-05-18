// Leveling (2026-05-18 audit add): combo uncommon, Triumvirate-locked.
// Three of a Kind and below count as ONE TIER HIGHER for downstream
// catalysts. So:
//   chance       (tier 0) → reads as one_pair    (tier 1) downstream
//   one_pair     (tier 1) → reads as two_pair    (tier 2)
//   two_pair     (tier 2) → reads as three_kind  (tier 3)
//   three_kind   (tier 3) → reads as sm_straight (tier 4)
// Straights and above are untouched.
//
// Triumvirate identity catalyst — the 3-d12 constellation rarely
// combos because high-variance dice scatter, so this rule-change
// upgrades whatever modest combo lands into the next tier for
// catalysts that gate on it (Three Sigil, Pair Dynamo, Triplet
// Engine, Hollow Bishop, etc.).
//
// Pipeline placement: priority 0 within UPGRADES — runs before any
// other catalyst. EVALUATION phase has already set ctx.combo with
// the base chips/mult lookup, so the base scoring stays
// constellation-honest. Only downstream catalysts see the bumped
// id/tier.
//
// Shop draw filters Leveling out of non-Triumvirate runs via the
// requiresConstellation field (catalystDraw.ts). The fire-time
// guard below catches the edge case where a save migration injects
// it into a Lyra run.

import { register } from '../registry';
import { Phase, type ComboMatch } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const PROMOTION: Record<string, Pick<ComboMatch, 'id' | 'tier'>> = {
  chance:     { id: 'one_pair',    tier: 1 },
  one_pair:   { id: 'two_pair',    tier: 2 },
  two_pair:   { id: 'three_kind',  tier: 3 },
  three_kind: { id: 'sm_straight', tier: 4 },
};

register({
  id: 'leveling',
  phase: Phase.UPGRADES,
  priority: 0,
  apply: (ctx) => {
    if (ctx.state.run.constellationId !== 'triumvirate') return ctx;
    const cur = ctx.combo;
    if (!cur) return ctx;
    const promo = PROMOTION[cur.id];
    if (!promo) return ctx;
    return {
      ...ctx,
      combo: { ...cur, id: promo.id, tier: promo.tier },
      events: emitUpgrade(ctx, 'leveling', 0, 0),
    };
  },
});
