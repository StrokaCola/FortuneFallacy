// Astral Perks — meta-progression upgrades purchased with Cosmic Dust at the
// Astral Forge between runs. Each perk is a one-time, permanent unlock that
// applies a passive effect to every future run.
//
// Costs are intentionally conservative for the first ship. Empirical tuning
// data lives in docs/sim-data/dust_earn.csv (see tools/sim/dustEarn.ts) and
// in docs/analysis.md §10. Adjust costs in this file alone — perk effects
// resolve through `core/run/applyAstralPerks.ts` so the catalog stays the
// single source of truth.

export type AstralPerkEffect =
  // +N starting shards on every NEW_RUN
  | { kind: 'starting_shards'; amount: number }
  // Reduce base shop reroll cost by N (floor at 0)
  | { kind: 'reroll_discount'; amount: number }
  // +N starting catalyst slot capacity (stacks with Bench voucher)
  | { kind: 'starting_catalyst_slot'; amount: number }
  // +N hands on the FIRST blind only (lesser_trial of ante 1)
  | { kind: 'first_blind_extra_hands'; amount: number }
  // Show the next ante's boss debuff label in Hub before commit
  | { kind: 'reveal_next_boss' }
  // Grant a free random consumable on every NEW_RUN
  | { kind: 'starting_consumable' };

export type AstralPerkDef = {
  id: string;
  name: string;
  description: string;
  flavor: string;
  cost: number;
  effect: AstralPerkEffect;
};

export const ASTRAL_PERKS: AstralPerkDef[] = [
  {
    id: 'morning_star',
    name: 'Morning Star',
    description: 'Begin every run with +2 shards.',
    flavor: 'Light kindled before the first roll.',
    cost: 25,
    effect: { kind: 'starting_shards', amount: 2 },
  },
  {
    id: 'patient_eye',
    name: 'Patient Eye',
    description: 'Shop reroll cost reduced by 1.',
    flavor: 'A second look costs less when you know what you are looking for.',
    cost: 60,
    effect: { kind: 'reroll_discount', amount: 1 },
  },
  {
    id: 'first_breath',
    name: 'First Breath',
    description: '+1 hand on the very first blind of every run.',
    flavor: 'The opening note rings a beat longer.',
    cost: 90,
    effect: { kind: 'first_blind_extra_hands', amount: 1 },
  },
  {
    id: 'astrolabe',
    name: 'Astrolabe',
    description: 'Reveal the next ante’s boss debuff before you start the round.',
    flavor: 'A glance at the chart. The shape of fear, named.',
    cost: 120,
    effect: { kind: 'reveal_next_boss' },
  },
  {
    id: 'reliquary',
    name: 'Reliquary',
    description: 'Begin every run with one random consumable in the tray.',
    flavor: 'Something you forgot you were keeping.',
    cost: 175,
    effect: { kind: 'starting_consumable' },
  },
  {
    id: 'wider_orbit',
    name: 'Wider Orbit',
    description: '+1 starting catalyst slot capacity.',
    flavor: 'Room enough for one more truth.',
    cost: 250,
    effect: { kind: 'starting_catalyst_slot', amount: 1 },
  },
];

export function lookupAstralPerk(id: string): AstralPerkDef | undefined {
  return ASTRAL_PERKS.find((p) => p.id === id);
}
