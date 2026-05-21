// src-next/voidmode/blindAffixes.ts
// Blind-side affix catalog. Mirrors the catalyst-side AFFIX_DEFS but
// authored to read as TRIAL flavor — "Hollow Trial", "of Echoes",
// "of Long Silence" — and tuned to fire from the SCORING side only.
// Effects mutate the shared AffixContext (chipsBonus/multBonus/
// goldBonus + scratch) exactly like catalyst affixes; the scoring
// pipeline's applyAffixes phase iterates these alongside catalyst
// affixes when state.run.mode === 'void'.
//
// Phase 2B.1 scope: 6 canonical entries, one per family. Phase 2B.2
// extends this with rule-injection affixes (combo bans, discard cost
// changes, hand-size adjustments) — those live elsewhere because
// rules don't fit the scoring-only effect signature.

import type { AffixDef } from './types';

export const BLIND_AFFIX_DEFS: ReadonlyArray<AffixDef> = [
  // ── SCALAR ─────────────────────────────────────────────
  {
    id: 'hollow-trial',
    slot: 'prefix',
    family: 'scalar',
    budgetCost: 2,
    validOn: ['combo', 'scaling', 'timing'],
    weight: 1.0,
    nameTemplate: 'Hollow',
    flavorTags: ['void', 'memory'],
    effect: (ctx) => {
      // Each hand played in the blind earns a flat chip bump — the
      // blind hollows out around you the longer you stay.
      ctx.chipsBonus += 12;
    },
  },

  // ── CONDITIONAL ────────────────────────────────────────
  {
    id: 'of-echoes',
    slot: 'suffix',
    family: 'conditional',
    budgetCost: 3,
    validOn: ['combo', 'scaling', 'timing'],
    weight: 1.0,
    nameTemplate: 'of Echoes',
    flavorTags: ['memory', 'whisper'],
    effect: (ctx) => {
      // Combo tiers echo back as mult. Three-of-a-Kind or better only.
      if (
        ctx.hand.comboId === 'three_kind' ||
        ctx.hand.comboId === 'four_kind' ||
        ctx.hand.comboId === 'five_kind' ||
        ctx.hand.comboId === 'full_house'
      ) {
        ctx.multBonus += 6;
      }
    },
  },

  // ── PERSISTENT ─────────────────────────────────────────
  {
    id: 'of-long-silence',
    slot: 'suffix',
    family: 'persistent',
    budgetCost: 3,
    validOn: ['timing', 'scaling', 'risk'],
    weight: 1.0,
    nameTemplate: 'of Long Silence',
    flavorTags: ['cold', 'memory'],
    effect: (ctx) => {
      // Banks 2 chips per hand played in this blind. Pays out on the
      // final hand (handsRemaining <= 1) when the silence finally breaks.
      ctx.scratch.silenceBank = (ctx.scratch.silenceBank ?? 0) + 2;
      if (ctx.run.handsRemaining <= 1) {
        ctx.chipsBonus += ctx.scratch.silenceBank;
        ctx.scratch.silenceBank = 0;
      }
    },
  },

  // ── DRAWBACK (negative budget — adds back) ─────────────
  {
    id: 'spectral',
    slot: 'prefix',
    family: 'drawback',
    budgetCost: -2,
    validOn: ['combo', 'scaling', 'risk'],
    weight: 1.0,
    nameTemplate: 'Spectral',
    flavorTags: ['void', 'paradox'],
    effect: (ctx) => {
      // +18 chips, but Pairs and Two-Pairs don't qualify — the trial
      // demands a thicker shape than the easy combos.
      if (ctx.hand.comboId === 'one_pair' || ctx.hand.comboId === 'two_pair') return;
      ctx.chipsBonus += 18;
    },
  },

  // ── SYNERGY ────────────────────────────────────────────
  {
    id: 'of-the-confluence',
    slot: 'suffix',
    family: 'synergy',
    budgetCost: 2,
    validOn: ['scaling', 'combo', 'timing'],
    weight: 1.0,
    nameTemplate: 'of the Confluence',
    flavorTags: ['flux', 'memory'],
    effect: (ctx) => {
      // +1 mult per catalyst the player has invested in the run.
      // Blind rewards the builder.
      ctx.multBonus += ctx.run.catalystsOwned;
    },
  },

  // ── REALITY-WARP ───────────────────────────────────────
  {
    id: 'of-the-inverted-trial',
    slot: 'suffix',
    family: 'reality-warp',
    budgetCost: 5,
    validOn: ['risk', 'combo', 'timing'],
    weight: 0.4,
    nameTemplate: 'of the Inverted Trial',
    flavorTags: ['paradox', 'void'],
    effect: (ctx) => {
      // On the boss blind, the trial bends — chips bank as mult. Pays
      // out big on the climax, no-ops on the early-trial blinds.
      if (ctx.trial.isBossBlind) {
        ctx.multBonus += 15;
      }
    },
  },
];

export const BLIND_AFFIX_BY_ID: ReadonlyMap<string, AffixDef> = new Map(
  BLIND_AFFIX_DEFS.map((a) => [a.id, a]),
);
