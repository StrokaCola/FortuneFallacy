// Eclipse Heart (mythic) — no scoring effect; the real benefit lives in:
//   - core/round/transitions.ts startBlind  (+2 hands max per blind)
//   - core/vouchers/index.ts maxCatalystSlots (+1 catalyst slot)
// Registered here as a no-op so the postmortem map and Codex have an
// entry, and so the pipeline knows the id is valid.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'eclipse_heart',
  phase: Phase.UPGRADES,
  priority: 10,
  apply: (ctx) => ctx,
});
