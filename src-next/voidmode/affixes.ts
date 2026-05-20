// src-next/voidmode/affixes.ts
// MVP affix definitions — one canonical example per family. Phase 2
// content sweep expands this to ~60 by the same pattern.

import type { AffixDef } from './types';

export const AFFIX_DEFS: ReadonlyArray<AffixDef> = [
  // ── SCALAR ─────────────────────────────────────────────
  {
    id: 'cracked',
    slot: 'prefix',
    family: 'scalar',
    budgetCost: 2,
    validOn: ['combo', 'face', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Cracked',
    flavorTags: ['decay'],
    effect: (ctx) => {
      if (ctx.hand.comboId === 'pair' || ctx.hand.comboId === 'two_pair') {
        ctx.chipsBonus += 15;
      }
    },
  },

  // ── CONDITIONAL ────────────────────────────────────────
  {
    id: 'of-sundering',
    slot: 'suffix',
    family: 'conditional',
    budgetCost: 3,
    validOn: ['combo', 'scaling', 'timing'],
    weight: 1.0,
    nameTemplate: 'of Sundering',
    flavorTags: ['void', 'decay'],
    effect: (ctx) => {
      if (ctx.hand.isWild.some(Boolean)) {
        ctx.multBonus += 5;
      }
    },
  },

  // ── PERSISTENT ─────────────────────────────────────────
  {
    id: 'echoing',
    slot: 'prefix',
    family: 'persistent',
    budgetCost: 3,
    validOn: ['combo', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Echoing',
    flavorTags: ['memory'],
    effect: (ctx) => {
      // Bank 1 chip per face-read; pay out on full house.
      ctx.scratch.echoBank = (ctx.scratch.echoBank ?? 0) + ctx.hand.diceValues.length;
      if (ctx.hand.comboId === 'full_house') {
        ctx.chipsBonus += ctx.scratch.echoBank;
        ctx.scratch.echoBank = 0;
      }
    },
  },

  // ── DRAWBACK (negative budget — adds back) ────────────
  {
    id: 'of-the-long-fall',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -2,
    validOn: ['combo', 'scaling', 'risk'],
    blockedOn: ['economy'],
    weight: 1.0,
    nameTemplate: 'of the Long Fall',
    flavorTags: ['void', 'paradox'],
    effect: (ctx) => {
      // +12 mult, but disables on Straight.
      if (ctx.hand.comboId === 'straight' || ctx.hand.comboId === 'straight_flush') return;
      ctx.multBonus += 12;
    },
  },

  // ── SYNERGY ────────────────────────────────────────────
  {
    id: 'whispering',
    slot: 'prefix',
    family: 'synergy',
    budgetCost: 2,
    validOn: ['combo', 'scaling', 'utility'],
    weight: 1.0,
    nameTemplate: 'Whispering',
    flavorTags: ['whisper', 'memory'],
    effect: (ctx) => {
      // +1 mult per catalyst owned.
      ctx.multBonus += ctx.run.catalystsOwned;
    },
  },

  // ── REALITY-WARP (rare, expensive) ────────────────────
  {
    id: 'of-the-ninth-door',
    slot: 'suffix',
    family: 'reality-warp',
    budgetCost: 5,
    validOn: ['combo'],
    weight: 0.4,
    nameTemplate: 'of the Ninth Door',
    flavorTags: ['void', 'paradox'],
    effect: (ctx) => {
      // Treat Pair as Three of a Kind for scoring (chips bump).
      if (ctx.hand.comboId === 'pair') {
        ctx.chipsBonus += 30;  // delta between Pair and Three of a Kind base chips
        ctx.multBonus += 1;
      }
    },
  },
];

export const AFFIX_BY_ID: ReadonlyMap<string, AffixDef> = new Map(
  AFFIX_DEFS.map(a => [a.id, a]),
);
