// Voidstorms — per-blind modifier flair. Roughly 1 in 4 non-boss blinds
// rolls a "voidstorm" event that tilts the math one direction. Mix of
// boons and curses so the player sees both faces of the variance.
// Boss blinds skip — they have their own debuffs and stacking would
// muddle the read.
//
// Apply: a final tail step in the upgrades phase reads the active
// voidstorm and adds chip / mult deltas. Pure score-side effects so
// no need to plumb through hand/reroll budgets — keeping the change
// surface tiny.

import type { GameState } from '../../state/store';
import type { PhaseFn } from '../pipeline/types';
import { Phase } from '../pipeline/types';

export type VoidstormTone = 'boon' | 'curse';

export type VoidstormDef = {
  id: string;
  name: string;
  flavor: string;
  tone: VoidstormTone;
  // Returns chip/mult deltas for THIS hand (post-upgrades).
  // handIdx = (handsMax - handsLeft) when this is called, so hand 0 is
  // the very first hand of the blind.
  apply: (handIdx: number, handsLeft: number, handsMax: number) => { dChips: number; dMult: number; multMul?: number };
};

export const VOIDSTORMS: VoidstormDef[] = [
  {
    id: 'stellar_wind',
    name: 'Stellar Wind',
    flavor: 'A current at the player\'s back. Every hand pushes harder.',
    tone: 'boon',
    apply: () => ({ dChips: 30, dMult: 0 }),
  },
  {
    id: 'comet_tail',
    name: 'Comet Tail',
    flavor: 'The first throw burns brightest.',
    tone: 'boon',
    apply: (handIdx) => handIdx === 0 ? { dChips: 0, dMult: 5 } : { dChips: 0, dMult: 0 },
  },
  {
    id: 'twin_suns',
    name: 'Twin Suns',
    flavor: 'The third hand catches both lights.',
    tone: 'boon',
    apply: (_handIdx, handsLeft) => handsLeft === 1
      ? { dChips: 0, dMult: 0, multMul: 1.5 }
      : { dChips: 0, dMult: 0 },
  },
  {
    id: 'solar_flare',
    name: 'Solar Flare',
    flavor: 'The cosmos spits radiation. Every hand pays a tax.',
    tone: 'curse',
    apply: () => ({ dChips: -20, dMult: 0 }),
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    flavor: 'The light is wrong. Multipliers run thin.',
    tone: 'curse',
    apply: () => ({ dChips: 0, dMult: -3 }),
  },
  {
    id: 'cold_spell',
    name: 'Cold Spell',
    flavor: 'The closer freezes. The chamber is colder than it should be.',
    tone: 'curse',
    apply: (_handIdx, handsLeft) => handsLeft === 1
      ? { dChips: 0, dMult: 0, multMul: 0.75 }
      : { dChips: 0, dMult: 0 },
  },
];

export function lookupVoidstorm(id: string | null): VoidstormDef | undefined {
  if (!id) return undefined;
  return VOIDSTORMS.find((v) => v.id === id);
}

// Picks a voidstorm at blind start. Returns null ~75% of the time —
// most blinds run normally. Boss blinds always return null (the boss
// debuff IS the voidstorm for that blind). Pure function over an RNG
// supplier so it's reproducible from a run seed.
export function pickVoidstorm(rng: () => number, isBoss: boolean): string | null {
  if (isBoss) return null;
  if (rng() >= 0.25) return null;
  const idx = Math.floor(rng() * VOIDSTORMS.length);
  return VOIDSTORMS[idx]?.id ?? null;
}

// Apply phase — runs after upgrades + resonance. No-op if no voidstorm
// is active on this blind. Multiplicative effect (multMul) applies AFTER
// the additive deltas to match the existing crown-mod ordering.
export const applyVoidstorm: PhaseFn = (ctx) => {
  const id = ctx.state.round.voidstormId;
  const def = lookupVoidstorm(id ?? null);
  if (!def) return ctx;

  const handsMax = ctx.state.round.handsMax ?? 3;
  // The pipeline runs DURING SCORE_HAND, before handsLeft has been
  // decremented. So the "current hand index" is (handsMax - handsLeft).
  const handsLeft = ctx.state.round.handsLeft;
  const handIdx = handsMax - handsLeft;
  const { dChips, dMult, multMul } = def.apply(handIdx, handsLeft, handsMax);

  if (dChips === 0 && dMult === 0 && (multMul ?? 1) === 1) return ctx;

  let chips = ctx.chips + dChips;
  if (chips < 0) chips = 0;
  let mult = ctx.mult + dMult;
  if (multMul && multMul !== 1) mult *= multMul;

  return {
    ...ctx,
    chips,
    mult,
    events: [
      ...ctx.events,
      {
        type: 'onUpgradeTriggered',
        payload: {
          id: `voidstorm:${def.id}`,
          phase: Phase.UPGRADES,
          deltaChips: dChips,
          deltaMult: dMult + (multMul && multMul !== 1 ? mult - (mult / multMul) : 0),
        },
      },
    ],
  };
};
