import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./sfx', () => ({
  sfxPlay: vi.fn(),
}));

vi.mock('./AudioEngine', () => ({
  audioEngine: { duck: vi.fn() },
}));

import { installScoringRouter } from './scoring';
import { bus } from '../events/bus';
import { sfxPlay } from './sfx';
import { audioEngine } from './AudioEngine';

const mockSfxPlay = sfxPlay as ReturnType<typeof vi.fn>;
const mockDuck = audioEngine.duck as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockSfxPlay.mockClear();
  mockDuck.mockClear();
});

describe('installScoringRouter', () => {
  it('returns an unsubscribe function', () => {
    const unsub = installScoringRouter();
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('die-tick beat calls sfxPlay chipTick with freq', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', {
      beat: { kind: 'die-tick', t: 0, dieIdx: 1, face: 3, chipDelta: 3, runningTotal: 3, pitchSemis: 2 },
    });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('chipTick', expect.objectContaining({ freq: expect.any(Number) }));
  });

  it('combo-bonus beat calls sfxPlay comboChime', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', {
      beat: { kind: 'combo-bonus', t: 0, comboLabel: 'Pair', chipDelta: 10, runningTotal: 13 },
    });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('comboChime');
  });

  it('cast-swell beat calls sfxPlay castSwell', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', { beat: { kind: 'cast-swell', t: 0 } });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('castSwell');
  });

  it('mult-slam beat calls sfxPlay multSlam with freq and gain', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', {
      beat: { kind: 'mult-slam', t: 0, label: '×2', multiplier: 2, pitchSemis: 5, ampScale: 1.2 },
    });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('multSlam', expect.objectContaining({ freq: expect.any(Number), gain: 1.2 }));
  });

  it('cross-target beat calls sfxPlay targetCross', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', { beat: { kind: 'cross-target', t: 0, runningTotal: 300, target: 250 } });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('targetCross');
  });

  it('boom beat (crossed target) calls sfxPlay castBoom with gain 1.2', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', { beat: { kind: 'boom', t: 0, finalTotal: 400, crossedTarget: true } });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('castBoom', { gain: 1.2 });
  });

  it('boom beat (missed target) calls sfxPlay castBoom with gain 0.85', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', { beat: { kind: 'boom', t: 0, finalTotal: 50, crossedTarget: false } });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('castBoom', { gain: 0.85 });
  });

  it('bail beat calls sfxPlay notEnough', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', { beat: { kind: 'bail', t: 0, runningTotal: 50, target: 300 } });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('notEnough');
  });

  it('bail beat ducks the music to silence', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', { beat: { kind: 'bail', t: 0, runningTotal: 50, target: 300 } });
    unsub();
    expect(mockDuck).toHaveBeenCalledWith(expect.objectContaining({ depth: 0 }));
  });

  it('hold-breath beat plays sustained bell tone (Wave T+1 bespoke theater Move 5)', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', { beat: { kind: 'hold-breath', t: 0, durMs: 400 } });
    unsub();
    // Bell tone holds through the deep-freeze window so audio + visual
    // freeze duration coincide. Non-crossed defaults to 440Hz / 0.4 gain.
    expect(mockSfxPlay).toHaveBeenCalledWith('comboChime', { freq: 440, gain: 0.4 });
  });

  it('hold-breath beat ducks the music to ~30% over the breath duration', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', { beat: { kind: 'hold-breath', t: 0, durMs: 400 } });
    unsub();
    expect(mockDuck).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 0.30, attackMs: 340 }),
    );
  });

  it('unsubscribing stops routing', () => {
    const unsub = installScoringRouter();
    unsub();
    mockSfxPlay.mockClear();
    bus.emit('onScoreBeat', { beat: { kind: 'cast-swell', t: 0 } });
    expect(mockSfxPlay).not.toHaveBeenCalled();
  });

  it('chipTick freq is calculated from pitchSemis (440 * 2^(semis/12))', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', {
      beat: { kind: 'die-tick', t: 0, dieIdx: 0, face: 1, chipDelta: 1, runningTotal: 1, pitchSemis: 12 },
    });
    unsub();
    const call = mockSfxPlay.mock.calls[0];
    expect(call![0]).toBe('chipTick');
    const opts = call![1] as { freq: number };
    // pitchSemis=12 → freq = 440 * 2^(12/12) = 440 * 2 = 880
    expect(opts.freq).toBeCloseTo(880, 0);
  });

  // 2026-05-22 — scheduled-SFX leak fix coverage. Use fake timers to drive
  // setTimeout deterministically. Verifies that scheduled chord/arrival
  // cues are CANCELLED when the round ends (blind clear, run end, bail)
  // or when a new sequence starts (cast-swell), instead of continuing to
  // play into a screen the player has already transitioned away from.
  describe('scheduled-SFX leak (round-end cancellation)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('onBlindCleared cancels pending cross-target chord stack', () => {
      const unsub = installScoringRouter();
      // cross-target schedules two follow-up comboChimes at +60ms and +120ms
      bus.emit('onScoreBeat', { beat: { kind: 'cross-target', t: 0, runningTotal: 300, target: 250 } });
      // Immediate cues already fired (targetCross + first comboChime).
      const immediateCallCount = mockSfxPlay.mock.calls.length;
      // Blind cleared → flush queued.
      bus.emit('onBlindCleared', { blindId: 'lesser_trial', ante: 1, reward: { base: 5, voucher: 0, hands: 0, interest: 0, overscore: 0, total: 5 } } as never);
      // Advance past the +60ms and +120ms scheduled SFX.
      vi.advanceTimersByTime(200);
      // No new sfx since the blind cleared.
      expect(mockSfxPlay.mock.calls.length).toBe(immediateCallCount);
      unsub();
      vi.useRealTimers();
    });

    it('onRunEnded cancels pending boom chord layer', () => {
      const unsub = installScoringRouter();
      // boom (crossed) schedules three comboChimes at +40, +90, +150ms.
      bus.emit('onScoreBeat', { beat: { kind: 'boom', t: 0, finalTotal: 1000, crossedTarget: true, megaRatio: 2 } });
      const immediateCallCount = mockSfxPlay.mock.calls.length;
      bus.emit('onRunEnded', { score: 1000, won: true, ante: 4, constellation: 'lyra' } as never);
      vi.advanceTimersByTime(200);
      expect(mockSfxPlay.mock.calls.length).toBe(immediateCallCount);
      unsub();
      vi.useRealTimers();
    });

    it('cast-swell cancels prior sequence\'s pending scheduled SFX', () => {
      const unsub = installScoringRouter();
      // Schedule a chord stack from a cross-target beat.
      bus.emit('onScoreBeat', { beat: { kind: 'cross-target', t: 0, runningTotal: 300, target: 250 } });
      const immediateCallCount = mockSfxPlay.mock.calls.length;
      // Next sequence begins — should flush prior queued timeouts.
      bus.emit('onScoreBeat', { beat: { kind: 'cast-swell', t: 0 } });
      const afterSwellCount = mockSfxPlay.mock.calls.length;
      // Advance past +60ms and +120ms — only the cast-swell sfx should
      // have fired between the cross-target and now; no prior queued
      // comboChimes should fire after timer advance.
      vi.advanceTimersByTime(200);
      expect(mockSfxPlay.mock.calls.length).toBe(afterSwellCount);
      // And immediateCallCount + 1 (the cast-swell) == afterSwellCount.
      expect(afterSwellCount).toBe(immediateCallCount + 1);
      unsub();
      vi.useRealTimers();
    });

    it('bail beat flushes pending scheduled SFX so they do not leak into silence', () => {
      const unsub = installScoringRouter();
      // Schedule a boom chord first.
      bus.emit('onScoreBeat', { beat: { kind: 'boom', t: 0, finalTotal: 1000, crossedTarget: true, megaRatio: 1 } });
      const immediateCallCount = mockSfxPlay.mock.calls.length;
      // Bail (bust) — should cancel pending + still fire notEnough.
      bus.emit('onScoreBeat', { beat: { kind: 'bail', t: 0, runningTotal: 50, target: 300 } });
      const afterBailCount = mockSfxPlay.mock.calls.length;
      // notEnough should have just fired.
      expect(afterBailCount).toBe(immediateCallCount + 1);
      vi.advanceTimersByTime(200);
      // No queued comboChimes ghost in.
      expect(mockSfxPlay.mock.calls.length).toBe(afterBailCount);
      unsub();
      vi.useRealTimers();
    });

    it('unsubscribe flushes pending scheduled SFX', () => {
      const unsub = installScoringRouter();
      bus.emit('onScoreBeat', { beat: { kind: 'cross-target', t: 0, runningTotal: 300, target: 250 } });
      const beforeUnsubCount = mockSfxPlay.mock.calls.length;
      unsub();
      vi.advanceTimersByTime(200);
      expect(mockSfxPlay.mock.calls.length).toBe(beforeUnsubCount);
      vi.useRealTimers();
    });
  });
});
