import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'entropy_stone',
  phase: Phase.UPGRADES,
  priority: 200,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    if (faces.length === 0) return ctx;
    const uniq = new Set(faces).size;
    const factor = Math.pow(1.25, uniq);
    const newMult = ctx.mult * factor;
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: { id: 'entropy_stone', phase: Phase.UPGRADES, deltaChips: 0, deltaMult: newMult - ctx.mult },
        },
      ],
    };
  },
});
