import { describe, it, expect } from 'vitest';
import { evalDuck, isDuckComplete, DUCK_PRESETS, type DuckPhase } from './duckEnvelope';

const PHASE: DuckPhase = {
  startMs: 1000,
  attackMs: 100,
  holdMs: 200,
  releaseMs: 100,
  depth: 0.25,
};

describe('evalDuck', () => {
  it('returns 1 when elapsed is negative (envelope not yet started)', () => {
    expect(evalDuck(PHASE, 999)).toBe(1);
  });

  it('returns 1 right at start (elapsed = 0)', () => {
    expect(evalDuck(PHASE, 1000)).toBe(1);
  });

  it('linearly interpolates 1 → depth during attack', () => {
    expect(evalDuck(PHASE, 1050)).toBeCloseTo(0.625, 3);   // halfway
    expect(evalDuck(PHASE, 1100)).toBeCloseTo(0.25, 3);    // attack end
  });

  it('holds depth during the hold phase', () => {
    expect(evalDuck(PHASE, 1150)).toBe(0.25);
    expect(evalDuck(PHASE, 1300)).toBe(0.25);
  });

  it('linearly interpolates depth → 1 during release', () => {
    expect(evalDuck(PHASE, 1350)).toBeCloseTo(0.625, 3);   // halfway through release
    expect(evalDuck(PHASE, 1400)).toBeCloseTo(1, 3);       // release end
  });

  it('returns 1 after the envelope completes', () => {
    expect(evalDuck(PHASE, 5000)).toBe(1);
  });

  it('treats attackMs=0 as instant snap to depth', () => {
    const p: DuckPhase = { startMs: 0, attackMs: 0, holdMs: 100, releaseMs: 100, depth: 0 };
    expect(evalDuck(p, 1)).toBe(0);
    expect(evalDuck(p, 50)).toBe(0);
  });

  it('treats holdMs=0 as direct attack→release transition', () => {
    const p: DuckPhase = { startMs: 0, attackMs: 100, holdMs: 0, releaseMs: 100, depth: 0 };
    expect(evalDuck(p, 100)).toBe(0);   // end of attack = depth
    expect(evalDuck(p, 150)).toBeCloseTo(0.5, 3); // halfway through release
  });

  it('treats releaseMs=0 as instant snap back to 1 after hold', () => {
    const p: DuckPhase = { startMs: 0, attackMs: 0, holdMs: 100, releaseMs: 0, depth: 0 };
    expect(evalDuck(p, 50)).toBe(0);
    expect(evalDuck(p, 101)).toBe(1);
  });

  it('returns 1 when total duration is zero (no-op envelope)', () => {
    const p: DuckPhase = { startMs: 0, attackMs: 0, holdMs: 0, releaseMs: 0, depth: 0 };
    expect(evalDuck(p, 100)).toBe(1);
  });

  it('respects depth at full silence (0)', () => {
    const p: DuckPhase = { startMs: 0, attackMs: 100, holdMs: 0, releaseMs: 100, depth: 0 };
    expect(evalDuck(p, 100)).toBe(0);
  });
});

describe('isDuckComplete', () => {
  it('returns false during the envelope', () => {
    expect(isDuckComplete(PHASE, 1399)).toBe(false);
  });
  it('returns true at and after total duration', () => {
    expect(isDuckComplete(PHASE, 1400)).toBe(true);
    expect(isDuckComplete(PHASE, 5000)).toBe(true);
  });
});

describe('DUCK_PRESETS.holdBreath', () => {
  it('attack consumes most of the breath duration', () => {
    const p = DUCK_PRESETS.holdBreath(400);
    expect(p.attackMs).toBe(340);   // 400 * 0.85
    expect(p.holdMs).toBe(0);
    expect(p.depth).toBe(0.30);
    expect(p.releaseMs).toBe(500);
  });

  it('floors attackMs at 60 even for very short breaths', () => {
    const p = DUCK_PRESETS.holdBreath(20);
    expect(p.attackMs).toBe(60);
  });
});

describe('DUCK_PRESETS.silenceOnBust', () => {
  it('snaps to full silence and holds for ~1s', () => {
    const p = DUCK_PRESETS.silenceOnBust();
    expect(p.depth).toBe(0);
    expect(p.attackMs).toBe(80);
    expect(p.holdMs).toBe(900);
    expect(p.releaseMs).toBe(1800);
  });
});
