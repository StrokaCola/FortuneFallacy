// Pure helpers for hold-strip drag-reorder. Extracted from Dice3D.ts so the
// slot-snap math is unit-testable in jsdom (Three.js scene plumbing is not).

/**
 * Given a pointer X coordinate (world or screen — must match the slot Xs'
 * coordinate space) and an array of slot X positions, return the index of
 * the nearest slot. Returns -1 if slots is empty.
 */
export function computeDropSlot(pointerX: number, slotXs: number[]): number {
  if (slotXs.length === 0) return -1;
  let bestIdx = 0;
  let bestDist = Math.abs(pointerX - slotXs[0]!);
  for (let i = 1; i < slotXs.length; i++) {
    const d = Math.abs(pointerX - slotXs[i]!);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}
