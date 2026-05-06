import type { CatalystEdition } from '../../state/slices/run';

// Drop probabilities per offered catalyst. Sum is 0.10 — 9 in 10 catalysts
// roll as plain. Tuned against the plan's "small but rewarding" target so
// editions feel like a treat, not a power-ceiling expectation.
const EDITION_WEIGHTS: ReadonlyArray<{ edition: CatalystEdition; chance: number }> = [
  { edition: 'foil', chance: 0.05 },
  { edition: 'holo', chance: 0.03 },
  { edition: 'poly', chance: 0.02 },
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
// proportional, +50% of the catalyst's contribution this trigger.
export function editionBonus(
  edition: CatalystEdition,
  deltaChips: number,
  deltaMult: number,
): { bonusChips: number; bonusMult: number } {
  switch (edition) {
    case 'foil': return { bonusChips: 50, bonusMult: 0 };
    case 'holo': return { bonusChips: 0,  bonusMult: 10 };
    case 'poly': return { bonusChips: deltaChips * 0.5, bonusMult: deltaMult * 0.5 };
  }
}

// Pretty label for tooltips and badges.
export function editionLabel(edition: CatalystEdition): string {
  switch (edition) {
    case 'foil': return 'Foil';
    case 'holo': return 'Holographic';
    case 'poly': return 'Polychrome';
  }
}

// Edition accent color — also used by the offer card border and the
// upgrade-fired animation.
export function editionColor(edition: CatalystEdition): string {
  switch (edition) {
    case 'foil': return '#88ddff';
    case 'holo': return '#cc88ff';
    case 'poly': return '#ff7847';
  }
}
