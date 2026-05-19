// Stack accrual + easter egg detection for the 2026-05-11 scaling pack.
// Called from actions/handlers/roll.ts SCORE_HAND after the pipeline runs.
//
// Each function returns a "diff" — a small partial RunSlice (and for eggs,
// also a RoundSlice diff + bonus shards/rerolls/events). The caller spreads
// these onto the working state. Keeping the accrual pure makes it trivial
// to unit-test and lets us emit egg events without touching the pipeline.
//
// DESIGN NOTE — visible counters: every stack we bump here also gets a
// corresponding "stacks updated" beat via the surrounding catalyst's own
// pipeline fire on the NEXT hand. The CatalystStrip reads run.catalystStacks
// directly for live "+N" badge display, so even mid-hand the counter is
// already visible in the corner of the card.

import type { RunSlice } from '../../state/slices/run';
import type { RoundSlice } from '../../state/slices/round';
import type { GameEventEmission } from '../../events/types';

// ─── Scaling-catalyst accrual ────────────────────────────────────────

const COMBO_TIERS: Record<string, number> = {
  chance: 0, one_pair: 1, two_pair: 2, three_kind: 3, sm_straight: 4,
  full_house: 5, lg_straight: 6, four_kind: 7, five_kind: 8,
};

export function accrueScalingStacks(args: {
  run: RunSlice;
  comboId: string | null;
  events: GameEventEmission[];
  peakHandWasNew: boolean;
}): { run: Partial<RunSlice> } {
  const { run, comboId, events, peakHandWasNew } = args;
  const owned = new Set(run.catalysts);
  const stacks: Record<string, number> = { ...(run.catalystStacks ?? {}) };
  let mutated = false;
  let lunarPhase = run.lunarPhase ?? 0;
  let lunarBakedMult = run.lunarBakedMult ?? 0;

  // Star Chart — +1 stack per scored Straight (small OR large).
  if (owned.has('star_chart') && (comboId === 'sm_straight' || comboId === 'lg_straight')) {
    stacks['star_chart'] = (stacks['star_chart'] ?? 0) + 1;
    mutated = true;
  }

  // Runaway (2026-05-18 audit add) — +1 stack per scored straight
  // (small or large). Each stack adds +0.10× mult permanent until
  // bust. Mirrors Star Chart's gate; the catalyst's apply handler
  // reads run.catalystStacks['runaway'].
  if (owned.has('runaway') && (comboId === 'sm_straight' || comboId === 'lg_straight')) {
    stacks['runaway'] = (stacks['runaway'] ?? 0) + 1;
    mutated = true;
  }

  // Lodestone — +1 stack per scored Pair (one_pair only; two_pair is a
  // distinct higher tier and pays the higher catalysts instead).
  if (owned.has('lodestone') && comboId === 'one_pair') {
    stacks['lodestone'] = (stacks['lodestone'] ?? 0) + 1;
    mutated = true;
  }

  // Ouroboros — +1 stack when this hand is the 3rd-or-later same-combo in
  // a row. comboStreak is incremented elsewhere AFTER scoring, so we look
  // at the previous streak value plus 1.
  if (owned.has('ouroboros') && comboId && run.lastComboId === comboId) {
    const wouldBeStreak = (run.comboStreak ?? 1) + 1;
    if (wouldBeStreak >= 3) {
      // Only bump once per 3-in-a-row window; reset window by checking
      // exact wouldBeStreak === 3 (then 6, 9...). Cleaner UX than "every
      // hand after the third".
      if (wouldBeStreak % 3 === 0) {
        stacks['ouroboros'] = (stacks['ouroboros'] ?? 0) + 1;
        mutated = true;
      }
    }
  }

  // Lunar Phases — advance one phase per hand. On phase 8 bake +0.1× and
  // reset to 0. lunarPhase counts 0..7 (display "Phase {n}/8" in UI).
  if (owned.has('lunar_phases')) {
    lunarPhase = (lunarPhase + 1) % 8;
    if (lunarPhase === 0) {
      // Just wrapped — that means we just hit the full-moon beat.
      lunarBakedMult += 0.1;
    }
  }

  // Event Horizon — walk the per-event chip contributions. If any single
  // event delivered 100+ chips on its own, that's a "big die" trigger.
  if (owned.has('event_horizon')) {
    let bigHit = false;
    for (const ev of events) {
      if (ev.type !== 'onUpgradeTriggered') continue;
      if ((ev.payload.deltaChips ?? 0) >= 100) {
        bigHit = true;
        break;
      }
    }
    if (bigHit) {
      stacks['event_horizon'] = (stacks['event_horizon'] ?? 0) + 1;
      mutated = true;
    }
  }

  // Highwater — +1 stack whenever a new personal-best hand was set. Gates
  // on `handsPlayed > 0` so the unavoidable "first hand sets the record"
  // doesn't give a free stack.
  if (owned.has('highwater') && peakHandWasNew && (run.handsPlayed ?? 0) > 0) {
    stacks['highwater'] = (stacks['highwater'] ?? 0) + 1;
    mutated = true;
  }

  const diff: Partial<RunSlice> = {};
  if (mutated) diff.catalystStacks = stacks;
  if (lunarPhase !== (run.lunarPhase ?? 0)) diff.lunarPhase = lunarPhase;
  if (lunarBakedMult !== (run.lunarBakedMult ?? 0)) diff.lunarBakedMult = lunarBakedMult;
  return { run: diff };
}

// ─── Per-blind stack accrual (Comet Trail, Memento Star, Heirloom Locket) ──

export function accrueBlindCleared(args: {
  run: RunSlice;
  round: RoundSlice;
  blindTarget: number;
  blindScore: number;
}): { run: Partial<RunSlice> } {
  const { run, round, blindTarget, blindScore } = args;
  const owned = new Set(run.catalysts);
  const stacks: Record<string, number> = { ...(run.catalystStacks ?? {}) };
  let mutated = false;

  // Comet Trail — only bump when NO consumable was used this blind.
  // Reset to 0 if any was used.
  if (owned.has('comet_trail')) {
    if (round.consumableUsedThisBlind) {
      if ((stacks['comet_trail'] ?? 0) !== 0) {
        stacks['comet_trail'] = 0;
        mutated = true;
      }
    } else {
      stacks['comet_trail'] = (stacks['comet_trail'] ?? 0) + 1;
      mutated = true;
    }
  }

  // Memento Star — bump when overflow ≥ 200% of target.
  if (owned.has('memento_star') && blindTarget > 0 && blindScore >= blindTarget * 2) {
    stacks['memento_star'] = (stacks['memento_star'] ?? 0) + 1;
    mutated = true;
  }

  // Heirloom Locket — +1 stack per cleared blind (no condition).
  if (owned.has('heirloom_locket')) {
    stacks['heirloom_locket'] = (stacks['heirloom_locket'] ?? 0) + 1;
    mutated = true;
  }

  // 2026-05-16 unlock-content roadmap — Cosmic Compass: +1 stack per
  // cleared blind. Per-ante cap is enforced at apply time (not here),
  // so the raw stack count keeps climbing while the player still sees
  // the headroom in the catalyst tooltip.
  if (owned.has('cosmic_compass')) {
    stacks['cosmic_compass'] = (stacks['cosmic_compass'] ?? 0) + 1;
    mutated = true;
  }

  // 2026-05-19 mythic — Voidforge: +1 stack per cleared blind. The
  // catalyst's UPGRADES apply reads this and adds +N permanent mult
  // to every hand. Resets on bust via the catalystStacks wipe in
  // bustBlind, matching the "first time each blind clears" reset
  // social contract.
  if (owned.has('voidforge')) {
    stacks['voidforge'] = (stacks['voidforge'] ?? 0) + 1;
    mutated = true;
  }

  return mutated ? { run: { catalystStacks: stacks } } : { run: {} };
}

// ─── Easter egg detection ────────────────────────────────────────────

const PRIME_FACES = new Set([2, 3, 5, 7]);

export type EasterEggDiff = {
  run: Partial<RunSlice>;
  round: Partial<RoundSlice>;
  events: GameEventEmission[];
  shardsBonus: number;
  bonusRerollsThisHand: number;
};

export function checkEasterEggs(args: {
  run: RunSlice;
  round: RoundSlice;
  handTotal: number;
  scoringFaces: number[];
  blindId: string | null;
  isBoss: boolean;
}): EasterEggDiff {
  const { run, round, handTotal, scoringFaces, blindId, isBoss } = args;
  const diff: EasterEggDiff = { run: {}, round: {}, events: [], shardsBonus: 0, bonusRerollsThisHand: 0 };
  const runDiff: Partial<RunSlice> = {};
  const roundDiff: Partial<RoundSlice> = {};

  // The Answer — hand totals EXACTLY 42 (Math.round to tolerate floating
  // point chain math drift). Once per run: arm the flag permanently and
  // bump rerollsLeft by 1 for the current hand. The downstream reroll-cap
  // logic doesn't strip extras, so the +1 carries forward.
  if (!run.theAnswerArmed && Math.round(handTotal) === 42) {
    runDiff.theAnswerArmed = true;
    diff.bonusRerollsThisHand = 1;
    diff.events.push({
      type: 'onUpgradeTriggered',
      payload: { id: 'easter_egg:answer', phase: 0, deltaChips: 0, deltaMult: 0 },
    });
  }

  // Lucky Seven — three or more scoring dice showing 7. Pays +50 shards.
  // No per-run gate — repeatable across hands.
  const sevens = scoringFaces.filter((f) => f === 7).length;
  if (sevens >= 3) {
    diff.shardsBonus = 50;
    diff.events.push({
      type: 'onUpgradeTriggered',
      payload: { id: 'easter_egg:lucky7', phase: 0, deltaChips: 0, deltaMult: 0 },
    });
  }

  // Eris Apple — in Eris's boss blind, all scoring faces are prime (2/3/5/7).
  // Flips errisAppleFlipped for the rest of the blind, which cancels Eris's
  // first-hand catalyst-disable debuff (via hasDebuff override below).
  if (
    isBoss &&
    blindId === 'eris' &&
    !round.errisAppleFlipped &&
    scoringFaces.length > 0 &&
    scoringFaces.every((f) => PRIME_FACES.has(f))
  ) {
    roundDiff.errisAppleFlipped = true;
    diff.events.push({
      type: 'onUpgradeTriggered',
      payload: { id: 'easter_egg:eris_apple', phase: 0, deltaChips: 0, deltaMult: 0 },
    });
  }

  diff.run = runDiff;
  diff.round = roundDiff;
  return diff;
}

// ─── Mirrored Hand detection (for START_BLIND) ──────────────────────

// Returns true iff at least two owned catalyst NAMES are palindromes
// (case-insensitive, ignoring non-letter chars). The check runs against
// CATALYST_META lookups in transitions.startBlind.
export function isPalindrome(s: string): boolean {
  const clean = s.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length < 2) return false;
  let i = 0;
  let j = clean.length - 1;
  while (i < j) {
    if (clean[i] !== clean[j]) return false;
    i++;
    j--;
  }
  return true;
}
