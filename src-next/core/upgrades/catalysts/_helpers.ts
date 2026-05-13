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

// Same as emitUpgrade but with explicit phase — used by catalysts that
// register in non-UPGRADES phases (ON_COLLISION, UNHELD_SCAN) so their
// event payload reports the phase they actually fired in.
export function emitUpgradePhase(
  ctx: PipelineCtx,
  id: string,
  phase: Phase,
  deltaChips: number,
  deltaMult: number,
): PipelineCtx['events'] {
  return [
    ...ctx.events,
    { type: 'onUpgradeTriggered', payload: { id, phase, deltaChips, deltaMult } },
  ];
}

// Returns the rolled faces that the player did NOT select for scoring this
// hand, paired with their dice indices. Falls back to "nothing unheld" when
// scoringOrder is missing — the default scoring order is "all dice", so
// there's nothing left over.
export function getUnheldFaces(ctx: PipelineCtx): { faces: number[]; indices: number[] } {
  const all = ctx.sim?.finalFaces ?? [];
  const order = new Set(ctx.state.round.scoringOrder ?? all.map((_, i) => i));
  const indices: number[] = [];
  const faces: number[] = [];
  for (let i = 0; i < all.length; i++) {
    if (!order.has(i)) {
      indices.push(i);
      faces.push(all[i]!);
    }
  }
  return { faces, indices };
}
