// Hollow Bishop — Full House and above grant +12 mult. One Pair and
// Two Pair are blanked (chips → 0). High-skill catalyst: rewards
// players who can consistently land mid+ combos (Mensa, Argo,
// galaxy-leveled hands) while punishing the safer "any pair counts"
// playstyle.
//
// Priority 120 — after combo-tribal multipliers so they can multiply
// the +12 mult bonus; the chip-blank happens at the same fire so a
// player who locks One Pair sees a single explicit "you lost the
// chips this hand" event in their breakdown.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const PENALIZED_COMBOS = new Set(['one_pair', 'two_pair']);
// Five-of-a-Kind isn't a Full House but it's the strongest combo in
// the game — exclude it from the gating set so the catalyst rewards
// every "above Three of a Kind" tier the way the name implies.
const REWARDED_COMBOS = new Set([
  'full_house', 'lg_straight', 'four_kind', 'five_kind',
]);

register({
  id: 'hollow_bishop',
  phase: Phase.UPGRADES,
  priority: 120,
  apply: (ctx) => {
    const id = ctx.combo?.id;
    if (!id) return ctx;
    if (PENALIZED_COMBOS.has(id)) {
      const chipsLoss = ctx.chips;
      return {
        ...ctx,
        chips: 0,
        events: emitUpgrade(ctx, 'hollow_bishop', -chipsLoss, 0),
      };
    }
    if (REWARDED_COMBOS.has(id)) {
      return {
        ...ctx,
        mult: ctx.mult + 12,
        events: emitUpgrade(ctx, 'hollow_bishop', 0, 12),
      };
    }
    return ctx;
  },
});
