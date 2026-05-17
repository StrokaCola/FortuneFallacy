// The Confessor — Each die with 3+ mod slots filled grants +3 mult.
// Rewards mod-loaded builds (typically requires the Forged Links
// voucher to reach 3+ slots on a single die). The catalyst's
// unlock condition (own 4 mods on one die) intentionally requires
// reaching the deep end of the mod system first.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const PER_HEAVY_DIE_MULT = 3;
const HEAVY_THRESHOLD = 3;

register({
  id: 'the_confessor',
  phase: Phase.UPGRADES,
  priority: 70,
  apply: (ctx) => {
    const diceMods = ctx.state.run.diceMods;
    let heavyDice = 0;
    for (const slots of diceMods) {
      if (slots.length >= HEAVY_THRESHOLD) heavyDice++;
    }
    if (heavyDice === 0) return ctx;
    const bonus = heavyDice * PER_HEAVY_DIE_MULT;
    return {
      ...ctx,
      mult: ctx.mult + bonus,
      events: emitUpgrade(ctx, 'the_confessor', 0, bonus),
    };
  },
});
