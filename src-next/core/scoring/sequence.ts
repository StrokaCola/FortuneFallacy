import type { Beat, ScoreSequence, SequenceCtx, SequenceInput, SequenceTier } from './types';

// Pacing constants per tier. All ms. Tunable in dev.
//
// Tightened 2026-05: cut ~20% globally + added post-cross-target
// acceleration. The previous values were optimised for "every beat
// distinct" — turned out players read the rhythm faster than the
// authored cadence, so the gaps felt draggy. New values keep the
// crescendo arc but at a tighter heart-rate.
const PACING = {
  short: {
    castSwellMs: 180,
    dieGapMs: 280,
    comboGapMs: 200,
    multGapMs: 280,
    upgradeChipGapMs: 220,
    upgradeMultGapMs: 220,
    holdBreathMs: 160,
  },
  mid: {
    castSwellMs: 180,
    dieGapMs: 400,
    comboGapMs: 240,
    multGapMs: 320,
    upgradeChipGapMs: 280,
    upgradeMultGapMs: 280,
    holdBreathMs: 240,
  },
  full: {
    castSwellMs: 180,
    dieGapStartMs: 560,
    dieGapEndMs: 380,
    comboGapMs: 280,
    multGapMs: 360,
    upgradeChipGapMs: 340,
    upgradeMultGapMs: 340,
    holdBreathMs: 300,
  },
} as const;

// Post-cross-target pacing curve. Once the running total has crossed
// the blind's target, the player has WON; remaining beats are pure
// celebration.
//
// Wave T Scoring Theater (Batch I, 2026-05-19) — replaces the flat
// 0.75× shrink with a *curve*: the FIRST post-cross beat snaps in
// fast (0.75×, the "you crossed it" punch), then subsequent beats
// progressively stretch BACK (0.85 → 0.95 → 1.05) so the chain reads
// as *sustained tension* climbing toward the boom rather than a
// drumroll rushing past it. Floor at 40ms so the floor case never
// hits zero. Hold-breath uses the FIRST factor (0.75) so the breath
// still tightens after cross.
const POST_CROSS_GAP_CURVE = [0.75, 0.85, 0.95, 1.05];
const POST_CROSS_GAP_FACTOR_HOLD = 0.75; // applied to hold-breath specifically
const POST_CROSS_BREATH_FLOOR_MS = 200;

const REDUCED_MOTION_DIE_GAP_MS = 220;
const REDUCED_MOTION_PRE_BOOM_MS = 150;
const BAIL_DIE_GAP_MS = 60;
const BAIL_LEAD_IN_MS = 200;
const BAIL_LEAD_OUT_MS = 200;
// Cross-target beat fires CROSS_TARGET_DELAY_MS after the running-total mutation
// that crossed the threshold, so the visual stamp lands AFTER the chip/mult slam.
const CROSS_TARGET_DELAY_MS = 80;

function pickTier(input: SequenceInput, ctx: SequenceCtx): SequenceTier {
  if (ctx.reducedMotion) return 'short';
  const ratio = input.finalTotal / Math.max(1, ctx.target);
  if (ratio >= 1) return 'full';
  if (ratio < 0.25) return 'short';
  return 'mid';
}

function lerpGaps(from: number, to: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.round(from + (to - from) * (i / Math.max(1, n - 1))));
  }
  return out;
}

/**
 * Builds a deterministic beat list for a scored hand.
 *
 * When `input.baseMult` is provided the sequence uses the per-event upgrade-beat
 * path: chips and mult are tracked as separate running accumulators
 * (`runningChips` × `runningMult`). Die-mod and catalyst contributions appear as
 * individual `upgrade-chip` and `upgrade-mult` beats ordered chip-then-mult per
 * event. The `mults` array then only contains chain (no ctx.mult slam).
 *
 * When `input.baseMult` is absent the legacy single-accumulator path is used:
 * the `mults` array drives standard `mult-slam` beats as before.
 *
 * Universal-beat contract (non-reduced-motion, non-bail paths): every tier
 * emits cast-swell -> die-ticks -> combo-bonus -> [upgrade beats OR mult-slams]
 * -> hold-breath -> boom. Only pacing scales with tier. combo-bonus is emitted
 * even when comboBonus === 0 so the player always sees the constellation
 * announced.
 */
export function buildScoreSequence(
  input: SequenceInput,
  ctx: SequenceCtx,
): ScoreSequence {
  const tier = pickTier(input, ctx);
  const beats: Beat[] = [];
  let t = 0;
  let crossEmitted = false;

  // Determine which path to use.
  const useUpgradePath = input.baseMult !== undefined;

  // --- Bail branch ---
  if (ctx.bail) {
    beats.push({ kind: 'cast-swell', t, initialMult: input.baseMult });
    t += BAIL_LEAD_IN_MS;
    let bailRunning = 0;
    for (let i = 0; i < input.faces.length; i++) {
      bailRunning += input.faces[i]!;
      beats.push({
        kind: 'die-tick',
        t,
        dieIdx: input.dieIndices?.[i] ?? i,
        face: input.faces[i]!,
        chipDelta: input.faces[i]!,
        runningTotal: bailRunning,
        pitchSemis: i,
      });
      t += BAIL_DIE_GAP_MS;
    }
    t += BAIL_LEAD_OUT_MS;
    beats.push({ kind: 'bail', t, runningTotal: bailRunning, target: ctx.target });
    return { beats, tier, totalDurMs: t };
  }

  // --- Reduced-motion branch ---
  if (ctx.reducedMotion) {
    let running = 0;
    beats.push({ kind: 'cast-swell', t, initialMult: input.baseMult });
    t += PACING.short.castSwellMs;
    for (let i = 0; i < input.faces.length; i++) {
      const before = running;
      running += input.faces[i]!;
      beats.push({
        kind: 'die-tick',
        t,
        dieIdx: input.dieIndices?.[i] ?? i,
        face: input.faces[i]!,
        chipDelta: input.faces[i]!,
        runningTotal: running,
        pitchSemis: i,
      });
      if (!crossEmitted && before < ctx.target && running >= ctx.target) {
        beats.push({ kind: 'cross-target', t: t + CROSS_TARGET_DELAY_MS, runningTotal: running, target: ctx.target });
        crossEmitted = true;
      }
      t += REDUCED_MOTION_DIE_GAP_MS;
    }
    t += REDUCED_MOTION_PRE_BOOM_MS;
    beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: running >= ctx.target });
    return { beats, tier, totalDurMs: t };
  }

  // --- Full / mid / short normal paths ---

  if (useUpgradePath) {
    return buildUpgradePath(input, ctx, tier);
  }
  return buildLegacyPath(input, ctx, tier);
}

// Upgrade-beat path: separate runningChips × runningMult accumulators.
function buildUpgradePath(
  input: SequenceInput,
  ctx: SequenceCtx,
  tier: SequenceTier,
): ScoreSequence {
  const beats: Beat[] = [];
  let t = 0;
  let crossEmitted = false;

  let runningChips = 0;
  let runningMult = input.baseMult!;
  const product = () => Math.round(runningChips * runningMult);

  // Once the running total crosses target, gaps follow POST_CROSS_GAP_CURVE
  // — first beat snaps in (0.75×), then stretches back to build sustained
  // tension into the boom.
  let postCrossAdvanceCount = 0;
  const advance = (gap: number): void => {
    if (crossEmitted) {
      const factor = POST_CROSS_GAP_CURVE[Math.min(postCrossAdvanceCount, POST_CROSS_GAP_CURVE.length - 1)] ?? 1;
      postCrossAdvanceCount += 1;
      t += Math.max(40, Math.round(gap * factor));
    } else {
      t += gap;
    }
  };

  const checkCross = () => {
    if (!crossEmitted && product() >= ctx.target) {
      beats.push({ kind: 'cross-target', t: t + CROSS_TARGET_DELAY_MS, runningTotal: product(), target: ctx.target });
      crossEmitted = true;
    }
  };

  // Cast-swell
  beats.push({ kind: 'cast-swell', t, initialMult: input.baseMult });
  t += tier === 'full' ? PACING.full.castSwellMs : PACING[tier].castSwellMs;

  // Die ticks
  const dieGaps =
    tier === 'full'
      ? lerpGaps(PACING.full.dieGapStartMs, PACING.full.dieGapEndMs, input.faces.length)
      : input.faces.map(() => PACING[tier].dieGapMs);

  for (let i = 0; i < input.faces.length; i++) {
    runningChips += input.faces[i]!;
    beats.push({
      kind: 'die-tick',
      t,
      dieIdx: input.dieIndices?.[i] ?? i,
      face: input.faces[i]!,
      chipDelta: input.faces[i]!,
      runningTotal: product(),
      pitchSemis: i,
    });
    checkCross();
    advance(dieGaps[i]!);
  }

  // Combo-bonus — ALWAYS emitted (even when comboBonus === 0)
  {
    runningChips += input.comboBonus;
    beats.push({
      kind: 'combo-bonus',
      t,
      comboLabel: input.comboLabel,
      chipDelta: input.comboBonus,
      runningTotal: product(),
    });
    checkCross();
    const comboGap = tier === 'full' ? PACING.full.comboGapMs : PACING[tier].comboGapMs;
    advance(comboGap);
  }

  // Upgrade events — chip pass then mult pass for each event
  const upgradeChipGap = tier === 'full' ? PACING.full.upgradeChipGapMs : PACING[tier].upgradeChipGapMs;
  const upgradeMultGap = tier === 'full' ? PACING.full.upgradeMultGapMs : PACING[tier].upgradeMultGapMs;

  for (const upg of input.upgrades ?? []) {
    if (upg.chipDelta !== 0) {
      runningChips += upg.chipDelta;
      beats.push({
        kind: 'upgrade-chip',
        t,
        label: upg.label,
        chipDelta: upg.chipDelta,
        runningTotal: product(),
        sourceType: upg.sourceType,
        sourceId: upg.sourceId,
        dieIdx: upg.dieIdx,
      });
      checkCross();
      advance(upgradeChipGap);
    }
    if (upg.multDelta !== 0) {
      runningMult += upg.multDelta;
      beats.push({
        kind: 'upgrade-mult',
        t,
        label: upg.label,
        multDelta: upg.multDelta,
        currentMult: runningMult,
        tint: upg.tint,
        sourceType: upg.sourceType,
        sourceId: upg.sourceId,
        dieIdx: upg.dieIdx,
      });
      checkCross();
      advance(upgradeMultGap);
    }
  }

  // Chain mult-slam: progressively shorter gaps as the chain deepens, so a
  // long mult chain crescendos into a drumroll instead of clicking past at
  // a flat tempo. Floor at 65% of the base gap so the last slams stay
  // distinct (a uniform-pace chain felt clunky in playtests). Pitch climbs
  // 2 semis per slam as before; ampScale rises with pitch and slam index
  // so deeper slams hit harder both audibly and emotionally.
  // Per-slam shortening tightened from 0.9 → 0.85: 15% faster per slam
  // so a 4-mult chain accelerates more aggressively into the boom.
  const baseMultGap = tier === 'full' ? PACING.full.multGapMs : PACING[tier].multGapMs;
  const minMultGap = Math.round(baseMultGap * 0.6);
  let multSemis = 12;
  for (let mi = 0; mi < input.mults.length; mi++) {
    const m = input.mults[mi]!;
    runningMult *= m.value;
    const gap = Math.max(minMultGap, Math.round(baseMultGap * Math.pow(0.85, mi)));
    beats.push({
      kind: 'mult-slam',
      t,
      label: m.label,
      multiplier: m.value,
      pitchSemis: multSemis,
      // Boost amp by pitch-climb (existing) plus a small per-index ramp,
      // so a 4-mult chain peaks ~30% louder on the last slam vs the first.
      ampScale: 1 + (multSemis - 12) * 0.1 + mi * 0.08,
      tint: m.tint,
    });
    checkCross();
    multSemis += 2;
    advance(gap);
  }

  // Hold-breath — full duration when crossing target IS the climax;
  // floor at POST_CROSS_BREATH_FLOOR_MS once already crossed so the
  // boom still has weight even after the celebration has accelerated.
  const breathBaseMs = tier === 'full' ? PACING.full.holdBreathMs : PACING[tier].holdBreathMs;
  const breathMs = crossEmitted
    ? Math.max(POST_CROSS_BREATH_FLOOR_MS, Math.round(breathBaseMs * POST_CROSS_GAP_FACTOR_HOLD))
    : breathBaseMs;
  beats.push({ kind: 'hold-breath', t, durMs: breathMs });
  t += breathMs;

  // Boom — megaRatio drives hit-stop tier in ScoreMoment. Computed
  // from product() / target so it accounts for ALL upgrade applications;
  // reduce-motion is gated upstream so we never feed mega visuals to
  // those players.
  const megaRatioFull = ctx.target > 0 ? product() / ctx.target : 0;
  beats.push({
    kind: 'boom', t, finalTotal: input.finalTotal,
    crossedTarget: product() >= ctx.target,
    ...(megaRatioFull >= 3 ? { megaRatio: megaRatioFull } : {}),
  });
  return { beats, tier, totalDurMs: t };
}

// Legacy path: single running accumulator, mult-slams from the mults array.
function buildLegacyPath(
  input: SequenceInput,
  ctx: SequenceCtx,
  tier: SequenceTier,
): ScoreSequence {
  const beats: Beat[] = [];
  let t = 0;
  let running = 0;
  let crossEmitted = false;

  // Same post-cross curve as the upgrade-path (Wave T Batch I).
  let postCrossAdvanceCount = 0;
  const advance = (gap: number): void => {
    if (crossEmitted) {
      const factor = POST_CROSS_GAP_CURVE[Math.min(postCrossAdvanceCount, POST_CROSS_GAP_CURVE.length - 1)] ?? 1;
      postCrossAdvanceCount += 1;
      t += Math.max(40, Math.round(gap * factor));
    } else {
      t += gap;
    }
  };

  const checkCross = (beforeRunning: number) => {
    if (!crossEmitted && beforeRunning < ctx.target && running >= ctx.target) {
      beats.push({ kind: 'cross-target', t: t + CROSS_TARGET_DELAY_MS, runningTotal: running, target: ctx.target });
      crossEmitted = true;
    }
  };

  // Cast-swell
  beats.push({ kind: 'cast-swell', t });
  t += tier === 'full' ? PACING.full.castSwellMs : PACING[tier].castSwellMs;

  // Die ticks
  const dieGaps =
    tier === 'full'
      ? lerpGaps(PACING.full.dieGapStartMs, PACING.full.dieGapEndMs, input.faces.length)
      : input.faces.map(() => PACING[tier].dieGapMs);

  for (let i = 0; i < input.faces.length; i++) {
    const before = running;
    running += input.faces[i]!;
    beats.push({
      kind: 'die-tick',
      t,
      dieIdx: input.dieIndices?.[i] ?? i,
      face: input.faces[i]!,
      chipDelta: input.faces[i]!,
      runningTotal: running,
      pitchSemis: i,
    });
    checkCross(before);
    advance(dieGaps[i]!);
  }

  // Combo-bonus — ALWAYS emitted (even when comboBonus === 0)
  {
    const before = running;
    running += input.comboBonus;
    beats.push({
      kind: 'combo-bonus',
      t,
      comboLabel: input.comboLabel,
      chipDelta: input.comboBonus,
      runningTotal: running,
    });
    checkCross(before);
    const comboGap = tier === 'full' ? PACING.full.comboGapMs : PACING[tier].comboGapMs;
    advance(comboGap);
  }

  // Mult-slams — data-driven, with the same accelerando + amp ramp as the
  // chain-mult path above. See `mults` loop earlier for the rationale.
  // Per-slam shortening tightened from 0.9 → 0.85 to match the
  // upgrade-path; floor 0.6 instead of 0.65 so the deepest slams still
  // shrink visibly at long chains.
  const baseMultGap = tier === 'full' ? PACING.full.multGapMs : PACING[tier].multGapMs;
  const minMultGap = Math.round(baseMultGap * 0.6);
  let multSemis = 12;
  for (let mi = 0; mi < input.mults.length; mi++) {
    const m = input.mults[mi]!;
    const before = running;
    running = Math.round(running * m.value);
    const gap = Math.max(minMultGap, Math.round(baseMultGap * Math.pow(0.85, mi)));
    beats.push({
      kind: 'mult-slam',
      t,
      label: m.label,
      multiplier: m.value,
      pitchSemis: multSemis,
      ampScale: 1 + (multSemis - 12) * 0.1 + mi * 0.08,
      tint: m.tint,
    });
    checkCross(before);
    multSemis += 2;
    advance(gap);
  }

  // Hold-breath — same post-cross floor treatment as the upgrade-path.
  const breathBaseMs = tier === 'full' ? PACING.full.holdBreathMs : PACING[tier].holdBreathMs;
  const breathMs = crossEmitted
    ? Math.max(POST_CROSS_BREATH_FLOOR_MS, Math.round(breathBaseMs * POST_CROSS_GAP_FACTOR_HOLD))
    : breathBaseMs;
  beats.push({ kind: 'hold-breath', t, durMs: breathMs });
  t += breathMs;

  // Boom — terminal. megaRatio extension matches the upgrade-path above
  // so legacy-path scoring also fires the hit-stop on mega scores.
  const megaRatioLegacy = ctx.target > 0 ? running / ctx.target : 0;
  beats.push({
    kind: 'boom', t, finalTotal: input.finalTotal,
    crossedTarget: running >= ctx.target,
    ...(megaRatioLegacy >= 3 ? { megaRatio: megaRatioLegacy } : {}),
  });
  return { beats, tier, totalDurMs: t };
}
