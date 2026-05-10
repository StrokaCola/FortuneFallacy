// Pure ADSR-style attack/hold/release envelope for ducking the music bus.
// The envelope value lerps 1 → depth → 1 over (attack + hold + release) ms.
// Used by AudioEngine to dim or silence layered loops in response to dramatic
// beats (e.g. anticipation hush before a slam, silence-on-bust after a bail).

export type DuckPhase = {
  startMs: number;
  attackMs: number;
  holdMs: number;
  releaseMs: number;
  depth: number;        // 0 = full silence, 1 = no duck
};

export function evalDuck(phase: DuckPhase, nowMs: number): number {
  const total = phase.attackMs + phase.holdMs + phase.releaseMs;
  if (total <= 0) return 1;
  const elapsed = nowMs - phase.startMs;
  if (elapsed <= 0) return 1;

  // Attack: ramp 1 → depth
  if (elapsed < phase.attackMs) {
    const k = phase.attackMs > 0 ? elapsed / phase.attackMs : 1;
    return 1 + (phase.depth - 1) * k;
  }

  // Hold: stay at depth
  const holdEnd = phase.attackMs + phase.holdMs;
  if (elapsed < holdEnd) return phase.depth;

  // Release: ramp depth → 1
  const releaseElapsed = elapsed - holdEnd;
  if (releaseElapsed < phase.releaseMs) {
    const k = phase.releaseMs > 0 ? releaseElapsed / phase.releaseMs : 1;
    return phase.depth + (1 - phase.depth) * k;
  }

  return 1;
}

export function isDuckComplete(phase: DuckPhase, nowMs: number): boolean {
  const total = phase.attackMs + phase.holdMs + phase.releaseMs;
  return nowMs - phase.startMs >= total;
}

// Preset envelopes used by the scoring router. Tunable in one place.
export const DUCK_PRESETS = {
  // Anticipation hush before mult-slam / boom. Lands at depth right as the
  // boom hits, then recovers during the boom tail.
  holdBreath(durMs: number): Omit<DuckPhase, 'startMs'> {
    return {
      attackMs: Math.max(60, Math.round(durMs * 0.85)),
      holdMs: 0,
      releaseMs: 500,
      depth: 0.30,
    };
  },
  // Silence-on-bust. Snap to 0, hold for ~1s, recover gradually as the fail
  // layer ramps in from audioBridge.
  silenceOnBust(): Omit<DuckPhase, 'startMs'> {
    return { attackMs: 80, holdMs: 900, releaseMs: 1800, depth: 0 };
  },
  // Tipping-point tension — running total enters [80%, 100%) of target.
  // Music dips moderately, holds while the next beats play, then resolves
  // (or doesn't, if the cross never lands). Slightly shorter than
  // holdBreath since the player needs the dread to LANDS on cross or
  // to sour as the hand fails to make the gap.
  tippingPoint(): Omit<DuckPhase, 'startMs'> {
    return { attackMs: 220, holdMs: 360, releaseMs: 700, depth: 0.45 };
  },
} as const;
