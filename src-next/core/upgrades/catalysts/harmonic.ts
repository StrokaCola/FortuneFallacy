// Harmonic: counts mod ids that appear on 2 or more dice (run.diceMods).
// Each such mod contributes +25 chips and a ×1.25 multiplicative mult.
// Doesn't fire if the player owns no mods or only singletons.
//
// Pairs strongly with Conductor / Phase-Shift / forge-heavy builds. Caps
// naturally at the number of distinct mods in play, so it's powerful but
// not explosive (forge builds typically run 3-5 distinct repeats).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'harmonic',
  phase: Phase.UPGRADES,
  priority: 120,
  apply: (ctx) => {
    const diceMods = ctx.state.run.diceMods ?? [];
    const counts = new Map<string, number>();
    for (const slots of diceMods) {
      const seenOnThisDie = new Set<string>();
      for (const id of slots) {
        if (seenOnThisDie.has(id)) continue; // count once per die
        seenOnThisDie.add(id);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    let repeated = 0;
    for (const c of counts.values()) if (c >= 2) repeated++;
    if (repeated === 0) return ctx;
    const dChips = repeated * 25;
    const newMult = ctx.mult * (1 + repeated * 0.25);
    return {
      ...ctx,
      chips: ctx.chips + dChips,
      mult: newMult,
      events: emitUpgrade(ctx, 'harmonic', dChips, newMult - ctx.mult),
    };
  },
});
