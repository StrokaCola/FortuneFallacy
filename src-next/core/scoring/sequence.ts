import type { Beat, ScoreSequence, SequenceCtx, SequenceInput, SequenceTier } from './types';

// Pacing constants per tier. All ms. Tunable in dev.
const PACING = {
  short: {
    castSwellMs: 200,
    dieGapMs: 350,
    comboGapMs: 250,
    multGapMs: 350,
    holdBreathMs: 200,
  },
  mid: {
    castSwellMs: 200,
    dieGapMs: 500,
    comboGapMs: 300,
    multGapMs: 400,
    holdBreathMs: 300,
  },
  full: {
    castSwellMs: 200,
    dieGapStartMs: 700,
    dieGapEndMs: 480,
    comboGapMs: 350,
    multGapMs: 450,
    holdBreathMs: 400,
  },
} as const;

const REDUCED_MOTION_DIE_GAP_MS = 220;
const BAIL_DIE_GAP_MS = 60;
const BAIL_LEAD_IN_MS = 200;
const BAIL_LEAD_OUT_MS = 200;

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
 * Contract: `input.mults` must be the ordered list of multipliers actually
 * applied by the scoring engine, so the internally-accumulated `running`
 * total converges to `input.finalTotal`. The adapter (`adapter.ts`) is
 * responsible for honoring this contract. Cross-target detection and the
 * boom's `crossedTarget` flag are derived from `running`, not `finalTotal`.
 *
 * Universal-beat contract (non-reduced-motion, non-bail paths): every tier
 * emits cast-swell -> die-ticks -> combo-bonus -> [0..N mult-slams] ->
 * hold-breath -> boom. Only pacing scales with tier. combo-bonus is emitted
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
  let running = 0;
  let crossEmitted = false;

  // Bail branch: last hand, target out of reach. Stripped sequence ending in bail.
  if (ctx.isLastHand && ctx.maxRemaining < ctx.target) {
    beats.push({ kind: 'cast-swell', t });
    t += BAIL_LEAD_IN_MS;
    let bailRunning = 0;
    for (let i = 0; i < input.faces.length; i++) {
      bailRunning += input.faces[i]!;
      beats.push({
        kind: 'die-tick',
        t,
        dieIdx: i,
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

  // Reduced-motion branch: stripped sequence — cast-swell + die ticks + boom.
  // No combo announce, no mult slams, no hold-breath. A11y fallback.
  if (ctx.reducedMotion) {
    beats.push({ kind: 'cast-swell', t });
    t += PACING.short.castSwellMs;
    for (let i = 0; i < input.faces.length; i++) {
      const before = running;
      running += input.faces[i]!;
      beats.push({
        kind: 'die-tick',
        t,
        dieIdx: i,
        face: input.faces[i]!,
        chipDelta: input.faces[i]!,
        runningTotal: running,
        pitchSemis: i,
      });
      if (!crossEmitted && before < ctx.target && running >= ctx.target) {
        beats.push({ kind: 'cross-target', t: t + 80, runningTotal: running, target: ctx.target });
        crossEmitted = true;
      }
      t += REDUCED_MOTION_DIE_GAP_MS;
    }
    t += 150;
    beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: running >= ctx.target });
    return { beats, tier, totalDurMs: t };
  }

  const checkCross = (beforeRunning: number) => {
    if (!crossEmitted && beforeRunning < ctx.target && running >= ctx.target) {
      beats.push({ kind: 'cross-target', t: t + 80, runningTotal: running, target: ctx.target });
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
      dieIdx: i,
      face: input.faces[i]!,
      chipDelta: input.faces[i]!,
      runningTotal: running,
      pitchSemis: i,
    });
    checkCross(before);
    t += dieGaps[i]!;
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
    t += comboGap;
  }

  // Mult-slams — data-driven (no fake slams when mults array is empty)
  const multGap = tier === 'full' ? PACING.full.multGapMs : PACING[tier].multGapMs;
  let multSemis = 12;
  for (const m of input.mults) {
    const before = running;
    running = Math.round(running * m.value);
    beats.push({
      kind: 'mult-slam',
      t,
      label: m.label,
      multiplier: m.value,
      pitchSemis: multSemis,
      ampScale: 1 + (multSemis - 12) * 0.1,
      tint: m.tint,
    });
    checkCross(before);
    multSemis += 2;
    t += multGap;
  }

  // Hold-breath — ALWAYS emitted before boom on non-reduced-motion / non-bail paths
  const breathMs = tier === 'full' ? PACING.full.holdBreathMs : PACING[tier].holdBreathMs;
  beats.push({ kind: 'hold-breath', t, durMs: breathMs });
  t += breathMs;

  // Boom — terminal
  beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: running >= ctx.target });
  return { beats, tier, totalDurMs: t };
}
