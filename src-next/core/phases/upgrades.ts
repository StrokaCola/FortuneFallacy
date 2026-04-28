import { getByPhase } from '../upgrades/registry';
import { Phase, type PhaseFn } from '../pipeline/types';
import { hasDebuff } from '../round/debuffs';
import { lookupMod } from '../mods';

const ALWAYS_ACTIVE = new Set<string>();

export const upgrades: PhaseFn = (ctx) => {
  let next = ctx;

  if (!hasDebuff(ctx.state, 'disable_oracles')) {
    const owned = new Set(ctx.state.run.oracles);
    for (const u of getByPhase(Phase.UPGRADES)) {
      if (!ALWAYS_ACTIVE.has(u.id) && !owned.has(u.id)) continue;
      next = u.apply(next);
    }
  }

  next = applyModScoring(next);

  return next;
};

const applyModScoring: PhaseFn = (ctx) => {
  const faces = ctx.sim?.finalFaces ?? [];
  const diceMods = ctx.state.round.diceMods;
  let chips = ctx.chips;
  let mult = ctx.mult;
  const events = [...ctx.events];

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i]!;
    const mods = diceMods[i] ?? [];
    for (const id of mods) {
      const def = lookupMod(id);
      if (!def) continue;
      let dChips = 0;
      let dMult = 0;
      if (def.scoreBonus) dChips += def.scoreBonus;
      if (def.multBonus) dMult += def.multBonus;
      if (def.snakeEyes && face === 1) dMult += def.snakeEyes;
      if (def.highFaceMult && (face === 5 || face === 6)) dMult += def.highFaceMult;
      if (dChips !== 0 || dMult !== 0) {
        chips += dChips;
        mult += dMult;
        events.push({
          type: 'onUpgradeTriggered',
          payload: { id: `mod:${id}@${i}`, phase: Phase.UPGRADES, deltaChips: dChips, deltaMult: dMult },
        });
      }
    }
  }
  return { ...ctx, chips, mult, events };
};
