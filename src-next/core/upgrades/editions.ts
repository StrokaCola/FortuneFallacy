import type { CatalystEdition } from '../../state/slices/run';

// Drop probabilities per offered catalyst. Sum ≈ 0.103 — most catalysts
// still roll plain. Void is ultra-rare (0.3%): per-run encounter rate is
// roughly 5–8% across ~24 catalyst offers, so seeing one feels like a
// genuine surprise rather than an expectation.
const EDITION_WEIGHTS: ReadonlyArray<{ edition: CatalystEdition; chance: number }> = [
  { edition: 'foil', chance: 0.05 },
  { edition: 'holo', chance: 0.03 },
  { edition: 'poly', chance: 0.02 },
  { edition: 'void', chance: 0.003 },
];

// Roll an edition stamp for a catalyst offer. Returns undefined for "plain".
// Pure function; rng is a 0..1 supplier so it's reproducible in tests.
export function rollCatalystEdition(rng: () => number): CatalystEdition | undefined {
  const r = rng();
  let acc = 0;
  for (const { edition, chance } of EDITION_WEIGHTS) {
    acc += chance;
    if (r < acc) return edition;
  }
  return undefined;
}

// Compute the edition's bonus given the catalyst's own contribution this
// trigger. Foil/Holo are flat — they're a "you fired" reward. Poly is
// proportional, +50% of the catalyst's contribution this trigger. Void
// adds no per-fire bonus — its value is freeing the slot it occupies.
export function editionBonus(
  edition: CatalystEdition,
  deltaChips: number,
  deltaMult: number,
): { bonusChips: number; bonusMult: number } {
  switch (edition) {
    case 'foil': return { bonusChips: 50, bonusMult: 0 };
    case 'holo': return { bonusChips: 0,  bonusMult: 10 };
    case 'poly': return { bonusChips: deltaChips * 0.5, bonusMult: deltaMult * 0.5 };
    case 'void': return { bonusChips: 0, bonusMult: 0 };
  }
}

// Pretty label for tooltips and badges.
export function editionLabel(edition: CatalystEdition): string {
  switch (edition) {
    case 'foil': return 'Foil';
    case 'holo': return 'Holographic';
    case 'poly': return 'Polychrome';
    case 'void': return 'Void';
  }
}

// Edition accent color — also used by the offer card border and the
// upgrade-fired animation.
export function editionColor(edition: CatalystEdition): string {
  switch (edition) {
    case 'foil': return '#88ddff';
    case 'holo': return '#cc88ff';
    case 'poly': return '#ff7847';
    case 'void': return '#aa66ff';
  }
}

// Whether this catalyst edition consumes a slot in the player's catalyst
// budget. Void editions don't — they're the slot-cap-bypass mechanic that
// unlocks build identity at endgame. All other editions (and plain
// catalysts) take exactly one slot.
export function editionTakesSlot(edition: CatalystEdition | undefined): boolean {
  return edition !== 'void';
}

// Mod-tier edition bonuses. Smaller magnitudes than catalyst editions —
// mods fire MANY times per hand (once per scoring die), so per-fire
// bonuses need to be modest to avoid runaway combos.
import type { ModEdition } from '../../state/slices/run';

export function modEditionBonus(
  edition: ModEdition,
  modContribChips: number,
  modContribMult: number,
): { bonusChips: number; bonusMult: number } {
  switch (edition) {
    case 'foil': return { bonusChips: 20, bonusMult: 0 };
    case 'holo': return { bonusChips: 0,  bonusMult: 4 };
    case 'poly': return { bonusChips: modContribChips * 0.25, bonusMult: modContribMult * 0.25 };
  }
}
