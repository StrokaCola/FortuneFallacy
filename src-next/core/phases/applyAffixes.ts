// src-next/core/phases/applyAffixes.ts
// Scoring-pipeline phase. Runs each affix's effect function with the
// shared AffixContext. The phase composer should only call this when
// run.mode === 'void'; behaviour outside void is undefined (and never
// invoked).

import type { AffixContext, AffixedItem } from '../../voidmode/types';
import type { CatalystMeta } from '../../data/catalysts';

export function applyAffixes(
  ctx: AffixContext,
  items: ReadonlyArray<AffixedItem<CatalystMeta>>,
): void {
  for (const item of items) {
    for (const affix of item.affixes) {
      affix.effect(ctx);
    }
  }
}
