// Hollow Bishop — Full House and above grant +12 mult. One Pair and
// Two Pair are taxed (chips × 0.5). High-skill catalyst: rewards
// players who can consistently land mid+ combos (Mensa, Argo,
// galaxy-leveled hands) while punishing the safer "any pair counts"
// playstyle.
//
// 2026-05-18 balance audit: pair penalty softened from binary chip-erase
// to a 50% chip tax. Pre-audit zero-chip was mechanically harsher than
// its rare-tier siblings (Bone Tax: −15%, Witch's Bargain: −8/die) and
// made thin-build runs unrecoverable. The 50% tax preserves the
// "discourage pairs" identity without killing the run.
//
// Priority 120 — after combo-tribal multipliers so they can multiply
// the +12 mult bonus; the chip-tax happens at the same fire so a
// player who locks One Pair sees a single explicit "you lost half the
// chips this hand" event in their breakdown.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const PENALIZED_COMBOS = new Set(['one_pair', 'two_pair']);
const PAIR_CHIPS_TAX = 0.5;
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
      const taxedChips = Math.floor(ctx.chips * PAIR_CHIPS_TAX);
      const chipsLoss = ctx.chips - taxedChips;
      if (chipsLoss <= 0) return ctx;
      return {
        ...ctx,
        chips: taxedChips,
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
