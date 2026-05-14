// Hub Event Nodes (Pillar C) — choice-driven encounters that occasionally
// replace a non-boss trial slot. The player picks one of 2-3 options,
// effects dispatch through existing handlers, then the slot advances as
// if cleared (without scoring).
//
// Generation rule: a non-boss slot on antes 2 or 3 has ~25% chance of
// rolling an event. Ante 1 stays clean (onboarding) and ante 4 stays
// clean (the Final Trial chain is the climax). Boss slots never roll
// events.
//
// Effect application is intentionally narrow: each choice produces a
// `EventEffect[]` that the RESOLVE_EVENT_CHOICE handler walks, applying
// each effect to the run/meta. Effects that touch caps (consumable cap,
// catalyst cap) silently convert to shards on overflow.

import { mulberry32 } from '../core/rng';

export type EventEffect =
  | { kind: 'shards'; amount: number }
  | { kind: 'cosmic_dust'; amount: number }
  | { kind: 'consumable'; consumableId: string }
  | { kind: 'random_consumable'; from?: ('regular' | 'galaxy' | 'spectral' | 'maneuver')[] }
  | { kind: 'random_catalyst'; rarity?: ('common' | 'uncommon' | 'rare')[] }
  | { kind: 'random_mod'; rarity?: ('common' | 'uncommon' | 'rare' | 'legendary')[] }
  | { kind: 'lose_random_catalyst' }
  | { kind: 'lose_random_mod' }
  | { kind: 'hands_next_blind'; delta: number }
  | { kind: 'rerolls_next_blind'; delta: number };

export type EventChoice = {
  // Short button label (e.g. "Take 8 shards").
  label: string;
  // Optional one-line flavor (italic subline).
  flavor?: string;
  // Cost preconditions — choice is only selectable when ALL costs are
  // affordable. Costs are deducted on resolve before effects apply.
  costs?: { shards?: number };
  // Effects applied in order on resolve. Empty array = "do nothing"
  // (e.g. a "Refuse" exit option).
  effects: EventEffect[];
};

export type EventDef = {
  id: string;
  name: string;
  glyph: string;
  // Prompt rendered as the encounter's body text — sets the scene.
  prompt: string;
  choices: EventChoice[];
  // Spawn weight inside the event pool. Higher = more frequent. Default 1.
  weight?: number;
};

export const EVENTS: EventDef[] = [
  {
    id: 'wandering_oracle',
    name: 'The Wandering Oracle',
    glyph: '◉',
    prompt:
      'A figure in star-flecked rags blocks the path. She offers to read your fate.',
    choices: [
      {
        label: 'Pay 5 shards · gain a tarot',
        flavor: 'Her eyes are very old. She does not waste your time.',
        costs: { shards: 5 },
        effects: [{ kind: 'consumable', consumableId: 'shard_drop' }, { kind: 'cosmic_dust', amount: 4 }],
      },
      {
        label: 'Walk past',
        effects: [],
      },
    ],
  },
  {
    id: 'derelict_shrine',
    name: 'The Derelict Shrine',
    glyph: '⛨',
    prompt:
      'A small shrine, half-buried in dust. You feel the weight of something forgotten.',
    choices: [
      {
        label: 'Light the offering',
        flavor: 'A rare mark answers your prayer.',
        effects: [{ kind: 'random_mod', rarity: ['rare'] }],
      },
      {
        label: 'Leave it sleeping',
        flavor: 'Some doors are best left closed.',
        effects: [],
      },
    ],
  },
  {
    id: 'coin_pilgrim',
    name: 'The Coin Pilgrim',
    glyph: '◆',
    prompt:
      "A traveler offers a gambler's pact: three shards down, eight in return — if the dice agree.",
    choices: [
      {
        label: "Take the bet · 3 → 8 shards",
        costs: { shards: 3 },
        effects: [{ kind: 'shards', amount: 8 }],
      },
      {
        label: 'Refuse',
        effects: [],
      },
    ],
  },
  {
    id: 'void_merchant',
    name: 'The Void Merchant',
    glyph: '⌗',
    prompt:
      'A black-shrouded merchant lays a tarp on the path. A single catalyst rests on it, glowing softly.',
    choices: [
      {
        label: 'Pay 6 shards · take it',
        flavor: 'Worth at least double on a good day.',
        costs: { shards: 6 },
        effects: [{ kind: 'random_catalyst', rarity: ['uncommon'] }],
      },
      {
        label: 'Walk past',
        effects: [],
      },
    ],
  },
  {
    id: 'mirror_pool',
    name: 'The Mirror Pool',
    glyph: '◯',
    prompt:
      'A still pool reflects more than it should. The surface shows you holding a catalyst that vanishes when you blink.',
    choices: [
      {
        label: 'Reach in · gain a catalyst',
        flavor: 'The mirror gives. Sometimes.',
        effects: [{ kind: 'random_catalyst', rarity: ['common'] }],
      },
      {
        label: 'Pour shards in · gain a stronger one',
        flavor: 'The mirror takes what it can.',
        costs: { shards: 8 },
        effects: [{ kind: 'random_catalyst', rarity: ['rare'] }],
      },
      {
        label: 'Walk past',
        effects: [],
      },
    ],
  },
  {
    id: 'comet_traveler',
    name: 'The Comet Traveler',
    glyph: '☄',
    prompt:
      "A figure rides a long streak of starlight past your path. They throw down a bundle as they pass.",
    choices: [
      {
        label: 'Catch the bundle',
        flavor: 'A galaxy pack opens in your next bazaar.',
        effects: [
          { kind: 'random_consumable', from: ['galaxy'] },
          { kind: 'hands_next_blind', delta: -1 },
        ],
      },
      {
        label: 'Let it pass',
        effects: [],
      },
    ],
  },
  {
    id: 'astrologers_debt',
    name: "The Astrologer's Debt",
    glyph: '✦',
    prompt:
      'A robed scholar tugs at your sleeve. She owes a debt to the stars and needs help paying it.',
    choices: [
      {
        label: 'Lend 10 shards',
        flavor: 'She promises 15 back. The stars are listening.',
        costs: { shards: 10 },
        effects: [{ kind: 'shards', amount: 15 }, { kind: 'cosmic_dust', amount: 6 }],
      },
      {
        label: 'Refuse',
        effects: [],
      },
    ],
  },
  {
    id: 'lost_die',
    name: 'The Lost Die',
    glyph: '⬢',
    prompt:
      'A single die rests in the road, six pips facing up. It hums when you pick it up.',
    choices: [
      {
        label: 'Pocket it',
        flavor: 'The next blind starts with an extra reroll.',
        effects: [{ kind: 'rerolls_next_blind', delta: 1 }],
      },
      {
        label: 'Sell it · 4 shards',
        flavor: 'Easier to spend than to carry.',
        effects: [{ kind: 'shards', amount: 4 }],
      },
      {
        label: 'Leave it',
        effects: [],
      },
    ],
  },
];

export function lookupEvent(id: string | null | undefined): EventDef | undefined {
  if (!id) return undefined;
  return EVENTS.find((e) => e.id === id);
}

// Deterministic per-blind event derivation. Mirrors getVoidstormForBlind's
// shape so the Hub preview chip and the in-blind event match exactly.
//
// Generation rule:
//   - boss blinds: never an event (null)
//   - ante 1, ante 4: never an event (null) — onboarding + climax
//   - antes 2, 3 non-boss: ~1-in-6 chance to roll an event
//
// 2026-05-14: dropped from 25% to 1/6. Old rate produced ~26% of runs
// with two or more encounters which over-saturated the experience;
// 1-in-6 keeps an encounter as a noteworthy detour rather than a
// regular feature of every other run.
//
// Pure function over (seed, goalIdx, ante, isBoss).
const EVENT_CHANCE_PER_SLOT = 1 / 6;

export function getEventForBlind(
  seed: number,
  goalIdx: number,
  ante: number,
  isBoss: boolean,
): string | null {
  if (isBoss) return null;
  if (ante !== 2 && ante !== 3) return null;
  // Distinct rng namespace from voidstorms (different XOR constant) so
  // the two systems don't correlate.
  const rng = mulberry32((seed ^ (goalIdx * 0x85ebca6b)) >>> 0);
  if (rng.next() >= EVENT_CHANCE_PER_SLOT) return null;
  // Weighted pick within the event pool.
  const total = EVENTS.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  let roll = rng.next() * total;
  for (const e of EVENTS) {
    roll -= e.weight ?? 1;
    if (roll < 0) return e.id;
  }
  return EVENTS[EVENTS.length - 1]?.id ?? null;
}
