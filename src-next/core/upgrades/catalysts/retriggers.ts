// Retrigger catalysts (2026-05-11 scaling/retrigger pack)
//
// Like Encore and Gilding Press, these can't live in the standard
// register({...}) pipeline because they have to re-fire the per-die mod
// loop AFTER applyModScoring has finished. Instead, applyRetriggers()
// is called explicitly from phases/upgrades.ts immediately after the
// Encore pass.
//
// Each retrigger contributes additively on top of one another — Encore
// can stack with Polaris if both fire on the same die. Recursion Lens
// reads as a meta-modifier: it doubles ONLY the very first retrigger
// that fires this hand (one re-doubling at most, even with multiple
// retrigger catalysts owned).
//
// Stutter randomness: derived from ctx.rng (seeded), so a given seed
// produces identical stutter outcomes on replay. Prime guarantee
// (totalScoring ∈ {2,3,5,7}) overrides the dice roll.
//
// IMPORTANT: ALL retrigger fires emit `onUpgradeTriggered` with a
// catalyst-prefixed id (e.g. 'polaris', 'refrain', etc) so the
// CatalystStrip can pulse the right card and runStats credit the
// right owner.

import { applyDieModStep } from '../../mods/applyDieModStep';
import type { PhaseFn, PipelineCtx } from '../../pipeline/types';
import { Phase } from '../../pipeline/types';

type RetriggerCtx = {
  faces: number[];
  scoringDice: number[];
  scoringFaces: number[];
  diceMods: string[][];
};

function buildCtx(ctx: PipelineCtx): RetriggerCtx | null {
  const faces = ctx.sim?.finalFaces ?? [];
  if (faces.length === 0) return null;
  const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
  const scoringDice = order.filter((idx) => idx >= 0 && idx < faces.length);
  if (scoringDice.length === 0) return null;
  return {
    faces,
    scoringDice,
    scoringFaces: scoringDice.map((i) => faces[i]!),
    diceMods: ctx.state.run.diceMods,
  };
}

// Fire one die's mods. Returns the chip/mult delta and an upgrade event
// payload attributing the fire to the named catalyst.
function fireDie(
  ctx: PipelineCtx,
  rCtx: RetriggerCtx,
  dieIdx: number,
  catalystId: string,
): { chips: number; mult: number } {
  const pos = rCtx.scoringDice.indexOf(dieIdx);
  if (pos < 0) return { chips: 0, mult: 0 };
  const face = rCtx.faces[dieIdx]!;
  const mods = rCtx.diceMods[dieIdx] ?? [];
  if (mods.length === 0) return { chips: 0, mult: 0 };
  const step = applyDieModStep(
    {
      face,
      dieIdx,
      pos,
      totalScoring: rCtx.scoringDice.length,
      scoringFaces: rCtx.scoringFaces,
      titheBudget: 0, // retriggers never recharge tithe
    },
    mods,
  );
  // applyDieModStep returns additive chips/mult and a multiplicative dMultMul.
  // For retrigger purposes we collapse the multiplicative into an additive
  // approximation against the current ctx.mult: Δmult = ctx.mult*(dMultMul-1).
  // This keeps Crown/Keystone retriggers visible without distorting the
  // pipeline order.
  const multAdditiveFromMul = step.dMultMul !== 1 ? ctx.mult * (step.dMultMul - 1) : 0;
  return {
    chips: step.dChips,
    mult: step.dMult + multAdditiveFromMul,
  };
}

function emitFire(
  events: PipelineCtx['events'],
  catalystId: string,
  chips: number,
  mult: number,
): PipelineCtx['events'] {
  if (chips === 0 && mult === 0) return events;
  return [
    ...events,
    {
      type: 'onUpgradeTriggered',
      payload: { id: catalystId, phase: Phase.UPGRADES, deltaChips: chips, deltaMult: mult },
    },
  ];
}

// Polaris — single retrigger on the highest-face scoring die.
function polaris(ctx: PipelineCtx, rCtx: RetriggerCtx, recursionPending: { used: boolean }): PipelineCtx {
  const maxFace = Math.max(...rCtx.scoringFaces);
  const targetPos = rCtx.scoringFaces.indexOf(maxFace);
  if (targetPos < 0) return ctx;
  const dieIdx = rCtx.scoringDice[targetPos]!;
  let { chips, mult } = fireDie(ctx, rCtx, dieIdx, 'polaris');
  if (!recursionPending.used && chips + mult !== 0 && ctx.state.run.catalysts.includes('recursion_lens')) {
    chips *= 2;
    mult *= 2;
    recursionPending.used = true;
  }
  return {
    ...ctx,
    chips: ctx.chips + chips,
    mult: ctx.mult + mult,
    events: emitFire(ctx.events, 'polaris', chips, mult),
  };
}

// Refrain — when this hand's combo tier matches previous, every scoring die retriggers.
function refrain(ctx: PipelineCtx, rCtx: RetriggerCtx, recursionPending: { used: boolean }): PipelineCtx {
  const cur = ctx.combo?.tier ?? -1;
  const prev = ctx.state.run.tempoLastTier ?? -1;
  if (cur < 0 || cur !== prev) return ctx;
  let totalChips = 0;
  let totalMult = 0;
  for (const idx of rCtx.scoringDice) {
    const { chips, mult } = fireDie(ctx, rCtx, idx, 'refrain');
    totalChips += chips;
    totalMult += mult;
  }
  if (!recursionPending.used && (totalChips + totalMult) !== 0 && ctx.state.run.catalysts.includes('recursion_lens')) {
    totalChips *= 2;
    totalMult *= 2;
    recursionPending.used = true;
  }
  return {
    ...ctx,
    chips: ctx.chips + totalChips,
    mult: ctx.mult + totalMult,
    events: emitFire(ctx.events, 'refrain', totalChips, totalMult),
  };
}

// Mirror Edge — dice that were locked at score time retrigger.
function mirrorEdge(ctx: PipelineCtx, rCtx: RetriggerCtx, recursionPending: { used: boolean }): PipelineCtx {
  let totalChips = 0;
  let totalMult = 0;
  const dice = ctx.state.round.dice;
  for (const idx of rCtx.scoringDice) {
    if (!dice[idx]?.locked) continue;
    const { chips, mult } = fireDie(ctx, rCtx, idx, 'mirror_edge');
    totalChips += chips;
    totalMult += mult;
  }
  if (totalChips === 0 && totalMult === 0) return ctx;
  if (!recursionPending.used && ctx.state.run.catalysts.includes('recursion_lens')) {
    totalChips *= 2;
    totalMult *= 2;
    recursionPending.used = true;
  }
  return {
    ...ctx,
    chips: ctx.chips + totalChips,
    mult: ctx.mult + totalMult,
    events: emitFire(ctx.events, 'mirror_edge', totalChips, totalMult),
  };
}

// Curtain Call — on the final hand of the blind, every scoring die retriggers.
// handsLeft has already been decremented in SCORE_HAND prep? Actually no:
// the pipeline reads state from BEFORE the SCORE_HAND scoring tick. We look
// at handsLeft === 1 (one hand remaining → this IS that final hand).
function curtainCall(ctx: PipelineCtx, rCtx: RetriggerCtx, recursionPending: { used: boolean }): PipelineCtx {
  const handsLeft = ctx.state.round.handsLeft ?? 0;
  if (handsLeft > 1) return ctx;
  let totalChips = 0;
  let totalMult = 0;
  for (const idx of rCtx.scoringDice) {
    const { chips, mult } = fireDie(ctx, rCtx, idx, 'curtain_call');
    totalChips += chips;
    totalMult += mult;
  }
  if (totalChips === 0 && totalMult === 0) return ctx;
  if (!recursionPending.used && ctx.state.run.catalysts.includes('recursion_lens')) {
    totalChips *= 2;
    totalMult *= 2;
    recursionPending.used = true;
  }
  return {
    ...ctx,
    chips: ctx.chips + totalChips,
    mult: ctx.mult + totalMult,
    events: emitFire(ctx.events, 'curtain_call', totalChips, totalMult),
  };
}

// Stutter — 25% per scoring die. Guaranteed (100%) if scoring count is prime.
function stutter(ctx: PipelineCtx, rCtx: RetriggerCtx, recursionPending: { used: boolean }): PipelineCtx {
  const n = rCtx.scoringDice.length;
  const isPrime = n === 2 || n === 3 || n === 5 || n === 7;
  let totalChips = 0;
  let totalMult = 0;
  for (const idx of rCtx.scoringDice) {
    const hit = isPrime ? true : ctx.rng.next() < 0.25;
    if (!hit) continue;
    const { chips, mult } = fireDie(ctx, rCtx, idx, 'stutter');
    totalChips += chips;
    totalMult += mult;
  }
  if (totalChips === 0 && totalMult === 0) return ctx;
  if (!recursionPending.used && ctx.state.run.catalysts.includes('recursion_lens')) {
    totalChips *= 2;
    totalMult *= 2;
    recursionPending.used = true;
  }
  return {
    ...ctx,
    chips: ctx.chips + totalChips,
    mult: ctx.mult + totalMult,
    events: emitFire(ctx.events, 'stutter', totalChips, totalMult),
  };
}

// Cardinal Compass — every scoring die showing 4 retriggers once.
function cardinalCompass(ctx: PipelineCtx, rCtx: RetriggerCtx, recursionPending: { used: boolean }): PipelineCtx {
  let totalChips = 0;
  let totalMult = 0;
  for (const idx of rCtx.scoringDice) {
    if (rCtx.faces[idx] !== 4) continue;
    const { chips, mult } = fireDie(ctx, rCtx, idx, 'cardinal_compass');
    totalChips += chips;
    totalMult += mult;
  }
  if (totalChips === 0 && totalMult === 0) return ctx;
  if (!recursionPending.used && ctx.state.run.catalysts.includes('recursion_lens')) {
    totalChips *= 2;
    totalMult *= 2;
    recursionPending.used = true;
  }
  return {
    ...ctx,
    chips: ctx.chips + totalChips,
    mult: ctx.mult + totalMult,
    events: emitFire(ctx.events, 'cardinal_compass', totalChips, totalMult),
  };
}

// Echo Chamber — when 4+ dice score, the first scoring die's mods fire twice.
function echoChamber(ctx: PipelineCtx, rCtx: RetriggerCtx, recursionPending: { used: boolean }): PipelineCtx {
  if (rCtx.scoringDice.length < 4) return ctx;
  const firstIdx = rCtx.scoringDice[0]!;
  let { chips, mult } = fireDie(ctx, rCtx, firstIdx, 'echo_chamber');
  if (chips === 0 && mult === 0) return ctx;
  if (!recursionPending.used && ctx.state.run.catalysts.includes('recursion_lens')) {
    chips *= 2;
    mult *= 2;
    recursionPending.used = true;
  }
  return {
    ...ctx,
    chips: ctx.chips + chips,
    mult: ctx.mult + mult,
    events: emitFire(ctx.events, 'echo_chamber', chips, mult),
  };
}

// Mirrored Hand easter-egg retrigger. Only fires once per blind — first
// hand only, then `round.mirroredHandConsumed` flips true. The flag is
// reset in startBlind so future blinds re-arm naturally.
function mirroredHandEgg(ctx: PipelineCtx, rCtx: RetriggerCtx): PipelineCtx {
  if (!ctx.state.run.mirroredHandActive) return ctx;
  if (ctx.state.round.mirroredHandConsumed) return ctx;
  let totalChips = 0;
  let totalMult = 0;
  for (const idx of rCtx.scoringDice) {
    const { chips, mult } = fireDie(ctx, rCtx, idx, 'mirrored_hand');
    totalChips += chips;
    totalMult += mult;
  }
  if (totalChips === 0 && totalMult === 0) return ctx;
  return {
    ...ctx,
    chips: ctx.chips + totalChips,
    mult: ctx.mult + totalMult,
    events: emitFire(ctx.events, 'mirrored_hand', totalChips, totalMult),
  };
}

export const applyRetriggers: PhaseFn = (ctx: PipelineCtx) => {
  const rCtx = buildCtx(ctx);
  if (!rCtx) return ctx;
  const owned = new Set(ctx.state.run.catalysts);
  let next = ctx;
  // Recursion Lens is a meta-modifier — it only doubles the FIRST retrigger
  // that contributes. Mutable flag threaded through each retrigger call.
  const recursionPending = { used: false };

  // Deterministic ordering for replays: Polaris → Refrain → Mirror Edge →
  // Curtain Call → Stutter → Cardinal Compass → Echo Chamber → Mirrored Hand.
  if (owned.has('polaris'))          next = polaris(next, rCtx, recursionPending);
  if (owned.has('refrain'))          next = refrain(next, rCtx, recursionPending);
  if (owned.has('mirror_edge'))      next = mirrorEdge(next, rCtx, recursionPending);
  if (owned.has('curtain_call'))     next = curtainCall(next, rCtx, recursionPending);
  if (owned.has('stutter'))          next = stutter(next, rCtx, recursionPending);
  if (owned.has('cardinal_compass')) next = cardinalCompass(next, rCtx, recursionPending);
  if (owned.has('echo_chamber'))     next = echoChamber(next, rCtx, recursionPending);
  // Mirrored Hand is the easter-egg retrigger — runs last so it stacks on top.
  next = mirroredHandEgg(next, rCtx);
  return next;
};

// Per-id stubs so the registry import side-effect chain still references each.
export {};
