// Short stack-status label for the per-die mods that accrue counters
// during a run. Drives the "+N c", "+0.5m", "3/10", "★ awake" badges
// the Forge detach row + the in-round DieTip both show next to each
// attached mod.
//
// Returns null when the mod has no stack-based effect or the counter
// hasn't started yet (stack === 0) — callers should hide the badge in
// that case rather than render an empty string.

import type { ModDef } from '../../core/mods';

export function formatModStackLabel(def: ModDef, stack: number): string | null {
  if (stack <= 0) return null;
  if (def.tallyChipPerStack)   return `+${stack * def.tallyChipPerStack}c`;
  if (def.cadenceMultPerStack) return `+${stack * def.cadenceMultPerStack}m (blind)`;
  if (def.veteranMultPerStack) return `+${(stack * def.veteranMultPerStack).toFixed(1)}m`;
  if (def.gluttonChipPerStack) return `+${stack * def.gluttonChipPerStack}c`;
  if (def.dormantAwakenAt != null) {
    return stack >= def.dormantAwakenAt ? '★ awake' : `${stack}/${def.dormantAwakenAt}`;
  }
  if (def.ballastChipPerStack) return `+${stack * def.ballastChipPerStack}c`;
  if (def.pyreChipPerStack)    return `+${stack * def.pyreChipPerStack}c`;
  return null;
}
