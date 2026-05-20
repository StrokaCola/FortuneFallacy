// Curated constraint runs. Each Challenge picks a constellation + stake and
// layers an `overlay` of difficulty modifiers on top. Overlay fields stack
// over the stake's modifiers; see core/run/stakeContext.ts for composition.

export type ChallengeOverlay = {
  /** Multiplied with stake target multiplier. 1 = no change. */
  targetMult?: number;
  /** Added to base hands. Negative = harder. */
  handsDelta?: number;
  /** Added to per-hand rerolls. */
  rerollsDelta?: number;
  /** Multiplied with stake shop multiplier. */
  shopPriceMult?: number;
  /** When true, BUY_OFFER and OPEN_SHOP are no-ops (Hub skips straight to next blind). */
  shopDisabled?: boolean;
  /** When true, FORGE access is hidden in the Hub. */
  forgeDisabled?: boolean;
  /** When true, USE_CONSUMABLE is rejected for the whole run. */
  consumablesLocked?: boolean;
  /** Hard cap on simultaneous catalyst slots regardless of vouchers. 0 = no cap. */
  catalystCap?: number;
};

export type Challenge = {
  id: string;
  name: string;
  flavor: string;
  /** Forces a starting constellation. */
  constellationId: string;
  /** Stake to start at. Defaults to spark. */
  stakeId?: string;
  /** Difficulty/effect summary bullets shown on the picker. */
  rules: string[];
  overlay: ChallengeOverlay;
};

// Initial seed list — five challenges covering different deprivation axes.
// SP4 keeps this list expandable; data-only additions don't require code changes.
export const CHALLENGES: Challenge[] = [
  {
    id: 'silent_market',
    name: 'Silent Market',
    flavor: 'No Night Market. Make do with what you have.',
    constellationId: 'lyra',
    rules: ['Shop locked', 'Targets +10%'],
    overlay: { shopDisabled: true, targetMult: 1.1 },
  },
  {
    id: 'cold_forge',
    name: 'Cold Forge',
    flavor: 'The hammers fall silent. No mod transfers.',
    constellationId: 'lyra',
    rules: ['Forge locked', '−1 reroll', 'Targets +10%'],
    overlay: { forgeDisabled: true, rerollsDelta: -1, targetMult: 1.1 },
  },
  {
    id: 'one_breath',
    name: 'One Breath',
    flavor: 'A single shot at every trial. Two hands. No rerolls.',
    constellationId: 'lyra',
    rules: ['−1 hand', '−2 rerolls', 'Targets +5%'],
    overlay: { handsDelta: -1, rerollsDelta: -2, targetMult: 1.05 },
  },
  {
    id: 'austere_palette',
    name: 'Austere Palette',
    flavor: 'Three catalysts, no more. Curate.',
    constellationId: 'lyra',
    rules: ['Catalyst slots capped at 3'],
    overlay: { catalystCap: 3 },
  },
  {
    id: 'siege',
    name: 'The Siege',
    flavor: 'Resources sealed. Bring only your skill.',
    constellationId: 'lyra',
    rules: ['Consumables locked', 'Targets +20%'],
    overlay: { consumablesLocked: true, targetMult: 1.2 },
  },
];

const BY_ID: Record<string, Challenge> = CHALLENGES.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {} as Record<string, Challenge>);

export function lookupChallenge(id: string | null | undefined): Challenge | null {
  if (!id) return null;
  return BY_ID[id] ?? null;
}
