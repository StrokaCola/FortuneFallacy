// Mod Gravity: when the player scores 4+ dice in a single hand, the
// highest-face die gets a flat +5 mult bonus this score. The plan
// originally framed this as "gain a temporary mod on the highest die"
// — we ship the direct bonus (semantically equivalent for scoring)
// rather than actually mutating diceMods, which would corrupt the
// per-die mod inventory and the parallel edition arrays.
//
// Pairs with wide-scoring constellations (Mensa) and combos that hold
// 4+ dice (Four of a Kind, Large Straight, Five of a Kind).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MIN_SCORING = 4;
// 2026-05-18 balance audit buff: flat bonus 5 → 10. The 4-die scoring
// gate is easy to meet (any straight / four-kind / wide combo) but the
// +5 reward was dwarfed by other late-pipe scaling, so the catalyst
// never made it into winning builds. 10 makes the trigger feel worth
// holding the slot.
const MULT_BONUS = 10;

register({
  id: 'mod_gravity',
  phase: Phase.UPGRADES,
  priority: 70,
  apply: (ctx) => {
    const scoringFaces = ctx.combo?.scoringFaces ?? [];
    if (scoringFaces.length < MIN_SCORING) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + MULT_BONUS,
      events: emitUpgrade(ctx, 'mod_gravity', 0, MULT_BONUS),
    };
  },
});
