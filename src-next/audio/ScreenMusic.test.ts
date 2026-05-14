// Regression test for the music-layering bug. The symptom: after
// rapid screen transitions, multiple loops play simultaneously because
// `next.play()` was called on a Howl that still had an in-flight
// playback from a prior start() that hadn't finished fading down yet.
//
// This test mocks Howler so we can count play() / stop() / unload()
// calls per howl, then asserts that:
//   - Every `next.play()` is preceded by a `next.stop()` from start().
//   - Pending pause-after-fade timeouts are cancelled when the same
//     screen is re-entered, so they don't pause a freshly-started loop.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type HowlSpy = {
  play: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  fade: ReturnType<typeof vi.fn>;
  volume: ReturnType<typeof vi.fn>;
  unload: ReturnType<typeof vi.fn>;
  playing: ReturnType<typeof vi.fn>;
  _isPlaying: boolean;
  src: string[];
};

const howlInstances: HowlSpy[] = [];

vi.mock('howler', () => {
  class Howl {
    public play: ReturnType<typeof vi.fn>;
    public stop: ReturnType<typeof vi.fn>;
    public pause: ReturnType<typeof vi.fn>;
    public fade: ReturnType<typeof vi.fn>;
    public volume: ReturnType<typeof vi.fn>;
    public unload: ReturnType<typeof vi.fn>;
    public playing: ReturnType<typeof vi.fn>;
    public _isPlaying = false;
    public src: string[];
    constructor(opts: { src: string[] }) {
      this.src = opts.src;
      this.play   = vi.fn(() => { this._isPlaying = true; return 1; });
      this.stop   = vi.fn(() => { this._isPlaying = false; return this; });
      this.pause  = vi.fn(() => { this._isPlaying = false; return this; });
      this.fade   = vi.fn(() => this);
      this.volume = vi.fn(() => 0);
      this.unload = vi.fn();
      this.playing = vi.fn(() => this._isPlaying);
      howlInstances.push(this as unknown as HowlSpy);
    }
  }
  return { Howl, Howler: { volume: vi.fn(), ctx: null, masterGain: null } };
});

vi.mock('../audio/audioSettings', () => ({
  subscribe: () => () => {},
  getMaster: () => 1,
  getMusic: () => 1,
  setMusic: () => {},
}));

// Import after mocks register so the module sees the stubs.
import { screenMusic } from './ScreenMusic';

describe('ScreenMusic layering regression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    howlInstances.length = 0;
    screenMusic.reset();
  });
  afterEach(() => {
    vi.useRealTimers();
    screenMusic.reset();
  });

  it('rapid screen transitions never have two howls playing at once', () => {
    // Start hub → shop → hub → forge inside 500ms, faster than the
    // 1500ms crossfade. Before the fix, each .play() on a reused Howl
    // (e.g. coming back to 'hub') stacked a fresh playback on top of
    // one that was still fading down. After: each start() stops the
    // incoming howl before play()ing it, so only one is ever live.
    screenMusic.start('hub');
    vi.advanceTimersByTime(100);
    screenMusic.start('shop');
    vi.advanceTimersByTime(100);
    screenMusic.start('hub');
    vi.advanceTimersByTime(100);
    screenMusic.start('forge');

    // After fast forward beyond the longest pending pause-timeout,
    // only the active howl ('forge') should still be playing.
    vi.advanceTimersByTime(5000);

    const playing = howlInstances.filter((h) => h._isPlaying);
    expect(playing.length, `expected exactly 1 playing howl, got ${playing.length}`).toBe(1);
    // And it should be the forge one.
    const forge = playing[0]!;
    expect(forge.src.some((s) => s.includes('forge-loop'))).toBe(true);
  });

  it('re-entering the same screen during fade-down does not double-play it', () => {
    // hub → shop → hub within 200ms. Before the fix, the second
    // start('hub') called play() on the still-fading-down hub Howl,
    // adding a second playback. The first then paused 1.55s later from
    // the original scheduled timeout, leaving only the second alive
    // but with one extra play call recorded.
    screenMusic.start('hub');
    const hub = howlInstances.find((h) => h.src.some((s) => s.includes('hub-loop')))!;
    expect(hub).toBeDefined();
    expect(hub.play).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    screenMusic.start('shop');
    vi.advanceTimersByTime(100);
    screenMusic.start('hub');

    // The hub howl was stop()ed before the second play() so the
    // count grows in lockstep with stop().
    expect(hub.stop).toHaveBeenCalled();
    expect(hub.play).toHaveBeenCalledTimes(2);
    expect(hub.stop.mock.invocationCallOrder[0]!)
      .toBeLessThan(hub.play.mock.invocationCallOrder[1]!);

    // Run out the scheduled pause-after-fade window — without the
    // pending-pause cancellation, hub's first scheduled pause would
    // fire and pause it mid-fade-up.
    vi.advanceTimersByTime(5000);
    expect(hub._isPlaying).toBe(true);
  });

  it('start() called for the same active screen is a no-op', () => {
    screenMusic.start('hub');
    const hub = howlInstances.find((h) => h.src.some((s) => s.includes('hub-loop')))!;
    expect(hub.play).toHaveBeenCalledTimes(1);
    screenMusic.start('hub');
    screenMusic.start('hub');
    expect(hub.play).toHaveBeenCalledTimes(1);
  });

  it('resume() does not double-play an already-playing howl', () => {
    screenMusic.start('hub');
    const hub = howlInstances.find((h) => h.src.some((s) => s.includes('hub-loop')))!;
    expect(hub.play).toHaveBeenCalledTimes(1);

    // Simulate the visibility handler firing pause then resume while
    // the howl is somehow still in the playing state (the race we hit
    // in dev with rapid tab toggles).
    screenMusic.pause();
    // Force the howl to LOOK like it's still playing even after pause —
    // emulates the timing window where pause's setTimeout hasn't fired.
    hub._isPlaying = true;
    screenMusic.resume();
    // resume() should detect the playing state and NOT call play() again.
    expect(hub.play).toHaveBeenCalledTimes(1);
  });
});
