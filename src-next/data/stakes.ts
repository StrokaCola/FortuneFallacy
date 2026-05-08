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
  {
    id: 'beacon',
    name: 'Beacon',
    color: '#7be3ff',
    flavor: 'Fewer hands; the bazaar grows greedy.',
    rules: ['Targets +35%', '−1 hand per round', 'Shop +25%'],
    targetMult: 1.35,
    handsDelta: -1,
    rerollsDelta: 0,
    shopPriceMult: 1.25,
  },
  {
    id: 'nova',
    name: 'Nova',
    color: '#cc88ff',
    flavor: 'Every choice is the choice. Every loss is final.',
    rules: ['Targets +50%', '−1 hand', '−1 reroll', 'Shop +25%'],
    targetMult: 1.5,
    handsDelta: -1,
    rerollsDelta: -1,
    shopPriceMult: 1.25,
  },
  {
    id: 'supernova',
    name: 'Supernova',
    color: '#e2334a',
    flavor: 'The trial that ends trials.',
    rules: ['Targets +75%', '−1 hand', '−1 reroll', 'Shop +50%'],
    targetMult: 1.75,
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
