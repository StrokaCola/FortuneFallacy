import { Phase, type PipelineCtx } from '../../pipeline/types';

// Append an `onUpgradeTriggered` event to a pipeline ctx without mutating it.
// Standardizes the event payload across catalysts so the HUD's per-trigger
// breakdown stays consistent.
export function emitUpgrade(
  ctx: PipelineCtx,
  id: string,
  deltaChips: number,
  deltaMult: number,
): PipelineCtx['events'] {
  return [
    ...ctx.events,
    {
      type: 'onUpgradeTriggered',
      payload: { id, phase: Phase.UPGRADES, deltaChips, deltaMult },
    },
  ];
}
