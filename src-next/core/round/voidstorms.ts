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
import { mulberry32 } from '../rng';

export type VoidstormTone = 'boon' | 'curse';
export type VoidstormRarity = 'common' | 'uncommon' | 'rare';

export type VoidstormDef = {
  id: string;
  name: string;
  flavor: string;
  tone: VoidstormTone;
  // Short HUD line for the Hub preview chip — players see this BEFORE
  // committing to a trial. E.g. "+30 chips per hand", "-1 hand, +2 rerolls".
  // Falls back to the legacy "{tone}" label on older saved storms.
  preview?: string;
  // Spawn weight. The default pickVoidstorm picks a random *index* (uniform)
  // when no rarity is provided; if every entry has rarity, weights apply.
  rarity?: VoidstormRarity;
  // Returns chip/mult deltas for THIS hand (post-upgrades).
  // handIdx = (handsMax - handsLeft) when this is called, so hand 0 is
  // the very first hand of the blind.
  apply: (handIdx: number, handsLeft: number, handsMax: number) => { dChips: number; dMult: number; multMul?: number };
  // Optional non-score effect applied once at START_BLIND. Lets a storm
  // touch handsMax / rerollsLeft / shards without invading the scoring
  // pipeline. Returns deltas (positive or negative). startBlind reads the
  // result before final hand/reroll budgets are computed.
  onBlindStart?: (s: GameState) => { handsDelta?: number; rerollsDelta?: number; shardsDelta?: number };
};

export const VOIDSTORMS: VoidstormDef[] = [
  // ─── Legacy 6 (preserved IDs + new preview/rarity tags) ────────────
  {
    id: 'stellar_wind',
    name: 'Stellar Wind',
    flavor: 'A current at the player\'s back. Every hand pushes harder.',
    tone: 'boon',
    rarity: 'common',
    preview: '+30 chips every hand',
    apply: () => ({ dChips: 30, dMult: 0 }),
  },
  {
    id: 'comet_tail',
    name: 'Comet Tail',
    flavor: 'The first throw burns brightest.',
    tone: 'boon',
    rarity: 'common',
    preview: 'First hand: +5 mult',
    apply: (handIdx) => handIdx === 0 ? { dChips: 0, dMult: 5 } : { dChips: 0, dMult: 0 },
  },
  {
    id: 'twin_suns',
    name: 'Twin Suns',
    flavor: 'The last hand catches both lights.',
    tone: 'boon',
    rarity: 'uncommon',
    preview: 'Last hand: ×1.5 mult',
    apply: (_handIdx, handsLeft) => handsLeft === 1
      ? { dChips: 0, dMult: 0, multMul: 1.5 }
      : { dChips: 0, dMult: 0 },
  },
  {
    id: 'solar_flare',
    name: 'Solar Flare',
    flavor: 'The cosmos spits radiation. Every hand pays a tax.',
    tone: 'curse',
    rarity: 'common',
    preview: '−20 chips every hand',
    apply: () => ({ dChips: -20, dMult: 0 }),
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    flavor: 'The light is wrong. Multipliers run thin.',
    tone: 'curse',
    rarity: 'common',
    preview: '−3 mult every hand',
    apply: () => ({ dChips: 0, dMult: -3 }),
  },
  {
    id: 'cold_spell',
    name: 'Cold Spell',
    flavor: 'The closer freezes. The chamber is colder than it should be.',
    tone: 'curse',
    rarity: 'uncommon',
    preview: 'Last hand: ×0.75 mult',
    apply: (_handIdx, handsLeft) => handsLeft === 1
      ? { dChips: 0, dMult: 0, multMul: 0.75 }
      : { dChips: 0, dMult: 0 },
  },

  // ─── New entries (Pillar A, 2026-05-13) ────────────────────────────
  {
    id: 'nebula_drift',
    name: 'Nebula Drift',
    flavor: 'A breath of cosmic dust. One extra reroll, taken at the start.',
    tone: 'boon',
    rarity: 'rare',
    preview: 'Start with +1 reroll',
    apply: () => ({ dChips: 0, dMult: 0 }),
    onBlindStart: () => ({ rerollsDelta: 1 }),
  },
  {
    id: 'gravity_well',
    name: 'Gravity Well',
    flavor: 'Pressure builds with each throw. The room presses in.',
    tone: 'curse',
    rarity: 'common',
    preview: 'Each hand after the 1st: −15 chips compounded',
    apply: (handIdx) => ({ dChips: handIdx === 0 ? 0 : -15 * handIdx, dMult: 0 }),
  },
  {
    id: 'aurora_band',
    name: 'Aurora Band',
    flavor: 'Light spills sideways. The midrange shines.',
    tone: 'boon',
    rarity: 'uncommon',
    preview: 'Each hand: +25 chips',
    apply: () => ({ dChips: 25, dMult: 0 }),
  },
  {
    id: 'dust_storm',
    name: 'Dust Storm',
    flavor: 'The grit eats a hand whole, but the dice love the chaos.',
    tone: 'curse',
    // 2026-05-13 balance: rarity downshifted to 'rare' after the
    // fibonacci/spark sim cell dropped to 0% win-rate at 'uncommon'.
    // The -1 hand swap is too punishing for the heuristic sim at Spark.
    // Real players will see it less often; the trade-off identity stays.
    rarity: 'rare',
    preview: '−1 hand, +2 rerolls',
    apply: () => ({ dChips: 0, dMult: 0 }),
    onBlindStart: () => ({ handsDelta: -1, rerollsDelta: 2 }),
  },
  {
    id: 'meteor_shower',
    name: 'Meteor Shower',
    flavor: 'The sky brightens just before the closer.',
    tone: 'boon',
    rarity: 'common',
    preview: 'Last hand: +60 chips',
    apply: (_handIdx, handsLeft) => handsLeft === 1
      ? { dChips: 60, dMult: 0 }
      : { dChips: 0, dMult: 0 },
  },
  {
    id: 'void_tide',
    name: 'Void Tide',
    flavor: 'The tide is shallow at first. The deep water waits.',
    tone: 'curse',
    rarity: 'uncommon',
    preview: 'First hand: −30 chips',
    apply: (handIdx) => handIdx === 0
      ? { dChips: -30, dMult: 0 }
      : { dChips: 0, dMult: 0 },
  },
  {
    id: 'pulsar',
    name: 'Pulsar',
    flavor: 'The beat doubles every other hand.',
    tone: 'boon',
    rarity: 'uncommon',
    preview: 'Even-numbered hands: ×1.25 mult',
    apply: (handIdx) => handIdx % 2 === 1
      ? { dChips: 0, dMult: 0, multMul: 1.25 }
      : { dChips: 0, dMult: 0 },
  },
  {
    id: 'cosmic_choir',
    name: 'Cosmic Choir',
    flavor: 'The dice find their voice. A hum that builds with every hand.',
    tone: 'boon',
    rarity: 'common',
    preview: 'Each hand: +1 mult, +5 chips per hand played',
    apply: (handIdx) => ({ dChips: 5 * (handIdx + 1), dMult: 1 }),
  },
  {
    id: 'mirror_sky',
    name: 'Mirror Sky',
    flavor: 'A reflection of the run. Risk on, risk off.',
    tone: 'boon',
    rarity: 'rare',
    preview: 'Start with +1 hand',
    apply: () => ({ dChips: 0, dMult: 0 }),
    onBlindStart: () => ({ handsDelta: 1 }),
  },
  {
    id: 'singularity',
    name: 'Singularity',
    flavor: 'A single point swallows the chamber. Open with a shard tithe.',
    tone: 'curse',
    rarity: 'rare',
    preview: 'Start: −2 shards',
    apply: () => ({ dChips: 0, dMult: 0 }),
    onBlindStart: () => ({ shardsDelta: -2 }),
  },
  {
    id: 'solar_eclipse',
    name: 'Solar Eclipse',
    flavor: 'The first hand stutters. Power returns to the table.',
    tone: 'curse',
    rarity: 'rare',
    // 2026-05-13 balance: ×0.5 was tested at Spark and tanked the
    // fibonacci sim cell. Softened to ×0.7 — still a noticeable opening
    // drag but recoverable, and Fibonacci can pivot to its high-face
    // tier on the remaining hands.
    preview: 'First hand: ×0.7 mult',
    apply: (handIdx) => handIdx === 0
      ? { dChips: 0, dMult: 0, multMul: 0.7 }
      : { dChips: 0, dMult: 0 },
  },
  {
    id: 'starflame',
    name: 'Starflame',
    flavor: 'The cosmos lends fire. Mid-blind, the dice ignite.',
    tone: 'boon',
    rarity: 'common',
    preview: 'Middle hand: +1 mult',
    apply: (handIdx, handsLeft, handsMax) => {
      // Fires on the "middle" hand of a 3-hand blind (handIdx 1), and on
      // the second hand of any 4+ hand blind. Lightweight midbeat boon.
      const middle = Math.floor(handsMax / 2);
      return handIdx === middle && handsLeft > 0
        ? { dChips: 0, dMult: 1 }
        : { dChips: 0, dMult: 0 };
    },
  },
];

// Rarity → weight. Used when `pickVoidstorm` rolls a storm: every entry
// is sampled by `rarity` weight (common = 3, uncommon = 2, rare = 1).
// Legacy entries (no rarity) default to common.
const RARITY_WEIGHT: Record<VoidstormRarity, number> = {
  common: 3,
  uncommon: 2,
  rare: 1,
};

export function lookupVoidstorm(id: string | null): VoidstormDef | undefined {
  if (!id) return undefined;
  return VOIDSTORMS.find((v) => v.id === id);
}

// Picks a voidstorm at blind start. Returns null ~75% of the time —
// most blinds run normally. Boss blinds always return null (the boss
// debuff IS the voidstorm for that blind). Pure function over an RNG
// supplier so it's reproducible from a run seed.
//
// Two-stage roll:
//   1. Gate (rng #1): 25% chance to spawn any storm.
//   2. Tone bias (rng #2): 60% boon, 40% curse. Keeps the expanded pool
//      net-favorable at the spawn level so the larger curse-side variety
//      doesn't punish runs that depend on tight balance.
//   3. Rarity-weighted pick within the chosen tone (rng #3): common = 3,
//      uncommon = 2, rare = 1.
// Legacy entries default to tone='boon'/'curse' as authored and rarity =
// 'common' when absent, preserving the qualitative feel of the original
// 6-storm pool.
// 2026-05-13: bias started at 0.6, lifted to 0.7 after a fibonacci/spark
// regression dip. Keeps the storm system net-positive at the spawn
// level — players see boons more often than curses, which preserves the
// "tilt at my back" feel of the original 6-storm pool while the new
// 12 entries add variety.
const BOON_BIAS = 0.7;

export function pickVoidstorm(rng: () => number, isBoss: boolean): string | null {
  if (isBoss) return null;
  if (rng() >= 0.25) return null;
  const wantBoon = rng() < BOON_BIAS;
  const pool = VOIDSTORMS.filter((v) => v.tone === (wantBoon ? 'boon' : 'curse'));
  if (pool.length === 0) {
    // Sanity fallback — should never happen with the authored pool.
    return VOIDSTORMS[0]?.id ?? null;
  }
  const weights = pool.map((v) => RARITY_WEIGHT[v.rarity ?? 'common']);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return pool[i]!.id;
  }
  return pool[pool.length - 1]?.id ?? null;
}

// Deterministic per-blind voidstorm derivation. Both startBlind() and
// the Hub preview chip call this — passing in the run seed and the
// goalIdx of the trial in question yields the same ID. Boss blinds
// always return null.
export function getVoidstormForBlind(
  seed: number,
  goalIdx: number,
  isBoss: boolean,
): string | null {
  const rng = mulberry32((seed ^ (goalIdx * 0x9e3779b1)) >>> 0);
  return pickVoidstorm(() => rng.next(), isBoss);
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
