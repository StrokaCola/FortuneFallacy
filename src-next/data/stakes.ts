// Stakes — per-run difficulty modifiers stacked on top of the chosen
// constellation. Inspired by Balatro stakes; cosmos-flavored heat ladder.
// Each stake unlocks the next when cleared on that constellation.

export type Stake = {
  id: string;
  name: string;
  /** Display color for chips/badges. */
  color: string;
  /** Short flavor for the picker hover. */
  flavor: string;
  /** Bullet list of player-facing modifiers, in order of severity. */
  rules: string[];
  /** Round target = baseTarget × targetMult. 1 = no change. */
  targetMult: number;
  /** Added to base hands per round (negative makes runs harder). */
  handsDelta: number;
  /** Added to per-hand reroll budget (negative = fewer rerolls). */
  rerollsDelta: number;
  /** Multiplier applied to shop offer prices (1 = unchanged). */
  shopPriceMult: number;
};

export const STAKES: Stake[] = [
  {
    id: 'spark',
    name: 'Spark',
    color: '#dcd4ff',
    flavor: 'A first warming. One extra hand to learn the rhythm.',
    // 2026-05-08 — +1 hand on Spark only, to bring scaling-build clear-rate
    // to ~70% and give new players a forgiving runway. Higher stakes (Ember+)
    // revert to the standard 3-hand budget so the difficulty gradient widens.
    rules: ['+1 hand per round', 'Standard targets'],
    targetMult: 1.0,
    handsDelta: 1,
    rerollsDelta: 0,
    shopPriceMult: 1.0,
  },
  {
    id: 'ember',
    name: 'Ember',
    color: '#ff7847',
    flavor: 'The fires take hold. Targets bite harder.',
    rules: ['Targets +20%'],
    targetMult: 1.2,
    handsDelta: 0,
    rerollsDelta: 0,
    shopPriceMult: 1.0,
  },
  {
    id: 'pyre',
    name: 'Pyre',
    color: '#f5c451',
    flavor: 'No room for indecision. Pick and commit.',
    rules: ['Targets +20%', '−1 reroll per round'],
    targetMult: 1.2,
    handsDelta: 0,
    rerollsDelta: -1,
    shopPriceMult: 1.0,
  },
  // 2026-05-12 QA pass: stake cliff softened. Sim showed Lyra/scaling
  // any-clear dropping 51% (Pyre) → 15% (Beacon) → 12% → 9%. Beacon now
  // keeps 3 hands (was 2) so the top three stakes feel like a graded ramp
  // instead of a single brick wall after Pyre.
  //
  // 2026-05-18 balance audit: shop tax further softened (1.25 → 1.15).
  // The Pyre→Beacon transition stacked three penalties at once
  // (+10% target, +25% shop, no recovery levers vs. Pyre's two). Dropping
  // the shop tax to 1.15 keeps Beacon distinct from Pyre via the target
  // bump but unblocks economy-driven builds.
  {
    id: 'beacon',
    name: 'Beacon',
    color: '#7be3ff',
    flavor: 'The Night Market grows greedy.',
    rules: ['Targets +30%', '−1 reroll', 'Shop +15%'],
    targetMult: 1.30,
    handsDelta: 0,
    rerollsDelta: -1,
    shopPriceMult: 1.15,
  },
  {
    id: 'nova',
    name: 'Nova',
    color: '#cc88ff',
    flavor: 'Every choice is the choice. Every loss is final.',
    rules: ['Targets +45%', '−1 hand', '−1 reroll', 'Shop +25%'],
    targetMult: 1.45,
    handsDelta: -1,
    rerollsDelta: -1,
    shopPriceMult: 1.25,
  },
  {
    id: 'supernova',
    name: 'Supernova',
    color: '#e2334a',
    flavor: 'The trial that ends trials.',
    rules: ['Targets +60%', '−1 hand', '−1 reroll', 'Shop +50%'],
    targetMult: 1.60,
    handsDelta: -1,
    rerollsDelta: -1,
    shopPriceMult: 1.5,
  },
];

const STAKE_BY_ID: Record<string, Stake> = STAKES.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {} as Record<string, Stake>);

export function lookupStake(id: string | null | undefined): Stake {
  if (!id) return STAKES[0]!;
  return STAKE_BY_ID[id] ?? STAKES[0]!;
}

export function stakeIndex(id: string): number {
  const idx = STAKES.findIndex((s) => s.id === id);
  return idx < 0 ? 0 : idx;
}

/** The next stake the player can attempt after beating `id` on a constellation. */
export function nextStakeId(id: string): string | null {
  const idx = stakeIndex(id);
  if (idx + 1 >= STAKES.length) return null;
  return STAKES[idx + 1]!.id;
}
