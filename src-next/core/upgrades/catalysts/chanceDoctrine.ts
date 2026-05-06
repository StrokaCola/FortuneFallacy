// Chance Doctrine: Chance hand → +20 chips and +4 mult per scoring die.
// Pays out a flat reward for "no combo" hands so a player who whiffs all
// rolls still has a payoff lane. Pairs with Cold Hand and Milky Way galaxy.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'chance_doctrine',
  phase: Phase.UPGRADES,
  priority: 45,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'chance') return ctx;
    const dice = ctx.combo.scoringFaces.length;
    if (dice === 0) return ctx;
    const dChips = 20 * dice;
    const dMult = 4 * dice;
    return {
      ...ctx,
      chips: ctx.chips + dChips,
      mult: ctx.mult + dMult,
      events: emitUpgrade(ctx, 'chance_doctrine', dChips, dMult),
    };
  },
});
