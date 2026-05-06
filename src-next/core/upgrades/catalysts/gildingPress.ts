// Gilding Press: registers as a no-op in the upgrades phase — its real
// effect lives in core/phases/upgrades.ts applyModScoring, which calls
// applyDieModStep a second time on the FIRST mod of each die for chips
// only when 'gilding_press' is in run.catalysts.
//
// Registering keeps the catalyst visible to registry-iterating tools
// (codex, devtools) without running per-hand logic here.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'gilding_press',
  phase: Phase.UPGRADES,
  priority: 0,
  apply: (ctx) => ctx,
});
