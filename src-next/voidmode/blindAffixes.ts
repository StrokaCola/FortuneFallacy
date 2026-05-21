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
// adds 4 rule-bearing affixes (banCombo / discardCostMultiplier) on
// top — those carry an additional `rule` field that the START_BLIND
// resolver extracts into run.activeBlindRules for the scoring pipeline
// and the reroll handler to consult as gameplay-time gates.

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

  // ── PHASE 2B.2 RULE-BEARING DRAWBACKS ──────────────────
  // These carry a `rule` descriptor that mutates gameplay during the
  // blind in ways the scoring-only AffixContext can't express:
  // banned combos and scaled discard costs. Each one is in the
  // 'drawback' family with NEGATIVE budgetCost so they expand the
  // generator's budget to fit alongside an upside affix on the same
  // blind. The affix `effect` still runs alongside the rule — a
  // banCombo affix can also grant compensation chips/mult on the
  // un-banned combos so the player isn't outright punished.
  //
  // NOTE: the existing 'spectral' (drawback family) blocks any other
  // drawback from rolling on the same item (see affixGenerator's
  // affixFits guard). That's intentional — a blind never carries more
  // than one drawback at a time, keeping the rule-rolling cadence
  // predictable.

  // Rule: bans One Pair from scoring during this blind. Compensation —
  // +4 mult on every non-pair combo so pair-leaning builds are pushed
  // toward thicker shapes rather than left scoreless.
  {
    id: 'hollow-blind',
    slot: 'prefix',
    family: 'drawback',
    budgetCost: -3,
    validOn: ['combo', 'risk'],
    weight: 0.8,
    nameTemplate: 'Hollow',
    flavorTags: ['void', 'memory'],
    effect: (ctx) => {
      // Compensation for the ban — base mult bump on non-banned combos.
      if (ctx.hand.comboId !== 'one_pair') ctx.multBonus += 4;
    },
    rule: { kind: 'banCombo', comboId: 'one_pair' },
  },

  // Rule: bans Two Pair. Pure drawback — no compensation chip/mult on
  // this one; the affix-name signals "your easy two-pair plays are
  // worthless this trial" plainly without softening.
  {
    id: 'of-the-broken-symmetry',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -3,
    validOn: ['combo', 'risk'],
    weight: 0.6,
    nameTemplate: 'of the Broken Symmetry',
    flavorTags: ['paradox', 'memory'],
    effect: () => {},
    rule: { kind: 'banCombo', comboId: 'two_pair' },
  },

  // Rule: 2× discard cost. Each reroll consumes 2 from the per-hand
  // budget instead of 1, so a default 2-reroll hand has a single
  // reroll available. Moderate constraint — still usable, just
  // expensive.
  {
    id: 'of-curfew-rule',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -2,
    validOn: ['risk', 'timing'],
    weight: 1.0,
    nameTemplate: 'of Curfew',
    flavorTags: ['cold', 'memory'],
    effect: () => {},
    rule: { kind: 'discardCostMultiplier', multiplier: 2 },
  },

  // Rule: 3× discard cost — rarer (weight 0.5), harsher. On a default
  // 2-reroll hand the player cannot reroll at all and must commit to
  // their first roll. Tuned as a high-stakes shape that occasionally
  // makes the player feel the trial's pressure.
  {
    id: 'of-the-frozen-river',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -3,
    validOn: ['risk', 'timing'],
    weight: 0.5,
    nameTemplate: 'of the Frozen River',
    flavorTags: ['cold', 'paradox'],
    effect: () => {},
    rule: { kind: 'discardCostMultiplier', multiplier: 3 },
  },
];

export const BLIND_AFFIX_BY_ID: ReadonlyMap<string, AffixDef> = new Map(
  BLIND_AFFIX_DEFS.map((a) => [a.id, a]),
);
