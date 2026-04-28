import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runScoreSequence } from './useScoreSequence';
import type { ScoreSequence } from '../../core/scoring/types';

describe('runScoreSequence', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('emits beats in order at correct times', () => {
    const seq: ScoreSequence = {
      tier: 'short',
      totalDurMs: 800,
      beats: [
        { kind: 'cast-swell', t: 0 },
        { kind: 'die-tick', t: 200, dieIdx: 0, face: 5, chipDelta: 5, runningTotal: 5, pitchSemis: 0 },
        { kind: 'boom', t: 800, finalTotal: 25, crossedTarget: false },
      ],
    };
    const emitted: string[] = [];
    const stop = runScoreSequence(seq, (b) => emitted.push(b.kind));

    // initial frame should fire t=0 beat
    vi.advanceTimersByTime(20);
    expect(emitted).toEqual(['cast-swell']);

    vi.advanceTimersByTime(220);
    expect(emitted).toEqual(['cast-swell', 'die-tick']);

    vi.advanceTimersByTime(700);
    expect(emitted).toEqual(['cast-swell', 'die-tick', 'boom']);

    stop();
  });

  it('stop() cancels pending beats', () => {
    const seq: ScoreSequence = {
      tier: 'short',
      totalDurMs: 800,
      beats: [
        { kind: 'cast-swell', t: 0 },
        { kind: 'boom', t: 800, finalTotal: 0, crossedTarget: false },
      ],
    };
    const emitted: string[] = [];
    const stop = runScoreSequence(seq, (b) => emitted.push(b.kind));
    vi.advanceTimersByTime(20);
    stop();
    vi.advanceTimersByTime(2000);
    expect(emitted).toEqual(['cast-swell']);
  });
});
