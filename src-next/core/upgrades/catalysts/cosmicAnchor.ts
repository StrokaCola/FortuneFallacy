// Cosmic Anchor (mythic) — no scoring effect; the real magic lives in
// core/round/transitions.ts startBlind where the affliction resolver
// halves target-tax magnitudes and compounding-tax accrual when this
// catalyst is owned. Registered here as a no-op so the pipeline knows
// the id exists (and so the postmortem's catalystChips map has a slot
// for it, even though it never contributes chips/mult directly).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'cosmic_anchor',
  phase: Phase.UPGRADES,
  priority: 10,
  apply: (ctx) => ctx,
});
