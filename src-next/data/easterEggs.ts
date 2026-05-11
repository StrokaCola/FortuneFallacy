// 2026-05-11 easter eggs — five hand-authored discoverables.
//
// DESIGN PRINCIPLE: hints should NUDGE without giving the answer. A
// thoughtful player should read the hint twice and go "wait... is that…?".
// Once discovered (meta.easterEggs includes the id), the entry flips to
// the full description so the player can confirm what they did. The hint
// is intentionally elliptical — referencing the theme without naming the
// condition.
//
// Detection sites:
//   answer       → actions/handlers/roll.ts SCORE_HAND (handTotal === 42)
//   pi           → actions/handlers/roll.ts ROLL_SETTLED (first 3 dice 3,1,4 on first roll)
//   lucky_seven  → actions/handlers/roll.ts SCORE_HAND (3+ scoring 7s)
//   eris_apple   → actions/handlers/roll.ts SCORE_HAND (Eris boss + all-prime hand)
//   mirrored_hand → core/round/transitions.ts startBlind (2+ palindromic catalyst names)
//
// All sites emit an event:
//   { type: 'onUpgradeTriggered', payload: { id: 'easter_egg:<id>', ... } }
// A listener in app/events/listeners.ts (or wherever the bus is wired)
// reads this and writes to meta.easterEggs.

export type EasterEggMeta = {
  id: string;
  name: string;
  // Pre-discovery hint shown in the codex. Should be readable as a flavor
  // line on its own — players don't know it's a clue until they puzzle it.
  hint: string;
  // Post-discovery full description.
  revealedDesc: string;
  // Optional category icon (rendered next to the name in the codex).
  icon: string;
};

export const EASTER_EGGS: EasterEggMeta[] = [
  {
    id: 'answer',
    name: 'The Answer',
    icon: '☂',
    hint: 'Some hands close on a famous number. Be precise about it.',
    revealedDesc: 'Score exactly 42 in a single hand: +1 reroll for the rest of the run.',
  },
  {
    id: 'pi',
    name: 'Pi Approximation',
    icon: 'π',
    hint: 'The first three dice of a brand-new run sometimes spell a constant.',
    revealedDesc: 'On the very first roll of a run, dice settle 3-1-4 (in order). A free consumable lands in your shop.',
  },
  {
    id: 'lucky_seven',
    name: 'Lucky Seven',
    icon: '7',
    hint: 'Three sevens still mean something at a slot machine.',
    revealedDesc: 'Score three or more 7s in one hand (d8+/d10/d12 dice required): +50 shards.',
  },
  {
    id: 'eris_apple',
    name: 'Eris Apple',
    icon: '🍎',
    hint: 'When the unmaker bites first, only the indivisible can answer.',
    revealedDesc: 'In Eris\'s boss blind, score a hand of all primes (2/3/5/7): her debuff inverts to a buff.',
  },
  {
    id: 'mirrored_hand',
    name: 'Mirrored Hand',
    icon: '⟁',
    hint: 'Two names that read the same forward and back tie a knot at the start of every blind.',
    revealedDesc: 'Hold two catalysts with palindromic names. The first hand of every blind retriggers once.',
  },
];

export function lookupEasterEgg(id: string): EasterEggMeta | undefined {
  return EASTER_EGGS.find((e) => e.id === id);
}
