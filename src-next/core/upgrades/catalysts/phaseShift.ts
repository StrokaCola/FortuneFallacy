// Phase-Shift: scales selected per-die counters (Mirror Pair, Conduit,
// Crescendo, Pip Charge) by adding +1 to each instance's contribution.
//
// Implementation note: rather than mutate ModDef definitions (which would
// be globally visible), we recompute the bonus here by inspecting which
// dice carry the listed mods and emitting an additive mult for each.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const SCALED_MODS = new Set(['mirror_pair', 'conduit', 'crescendo', 'pip_charge']);

register({
  id: 'phase_shift',
  phase: Phase.UPGRADES,
  priority: 70,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringDice = order.filter((idx) => idx >= 0 && idx < faces.length);
    if (scoringDice.length === 0) return ctx;

    let dChips = 0;
    let dMult = 0;
    const scoringFaces = scoringDice.map((i) => faces[i]!);

    for (let pos = 0; pos < scoringDice.length; pos++) {
      const i = scoringDice[pos]!;
      const face = faces[i]!;
      const mods = ctx.state.run.diceMods[i] ?? [];
      for (const id of mods) {
        if (!SCALED_MODS.has(id)) continue;
        if (id === 'mirror_pair') {
          const matches = scoringFaces.filter((f) => f === face).length - 1;
          if (matches > 0) dMult += 1 * matches; // +1 per matching die
        } else if (id === 'conduit' && pos > 0) {
          dMult += 1 * pos; // +1 per die scored before
        } else if (id === 'crescendo' && pos < scoringDice.length - 1) {
          dMult += 1 * (scoringDice.length - 1 - pos); // +1 per die scored after
        } else if (id === 'pip_charge') {
          dChips += face; // +1 per pip × face
        }
      }
    }
    if (dChips === 0 && dMult === 0) return ctx;
    return {
      ...ctx,
      chips: ctx.chips + dChips,
      mult: ctx.mult + dMult,
      events: emitUpgrade(ctx, 'phase_shift', dChips, dMult),
    };
  },
});
