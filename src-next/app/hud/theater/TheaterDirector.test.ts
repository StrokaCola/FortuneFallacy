import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the audio engine so the director doesn't try to schedule
// real envelopes (and so we can assert the calls).
vi.mock('../../../audio/AudioEngine', () => ({
  audioEngine: {
    crescendoBegin: vi.fn(),
    crescendoEnd: vi.fn(),
  },
}));

// Provide a store stub so TheaterDirector can read round.target.
vi.mock('../../../state/store', () => ({
  store: {
    getState: vi.fn(() => ({ round: { target: 100 } })),
  },
}));

import { bus } from '../../../events/bus';
import { audioEngine } from '../../../audio/AudioEngine';
import { installTheaterDirector } from './TheaterDirector';

const ae = audioEngine as unknown as {
  crescendoBegin: ReturnType<typeof vi.fn>;
  crescendoEnd: ReturnType<typeof vi.fn>;
};

describe('TheaterDirector', () => {
  let off: () => void;
  let phaseEvents: Array<{ phase: string; peakMult?: number }> = [];
  let offBus: () => void;
  beforeEach(() => {
    vi.clearAllMocks();
    phaseEvents = [];
    offBus = bus.on('onTheaterPhase', (payload) => {
      phaseEvents.push(payload);
    });
    off = installTheaterDirector();
  });

  it('emits sustained when running total crosses 50% of target', () => {
    bus.emit('onScoreBeat', { beat: { kind: 'cast-swell', t: 0 } });
    expect(phaseEvents).toContainEqual({ phase: 'ramping' });
    phaseEvents.length = 0;
    // Below threshold — should stay in ramping.
    bus.emit('onScoreBeat', { beat: { kind: 'die-tick', t: 1, dieIdx: 0, face: 5, chipDelta: 5, runningTotal: 40, pitchSemis: 0 } });
    expect(phaseEvents).toHaveLength(0);
    // Crossing 50% (50/100) — promote to sustained.
    bus.emit('onScoreBeat', { beat: { kind: 'die-tick', t: 2, dieIdx: 1, face: 5, chipDelta: 10, runningTotal: 50, pitchSemis: 1 } });
    expect(phaseEvents).toContainEqual(expect.objectContaining({ phase: 'sustained' }));
    expect(ae.crescendoBegin).toHaveBeenCalled();
    off();
    offBus();
  });

  it('releases on boom and clears the crescendo', () => {
    bus.emit('onScoreBeat', { beat: { kind: 'cast-swell', t: 0 } });
    bus.emit('onScoreBeat', { beat: { kind: 'die-tick', t: 1, dieIdx: 0, face: 5, chipDelta: 60, runningTotal: 60, pitchSemis: 0 } });
    phaseEvents.length = 0;
    bus.emit('onScoreBeat', { beat: { kind: 'boom', t: 2, finalTotal: 200, crossedTarget: true } });
    expect(phaseEvents).toContainEqual(expect.objectContaining({ phase: 'release' }));
    expect(ae.crescendoEnd).toHaveBeenCalled();
    off();
    offBus();
  });

  it('routes bail to release as well', () => {
    bus.emit('onScoreBeat', { beat: { kind: 'cast-swell', t: 0 } });
    phaseEvents.length = 0;
    bus.emit('onScoreBeat', { beat: { kind: 'bail', t: 1, runningTotal: 30, target: 100 } });
    expect(phaseEvents).toContainEqual(expect.objectContaining({ phase: 'release' }));
    expect(ae.crescendoEnd).toHaveBeenCalled();
    off();
    offBus();
  });

  it('emits held-breath on the hold-breath beat', () => {
    bus.emit('onScoreBeat', { beat: { kind: 'cast-swell', t: 0 } });
    phaseEvents.length = 0;
    bus.emit('onScoreBeat', { beat: { kind: 'hold-breath', t: 1, durMs: 300 } });
    expect(phaseEvents).toContainEqual(expect.objectContaining({ phase: 'held-breath' }));
    off();
    offBus();
  });

  it('tracks peakMult across mult-slam beats', () => {
    bus.emit('onScoreBeat', { beat: { kind: 'cast-swell', t: 0 } });
    bus.emit('onScoreBeat', { beat: { kind: 'mult-slam', t: 1, label: 'a', multiplier: 3, pitchSemis: 12, ampScale: 1 } });
    bus.emit('onScoreBeat', { beat: { kind: 'mult-slam', t: 2, label: 'b', multiplier: 7, pitchSemis: 14, ampScale: 1.2 } });
    // Force sustained via cross-target (mult-slam doesn't promote on its own).
    bus.emit('onScoreBeat', { beat: { kind: 'cross-target', t: 3, runningTotal: 200, target: 100 } });
    const sustained = phaseEvents.find((p) => p.phase === 'sustained');
    expect(sustained).toBeDefined();
    expect(sustained?.peakMult).toBeGreaterThanOrEqual(7);
    off();
    offBus();
  });
});
