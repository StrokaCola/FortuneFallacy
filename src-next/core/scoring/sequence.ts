import type { Beat, ScoreSequence, SequenceCtx, SequenceInput, SequenceTier } from './types';

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

export function buildScoreSequence(
  input: SequenceInput,
  ctx: SequenceCtx,
): ScoreSequence {
  const tier = pickTier(input, ctx);
  const beats: Beat[] = [];
  let t = 0;
  let running = 0;

  beats.push({ kind: 'cast-swell', t });
  t += 200;

  const gaps = tier === 'full' ? lerpGaps(200, 60, input.faces.length)
             : tier === 'mid'  ? lerpGaps(140, 80, input.faces.length)
             :                   input.faces.map(() => 60);

  for (let i = 0; i < input.faces.length; i++) {
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
    t += gaps[i]!;
  }

  if (tier === 'short') {
    t += 150;
    beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: false });
    return { beats, tier, totalDurMs: t };
  }

  // mid + full handled in subsequent tasks
  beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: false });
  return { beats, tier, totalDurMs: t };
}
