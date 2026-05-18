// 2026-05-18 balance audit: per-unique-face multiplier nerfed 1.25 → 1.20.
// Prior value gave ×3.05 mult at 5 unique faces (Lyra default), 80%+
// auto-pick rate in winning builds. New value lands at ×2.49 — still
// strong but no longer a strict upgrade over every other face catalyst.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

const PER_UNIQUE_MULT = 1.20;

register({
  id: 'entropy_index',
  phase: Phase.UPGRADES,
  priority: 200,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    if (faces.length === 0) return ctx;
    const uniq = new Set(faces).size;
    const factor = Math.pow(PER_UNIQUE_MULT, uniq);
    const newMult = ctx.mult * factor;
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: { id: 'entropy_index', phase: Phase.UPGRADES, deltaChips: 0, deltaMult: newMult - ctx.mult },
        },
      ],
    };
  },
});
