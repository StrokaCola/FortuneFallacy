// src-next/voidmode/affixes.ts
// Affix catalog. Phase 2 content sweep brings the pool from the original
// 6 MVP entries up to 60 across all 6 families, with explicit coverage
// for the economy/mods/collision archetypes that the MVP pool didn't
// reach. Effect functions are pure: they only mutate the affix-context
// bonus accumulators and the per-trial scratch map.
//
// Combo-id reference (from src-next/core/scoring/combos.ts):
//   five_kind, four_kind, lg_straight, full_house, sm_straight,
//   three_kind, two_pair, one_pair, chance
// The original 6 MVP affixes use legacy combo strings ('pair',
// 'straight', etc.) which never match — that mismatch is preserved here
// to keep the MVP entries byte-identical, but all 54 new entries below
// use the canonical ids so they actually fire in-game.

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
    description: '+15 chips on One Pair or Two Pair',
    flavorTags: ['decay'],
    effect: (ctx) => {
      if (ctx.hand.comboId === 'one_pair' || ctx.hand.comboId === 'two_pair') {
        ctx.chipsBonus += 15;
      }
    },
  },
  {
    id: 'sundered',
    slot: 'prefix',
    family: 'scalar',
    budgetCost: 2,
    validOn: ['combo', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Sundered',
    description: '+20 chips on Three/Four/Five of a Kind',
    flavorTags: ['decay', 'void'],
    effect: (ctx) => {
      if (ctx.hand.comboId === 'three_kind' || ctx.hand.comboId === 'four_kind' || ctx.hand.comboId === 'five_kind') {
        ctx.chipsBonus += 20;
      }
    },
  },
  {
    id: 'eternal',
    slot: 'prefix',
    family: 'scalar',
    budgetCost: 2,
    validOn: ['scaling', 'timing'],
    weight: 1.0,
    nameTemplate: 'Eternal',
    description: '+1 mult per hand played this trial',
    flavorTags: ['memory'],
    effect: (ctx) => {
      // +1 mult per hand played this trial (scratch bumps each fire).
      ctx.scratch.eternalCount = (ctx.scratch.eternalCount ?? 0) + 1;
      ctx.multBonus += ctx.scratch.eternalCount;
    },
  },
  {
    id: 'hollow',
    slot: 'prefix',
    family: 'scalar',
    budgetCost: 1,
    validOn: ['face', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Hollow',
    description: '+10 chips when hand contains a 1',
    flavorTags: ['void'],
    effect: (ctx) => {
      if (ctx.hand.diceValues.includes(1)) {
        ctx.chipsBonus += 10;
      }
    },
  },
  {
    id: 'twilit',
    slot: 'prefix',
    family: 'scalar',
    budgetCost: 3,
    validOn: ['combo', 'scaling'],
    weight: 0.8,
    nameTemplate: 'Twilit',
    description: '+6 mult on Small or Large Straight',
    flavorTags: ['cold', 'paradox'],
    effect: (ctx) => {
      if (ctx.hand.comboId === 'sm_straight' || ctx.hand.comboId === 'lg_straight') {
        ctx.multBonus += 6;
      }
    },
  },
  {
    id: 'burning',
    slot: 'prefix',
    family: 'scalar',
    budgetCost: 2,
    validOn: ['utility', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Burning',
    description: '+1 mult per discard remaining',
    flavorTags: ['heat'],
    effect: (ctx) => {
      ctx.multBonus += ctx.run.discardsRemaining;
    },
  },
  {
    id: 'hungering',
    slot: 'prefix',
    family: 'scalar',
    budgetCost: 2,
    validOn: ['economy', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Hungering',
    description: '+2 chips per gold above 10',
    flavorTags: ['decay'],
    effect: (ctx) => {
      const over = Math.max(0, ctx.run.goldHeld - 10);
      ctx.chipsBonus += over * 2;
    },
  },
  {
    id: 'frayed',
    slot: 'prefix',
    family: 'scalar',
    budgetCost: 3,
    validOn: ['scaling', 'mods'],
    weight: 0.8,
    nameTemplate: 'Frayed',
    description: '+1 mult per catalyst owned (rounded)',
    flavorTags: ['decay', 'flux'],
    effect: (ctx) => {
      // +1 mult per catalyst owned. Synergy-adjacent scalar.
      ctx.multBonus += Math.floor(ctx.run.catalystsOwned * 0.75);
    },
  },
  {
    id: 'of-echoes',
    slot: 'suffix',
    family: 'scalar',
    budgetCost: 2,
    validOn: ['combo', 'scaling'],
    weight: 1.0,
    nameTemplate: 'of Echoes',
    description: '+4 chips per combo tier',
    flavorTags: ['memory', 'void'],
    effect: (ctx) => {
      // +X chips by combo tier (chance=0 ... five_kind=8 in COMBOS table).
      const tierByCombo: Record<string, number> = {
        chance: 0,
        one_pair: 1,
        two_pair: 2,
        three_kind: 3,
        sm_straight: 4,
        full_house: 5,
        lg_straight: 6,
        four_kind: 7,
        five_kind: 8,
      };
      ctx.chipsBonus += (tierByCombo[ctx.hand.comboId] ?? 0) * 4;
    },
  },
  {
    id: 'of-the-eclipse',
    slot: 'suffix',
    family: 'scalar',
    budgetCost: 3,
    validOn: ['combo', 'timing'],
    weight: 0.8,
    nameTemplate: 'of the Eclipse',
    description: '+8 mult on boss blind',
    flavorTags: ['cold', 'void'],
    effect: (ctx) => {
      if (ctx.trial.isBossBlind) {
        ctx.multBonus += 8;
      }
    },
  },
  {
    id: 'of-the-tessellation',
    slot: 'suffix',
    family: 'scalar',
    budgetCost: 2,
    validOn: ['face', 'scaling', 'collision'],
    weight: 1.0,
    nameTemplate: 'of the Tessellation',
    description: '+6 chips per pair of matching dice',
    flavorTags: ['paradox', 'flux'],
    effect: (ctx) => {
      // +X chips per pair of identical dice values on the hand.
      const counts = new Map<number, number>();
      for (const v of ctx.hand.diceValues) counts.set(v, (counts.get(v) ?? 0) + 1);
      let pairs = 0;
      for (const c of counts.values()) pairs += Math.floor(c / 2);
      ctx.chipsBonus += pairs * 6;
    },
  },
  {
    id: 'of-static',
    slot: 'suffix',
    family: 'scalar',
    budgetCost: 2,
    validOn: ['face', 'mods'],
    weight: 1.0,
    nameTemplate: 'of Static',
    description: '+8 chips per Wild die',
    flavorTags: ['flux', 'whisper'],
    effect: (ctx) => {
      let wilds = 0;
      for (const w of ctx.hand.isWild) if (w) wilds += 1;
      ctx.chipsBonus += wilds * 8;
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
    description: '+5 mult when any Wild is rolled',
    flavorTags: ['void', 'decay'],
    effect: (ctx) => {
      if (ctx.hand.isWild.some(Boolean)) {
        ctx.multBonus += 5;
      }
    },
  },
  {
    id: 'whispering-second',
    slot: 'prefix',
    family: 'conditional',
    budgetCost: 3,
    validOn: ['timing', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Whispering',
    description: 'first hand of trial: +25 mult once',
    flavorTags: ['whisper', 'memory'],
    effect: (ctx) => {
      // One-shot: first hand of the trial only.
      if ((ctx.scratch.whisperingSecondFired ?? 0) === 0 && ctx.trial.rollsThisTrial <= 1) {
        ctx.multBonus += 25;
        ctx.scratch.whisperingSecondFired = 1;
      }
    },
  },
  {
    id: 'coiled',
    slot: 'prefix',
    family: 'conditional',
    budgetCost: 2,
    validOn: ['scaling', 'mods'],
    weight: 1.0,
    nameTemplate: 'Coiled',
    description: '+4 mult; every 3rd fire doubles to +8',
    flavorTags: ['flux'],
    effect: (ctx) => {
      ctx.scratch.coiledTick = (ctx.scratch.coiledTick ?? 0) + 1;
      const base = 4;
      // Every 3rd fire doubles its own payout.
      const amt = ctx.scratch.coiledTick % 3 === 0 ? base * 2 : base;
      ctx.multBonus += amt;
    },
  },
  {
    id: 'phasing',
    slot: 'prefix',
    family: 'conditional',
    budgetCost: 2,
    validOn: ['face', 'mods'],
    weight: 1.0,
    nameTemplate: 'Phasing',
    description: '+25 chips when any Wild is rolled',
    flavorTags: ['flux', 'void'],
    effect: (ctx) => {
      // Bonus when at least one die is wild (blank face = -1 in pipeline).
      if (ctx.hand.isWild.some(Boolean)) {
        ctx.chipsBonus += 25;
      }
    },
  },
  {
    id: 'wandering',
    slot: 'prefix',
    family: 'conditional',
    budgetCost: 2,
    validOn: ['timing', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Wandering',
    description: 'every 5th hand of trial: +12 mult',
    flavorTags: ['memory'],
    effect: (ctx) => {
      ctx.scratch.wanderingHands = (ctx.scratch.wanderingHands ?? 0) + 1;
      if (ctx.scratch.wanderingHands % 5 === 0) {
        ctx.multBonus += 12;
      }
    },
  },
  {
    id: 'spectral',
    slot: 'prefix',
    family: 'conditional',
    budgetCost: 3,
    validOn: ['risk', 'utility'],
    weight: 0.8,
    nameTemplate: 'Spectral',
    description: 'when discards remaining is 0: +10 mult',
    flavorTags: ['void', 'whisper'],
    effect: (ctx) => {
      if (ctx.run.discardsRemaining === 0) {
        ctx.multBonus += 10;
      }
    },
  },
  {
    id: 'of-curfew',
    slot: 'suffix',
    family: 'conditional',
    budgetCost: 2,
    validOn: ['timing'],
    weight: 1.0,
    nameTemplate: 'of Curfew',
    description: '+30 chips on last hand of trial',
    flavorTags: ['cold', 'decay'],
    effect: (ctx) => {
      if (ctx.run.handsRemaining <= 1) {
        ctx.chipsBonus += 30;
      }
    },
  },
  {
    id: 'of-the-lacuna',
    slot: 'suffix',
    family: 'conditional',
    budgetCost: 2,
    validOn: ['utility', 'timing'],
    weight: 1.0,
    nameTemplate: 'of the Lacuna',
    description: '+7 mult when no rerolls used this trial',
    flavorTags: ['void', 'memory'],
    effect: (ctx) => {
      // No rerolls used this trial means rollsThisTrial counts only the
      // initial roll. Reward conservative play.
      if (ctx.trial.rollsThisTrial <= 1) {
        ctx.multBonus += 7;
      }
    },
  },
  {
    id: 'of-misplaced-light',
    slot: 'suffix',
    family: 'conditional',
    budgetCost: 4,
    validOn: ['economy', 'risk'],
    weight: 0.6,
    nameTemplate: 'of Misplaced Light',
    description: 'when gold = 13: doubles mult + 8',
    flavorTags: ['paradox', 'cold'],
    effect: (ctx) => {
      if (ctx.run.goldHeld === 13) {
        ctx.multBonus += Math.max(1, Math.floor(ctx.multBonus));  // doubles current accrued mult
        ctx.multBonus += 8;  // baseline payout so it still rewards on a fresh ctx
      }
    },
  },
  {
    id: 'of-the-late-hour',
    slot: 'suffix',
    family: 'conditional',
    budgetCost: 2,
    validOn: ['timing', 'scaling'],
    weight: 1.0,
    nameTemplate: 'of the Late Hour',
    description: '+20 chips after 5+ rolls this trial',
    flavorTags: ['decay', 'memory'],
    effect: (ctx) => {
      if (ctx.trial.rollsThisTrial > 5) {
        ctx.chipsBonus += 20;
      }
    },
  },
  {
    id: 'of-the-quiet-throat',
    slot: 'suffix',
    family: 'conditional',
    budgetCost: 2,
    validOn: ['face'],
    weight: 1.0,
    nameTemplate: 'of the Quiet Throat',
    description: '+18 chips when hand contains seed digit',
    flavorTags: ['whisper'],
    effect: (ctx) => {
      if (ctx.run.seedDigit > 0 && ctx.hand.diceValues.includes(ctx.run.seedDigit)) {
        ctx.chipsBonus += 18;
      }
    },
  },
  {
    id: 'of-the-returning-stride',
    slot: 'suffix',
    family: 'conditional',
    budgetCost: 2,
    validOn: ['collision', 'timing'],
    weight: 1.0,
    nameTemplate: 'of the Returning Stride',
    description: 'every even-indexed hand: +6 mult',
    flavorTags: ['flux'],
    effect: (ctx) => {
      // Fires on even-indexed hands of the trial (alternating bonus).
      if (ctx.trial.rollsThisTrial > 0 && ctx.trial.rollsThisTrial % 2 === 0) {
        ctx.multBonus += 6;
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
    description: 'banks dice face-reads; pays out on Full House',
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
  {
    id: 'murmuring',
    slot: 'prefix',
    family: 'persistent',
    budgetCost: 3,
    validOn: ['risk', 'timing'],
    weight: 0.8,
    nameTemplate: 'Murmuring',
    description: 'banks mult on low discards; pays out on boss',
    flavorTags: ['whisper'],
    effect: (ctx) => {
      // Bank 1 mult per discard-pressure tick (each time discards remaining is low).
      if (ctx.run.discardsRemaining <= 1) {
        ctx.scratch.murmurBank = (ctx.scratch.murmurBank ?? 0) + 1;
      }
      if (ctx.trial.isBossBlind) {
        ctx.multBonus += ctx.scratch.murmurBank ?? 0;
        ctx.scratch.murmurBank = 0;
      }
    },
  },
  {
    id: 'bleak',
    slot: 'prefix',
    family: 'persistent',
    budgetCost: 3,
    validOn: ['face', 'combo', 'mods'],
    weight: 1.0,
    nameTemplate: 'Bleak',
    description: 'banks 2 chips per Wild; pays out on Full House',
    flavorTags: ['cold', 'void'],
    effect: (ctx) => {
      // Bank 2 chips per Wild on the hand; pay out on Full House.
      let wilds = 0;
      for (const w of ctx.hand.isWild) if (w) wilds += 1;
      ctx.scratch.bleakBank = (ctx.scratch.bleakBank ?? 0) + wilds * 2;
      if (ctx.hand.comboId === 'full_house') {
        ctx.chipsBonus += ctx.scratch.bleakBank;
        ctx.scratch.bleakBank = 0;
      }
    },
  },
  {
    id: 'knotted',
    slot: 'prefix',
    family: 'persistent',
    budgetCost: 2,
    validOn: ['scaling', 'collision'],
    weight: 1.0,
    nameTemplate: 'Knotted',
    description: 'banks per hand; pays 3x on Four/Five of a Kind',
    flavorTags: ['flux'],
    effect: (ctx) => {
      ctx.scratch.knottedBank = (ctx.scratch.knottedBank ?? 0) + 1;
      // Pay out on Four-of-a-Kind or better.
      if (ctx.hand.comboId === 'four_kind' || ctx.hand.comboId === 'five_kind') {
        ctx.chipsBonus += ctx.scratch.knottedBank * 3;
        ctx.scratch.knottedBank = 0;
      }
    },
  },
  {
    id: 'of-the-hollow-coin',
    slot: 'suffix',
    family: 'persistent',
    budgetCost: 3,
    validOn: ['economy', 'combo'],
    weight: 1.0,
    nameTemplate: 'of the Hollow Coin',
    description: 'banks per Pair; pays 5x at boss blind',
    flavorTags: ['cold', 'decay'],
    effect: (ctx) => {
      // Bank 1 unit per Pair scored; pay as chip bonus at trial end (boss blind).
      if (ctx.hand.comboId === 'one_pair' || ctx.hand.comboId === 'two_pair') {
        ctx.scratch.hollowCoinBank = (ctx.scratch.hollowCoinBank ?? 0) + 1;
      }
      if (ctx.trial.isBossBlind) {
        ctx.chipsBonus += (ctx.scratch.hollowCoinBank ?? 0) * 5;
        ctx.scratch.hollowCoinBank = 0;
      }
    },
  },
  {
    id: 'of-the-returning-tide',
    slot: 'suffix',
    family: 'persistent',
    budgetCost: 3,
    validOn: ['economy'],
    weight: 1.0,
    nameTemplate: 'of the Returning Tide',
    description: 'banks chips on even gold; pays on odd',
    flavorTags: ['flux'],
    effect: (ctx) => {
      // Bank chips when gold is even; pay out when gold becomes odd.
      if (ctx.run.goldHeld % 2 === 0) {
        ctx.scratch.tideBank = (ctx.scratch.tideBank ?? 0) + 4;
      } else {
        ctx.chipsBonus += ctx.scratch.tideBank ?? 0;
        ctx.scratch.tideBank = 0;
      }
    },
  },
  {
    id: 'of-memory',
    slot: 'suffix',
    family: 'persistent',
    budgetCost: 3,
    validOn: ['scaling', 'timing'],
    weight: 0.8,
    nameTemplate: 'of Memory',
    description: 'banks 2 chips per hand; every 3rd triples + pays',
    flavorTags: ['memory', 'whisper'],
    effect: (ctx) => {
      ctx.scratch.memoryTick = (ctx.scratch.memoryTick ?? 0) + 1;
      ctx.scratch.memoryBank = (ctx.scratch.memoryBank ?? 0) + 2;
      if (ctx.scratch.memoryTick % 3 === 0) {
        ctx.scratch.memoryBank *= 2;
        ctx.chipsBonus += ctx.scratch.memoryBank;
        ctx.scratch.memoryBank = 0;
      }
    },
  },
  {
    id: 'that-echoes-backward',
    slot: 'mid',
    family: 'persistent',
    budgetCost: 5,
    validOn: ['combo', 'scaling'],
    weight: 0.4,
    nameTemplate: 'That-Echoes-Backward',
    description: 'banks per face; pays on Full House (2x if >50)',
    flavorTags: ['memory', 'paradox', 'void'],
    effect: (ctx) => {
      // Banks 1 chip per hand, fires twice when banked beyond 50.
      ctx.scratch.echoBackBank = (ctx.scratch.echoBackBank ?? 0) + ctx.hand.diceValues.length;
      const fire = ctx.scratch.echoBackBank > 50 ? 2 : 1;
      if (ctx.hand.comboId === 'full_house' || ctx.hand.comboId === 'four_kind') {
        ctx.chipsBonus += ctx.scratch.echoBackBank * fire;
        ctx.scratch.echoBackBank = 0;
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
    description: '+12 mult; disabled on Straight',
    flavorTags: ['void', 'paradox'],
    effect: (ctx) => {
      // +12 mult, but disables on Straight.
      if (ctx.hand.comboId === 'sm_straight' || ctx.hand.comboId === 'lg_straight') return;
      ctx.multBonus += 12;
    },
  },
  {
    id: 'cracked-mirror',
    slot: 'prefix',
    family: 'drawback',
    budgetCost: -2,
    validOn: ['combo', 'risk'],
    weight: 1.0,
    nameTemplate: 'Cracked',
    description: '+30 mult; cannot fire on Pair or Two Pair',
    flavorTags: ['decay', 'paradox'],
    effect: (ctx) => {
      // +30 mult, but cannot fire on Pair or Two-Pair.
      if (ctx.hand.comboId === 'one_pair' || ctx.hand.comboId === 'two_pair') return;
      ctx.multBonus += 30;
    },
  },
  {
    id: 'drowned',
    slot: 'prefix',
    family: 'drawback',
    budgetCost: -2,
    validOn: ['face', 'risk', 'mods'],
    weight: 1.0,
    nameTemplate: 'Drowned',
    description: '+25 chips; -10 chips per Wild',
    flavorTags: ['cold', 'decay'],
    effect: (ctx) => {
      // +25 chips, -10 chips per Wild on the hand.
      let wilds = 0;
      for (const w of ctx.hand.isWild) if (w) wilds += 1;
      ctx.chipsBonus += 25 - wilds * 10;
    },
  },
  {
    id: 'misremembered',
    slot: 'prefix',
    family: 'drawback',
    budgetCost: -3,
    validOn: ['timing', 'risk', 'scaling'],
    weight: 0.6,
    nameTemplate: 'Misremembered',
    description: '+50 chips; but first hand of trial scores -50',
    flavorTags: ['memory', 'paradox'],
    effect: (ctx) => {
      // +50 chips, but the first hand of the trial scores 0.
      if (ctx.trial.rollsThisTrial <= 1) {
        ctx.chipsBonus -= 50;
        return;
      }
      ctx.chipsBonus += 50;
    },
  },
  {
    id: 'of-smoke',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -2,
    validOn: ['scaling', 'risk'],
    weight: 1.0,
    nameTemplate: 'of Smoke',
    description: '+25 chips minus 1 per hand remaining',
    flavorTags: ['flux', 'decay'],
    effect: (ctx) => {
      // +25 chips, loses 1 chip per hand remaining.
      ctx.chipsBonus += Math.max(0, 25 - ctx.run.handsRemaining);
    },
  },
  {
    id: 'of-wrong-numbers',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -2,
    validOn: ['economy', 'risk'],
    weight: 1.0,
    nameTemplate: 'of Wrong Numbers',
    description: '+14 mult only when gold ≤ 5',
    flavorTags: ['paradox', 'whisper'],
    effect: (ctx) => {
      // +14 mult, but only if goldHeld is 5 or less.
      if (ctx.run.goldHeld <= 5) {
        ctx.multBonus += 14;
      }
    },
  },
  {
    id: 'of-the-last-roll',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -2,
    validOn: ['timing', 'risk'],
    weight: 1.0,
    nameTemplate: 'of the Last Roll',
    description: '+50 chips only on last hand of trial',
    flavorTags: ['void', 'cold'],
    effect: (ctx) => {
      // +50 chips, but only on the last hand of the trial.
      if (ctx.run.handsRemaining <= 1) {
        ctx.chipsBonus += 50;
      }
    },
  },
  {
    id: 'of-curfew-mirror',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -2,
    validOn: ['economy', 'risk'],
    weight: 1.0,
    nameTemplate: 'of Curfew',
    description: '+9 mult; -1 gold each fire',
    flavorTags: ['cold', 'decay'],
    effect: (ctx) => {
      // +9 mult and -1 gold sink registered on ctx.goldBonus per fire.
      ctx.multBonus += 9;
      ctx.goldBonus -= 1;
    },
  },
  {
    id: 'of-the-ninth-door-curse',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -3,
    validOn: ['risk', 'collision'],
    weight: 0.5,
    nameTemplate: 'of the Ninth Door',
    description: '+35 chips, reduced by 2 per catalyst owned',
    flavorTags: ['void', 'paradox'],
    effect: (ctx) => {
      // +35 chips, scales upward with catalystsOwned but with a penalty
      // when the owner has many catalysts (the catalysts "drown" the door).
      const bonus = 35 - Math.min(15, ctx.run.catalystsOwned * 2);
      ctx.chipsBonus += Math.max(5, bonus);
    },
  },
  {
    id: 'of-hunger',
    slot: 'suffix',
    family: 'drawback',
    budgetCost: -3,
    validOn: ['risk', 'scaling'],
    weight: 0.4,
    nameTemplate: 'of Hunger',
    description: 'doubles current accrued mult (capped +40)',
    flavorTags: ['decay', 'heat'],
    effect: (ctx) => {
      // x2 mult (additive equivalent: doubles whatever mult-bonus is
      // already accrued by other affixes on the same context), capped
      // to avoid runaway with pathological stacks.
      const doubled = Math.min(40, ctx.multBonus);
      ctx.multBonus += doubled;
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
    description: '+1 mult per catalyst owned',
    flavorTags: ['whisper', 'memory'],
    effect: (ctx) => {
      // +1 mult per catalyst owned.
      ctx.multBonus += ctx.run.catalystsOwned;
    },
  },
  {
    id: 'coiled-twin',
    slot: 'prefix',
    family: 'synergy',
    budgetCost: 2,
    validOn: ['mods'],
    weight: 1.0,
    nameTemplate: 'Coiled',
    description: 'when 3+ catalysts owned: +7 mult',
    flavorTags: ['flux', 'whisper'],
    effect: (ctx) => {
      // Larger payout when the owner has built a mod-heavy board
      // (proxied via catalystsOwned >= 3).
      if (ctx.run.catalystsOwned >= 3) {
        ctx.multBonus += 7;
      }
    },
  },
  {
    id: 'harmonic',
    slot: 'prefix',
    family: 'synergy',
    budgetCost: 2,
    validOn: ['mods', 'collision'],
    weight: 1.0,
    nameTemplate: 'Harmonic',
    description: '+3 chips per scoring die',
    flavorTags: ['flux', 'memory'],
    effect: (ctx) => {
      // +chips per scoring die (proxy for mod-attached dice).
      ctx.chipsBonus += ctx.hand.diceValues.length * 3;
    },
  },
  {
    id: 'kinetic',
    slot: 'prefix',
    family: 'synergy',
    budgetCost: 2,
    validOn: ['collision', 'scaling'],
    weight: 1.0,
    nameTemplate: 'Kinetic',
    description: '+1 mult per die rolled',
    flavorTags: ['heat', 'flux'],
    effect: (ctx) => {
      // +1 mult per die rolled (proxy for collision count).
      ctx.multBonus += ctx.hand.diceValues.length;
    },
  },
  {
    id: 'of-the-orbit',
    slot: 'suffix',
    family: 'synergy',
    budgetCost: 2,
    validOn: ['utility', 'timing'],
    weight: 1.0,
    nameTemplate: 'of the Orbit',
    description: 'when discards + hands is even: +5 mult',
    flavorTags: ['cold', 'paradox'],
    effect: (ctx) => {
      if ((ctx.run.discardsRemaining + ctx.run.handsRemaining) % 2 === 0) {
        ctx.multBonus += 5;
      }
    },
  },
  {
    id: 'of-the-fold',
    slot: 'suffix',
    family: 'synergy',
    budgetCost: 2,
    validOn: ['scaling', 'mods'],
    weight: 1.0,
    nameTemplate: 'of the Fold',
    description: '+4 chips per catalyst owned',
    flavorTags: ['paradox', 'flux'],
    effect: (ctx) => {
      // +chips per catalyst owned. Approximates "per affix on this item"
      // without needing inter-affix introspection; tightens with run scale.
      ctx.chipsBonus += ctx.run.catalystsOwned * 4;
    },
  },
  {
    id: 'of-the-resonance',
    slot: 'suffix',
    family: 'synergy',
    budgetCost: 2,
    validOn: ['utility', 'risk'],
    weight: 1.0,
    nameTemplate: 'of the Resonance',
    description: 'first 2 hands of trial: +8 mult',
    flavorTags: ['whisper', 'flux'],
    effect: (ctx) => {
      if (ctx.trial.rollsThisTrial <= 2) {
        ctx.multBonus += 8;
      }
    },
  },
  {
    id: 'of-the-pact',
    slot: 'suffix',
    family: 'synergy',
    budgetCost: 3,
    validOn: ['economy', 'risk'],
    weight: 0.8,
    nameTemplate: 'of the Pact',
    description: 'on boss + gold < 10: +15 mult',
    flavorTags: ['void', 'whisper'],
    effect: (ctx) => {
      if (ctx.trial.isBossBlind && ctx.run.goldHeld < 10) {
        ctx.multBonus += 15;
      }
    },
  },
  {
    id: 'of-the-archive',
    slot: 'suffix',
    family: 'synergy',
    budgetCost: 2,
    validOn: ['scaling', 'utility'],
    weight: 1.0,
    nameTemplate: 'of the Archive',
    description: '+3 chips per catalyst owned',
    flavorTags: ['memory'],
    effect: (ctx) => {
      ctx.chipsBonus += ctx.run.catalystsOwned * 3;
    },
  },
  {
    id: 'of-the-keystone',
    slot: 'suffix',
    family: 'synergy',
    budgetCost: 3,
    validOn: ['combo', 'face'],
    weight: 0.8,
    nameTemplate: 'of the Keystone',
    description: 'on Straight or better: +4 mult per Wild',
    flavorTags: ['heat', 'memory'],
    effect: (ctx) => {
      // On Straight or better, +mult per Wild face.
      const tierAtLeastStraight =
        ctx.hand.comboId === 'sm_straight' ||
        ctx.hand.comboId === 'lg_straight' ||
        ctx.hand.comboId === 'full_house' ||
        ctx.hand.comboId === 'four_kind' ||
        ctx.hand.comboId === 'five_kind';
      if (!tierAtLeastStraight) return;
      let wilds = 0;
      for (const w of ctx.hand.isWild) if (w) wilds += 1;
      ctx.multBonus += wilds * 4;
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
    description: 'One Pair scores as Three of a Kind',
    flavorTags: ['void', 'paradox'],
    effect: (ctx) => {
      // Treat One Pair as Three of a Kind for scoring (chips bump).
      if (ctx.hand.comboId === 'one_pair') {
        ctx.chipsBonus += 30;  // delta between One Pair and Three of a Kind base chips
        ctx.multBonus += 1;
      }
    },
  },
  {
    id: 'of-the-inverse',
    slot: 'suffix',
    family: 'reality-warp',
    budgetCost: 5,
    validOn: ['combo', 'scaling'],
    weight: 0.4,
    nameTemplate: 'of the Inverse',
    description: 'one hand per trial: swaps chips ↔ mult',
    flavorTags: ['paradox', 'void'],
    effect: (ctx) => {
      // For one hand per trial, swap chip and mult bonuses accumulated so far.
      if ((ctx.scratch.inverseFired ?? 0) === 0) {
        const a = ctx.chipsBonus;
        const b = ctx.multBonus;
        ctx.chipsBonus = b * 10;  // scale so mult-as-chips is meaningful
        ctx.multBonus = Math.floor(a / 10);
        ctx.scratch.inverseFired = 1;
      }
    },
  },
  {
    id: 'of-the-eclipse-rare',
    slot: 'suffix',
    family: 'reality-warp',
    budgetCost: 5,
    validOn: ['timing'],
    weight: 0.4,
    nameTemplate: 'of the Eclipse',
    description: 'on boss blind: +20 mult',
    flavorTags: ['cold', 'void'],
    effect: (ctx) => {
      // On boss blind, big mult payout (placeholder for future rule-skip).
      if (ctx.trial.isBossBlind) {
        ctx.multBonus += 20;
      }
    },
  },
  {
    id: 'of-the-sundering-warp',
    slot: 'suffix',
    family: 'reality-warp',
    budgetCost: 5,
    validOn: ['combo'],
    weight: 0.4,
    nameTemplate: 'of Sundering',
    description: 'Two Pair scores as Three of a Kind',
    flavorTags: ['void', 'decay'],
    effect: (ctx) => {
      // Two-Pair scores as if it were Three-of-a-Kind.
      if (ctx.hand.comboId === 'two_pair') {
        ctx.chipsBonus += 10;  // chips: 30 - 20
        ctx.multBonus += 2;    // mult: 5 - 3
      }
    },
  },
  {
    id: 'of-the-fold-warp',
    slot: 'suffix',
    family: 'reality-warp',
    budgetCost: 5,
    validOn: ['face'],
    weight: 0.4,
    nameTemplate: 'of the Fold',
    description: '+3 mult per even-valued die',
    flavorTags: ['paradox', 'flux'],
    effect: (ctx) => {
      let evens = 0;
      for (const v of ctx.hand.diceValues) {
        if (v > 0 && v % 2 === 0) evens += 1;
      }
      ctx.multBonus += evens * 3;
    },
  },
  {
    id: 'of-misplaced-light-warp',
    slot: 'suffix',
    family: 'reality-warp',
    budgetCost: 5,
    validOn: ['economy', 'utility'],
    weight: 0.4,
    nameTemplate: 'of Misplaced Light',
    description: '+2 gold per unused discard',
    flavorTags: ['paradox', 'cold'],
    effect: (ctx) => {
      // Each unused discard refunds gold via goldBonus.
      ctx.goldBonus += ctx.run.discardsRemaining * 2;
    },
  },
  {
    id: 'made-of-borrowed-hours',
    slot: 'mid',
    family: 'reality-warp',
    budgetCost: 5,
    validOn: ['face', 'combo'],
    weight: 0.4,
    nameTemplate: 'Made-of-Borrowed-Hours',
    description: '+3 mult per adjacent-face dice pair',
    flavorTags: ['memory', 'paradox', 'void'],
    effect: (ctx) => {
      // Adjacent-face heuristic: count consecutive-integer pairs in the
      // hand and convert them to mult, as if straight-fragments scored.
      const sorted = [...ctx.hand.diceValues].filter((v) => v > 0).sort((a, b) => a - b);
      let adj = 0;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]! - sorted[i - 1]! === 1) adj += 1;
      }
      ctx.multBonus += adj * 3;
    },
  },
  {
    id: 'of-the-lacuna-warp',
    slot: 'suffix',
    family: 'reality-warp',
    budgetCost: 5,
    validOn: ['timing', 'utility'],
    weight: 0.4,
    nameTemplate: 'of the Lacuna',
    description: 'first activation of trial fires twice',
    flavorTags: ['void', 'memory'],
    effect: (ctx) => {
      // First activation of the trial fires twice (recorded via scratch).
      const reps = (ctx.scratch.lacunaWarpFired ?? 0) === 0 ? 2 : 1;
      ctx.scratch.lacunaWarpFired = 1;
      ctx.chipsBonus += 10 * reps;
      ctx.multBonus += 2 * reps;
    },
  },
];

export const AFFIX_BY_ID: ReadonlyMap<string, AffixDef> = new Map(
  AFFIX_DEFS.map(a => [a.id, a]),
);
