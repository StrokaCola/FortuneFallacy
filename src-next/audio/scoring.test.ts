import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./sfx', () => ({
  sfxPlay: vi.fn(),
}));

import { installScoringRouter } from './scoring';
import { bus } from '../events/bus';
import { sfxPlay } from './sfx';

const mockSfxPlay = sfxPlay as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockSfxPlay.mockClear();
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

  it('hold-breath beat does not call sfxPlay', () => {
    const unsub = installScoringRouter();
    bus.emit('onScoreBeat', { beat: { kind: 'hold-breath', t: 0, durMs: 400 } });
    unsub();
    expect(mockSfxPlay).not.toHaveBeenCalled();
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
});
