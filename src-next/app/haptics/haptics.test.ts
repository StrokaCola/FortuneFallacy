import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getHapticsPref, setHapticsPref, isHapticsActive, playHaptic, subscribeHapticsPref, __test__ } from './haptics';

describe('haptics module', () => {
  let vibrate: ReturnType<typeof vi.fn>;
  let originalVibrate: unknown;
  let mq: { matches: boolean };

  beforeEach(() => {
    __test__.reset();
    vibrate = vi.fn();
    originalVibrate = (navigator as unknown as { vibrate?: unknown }).vibrate;
    (navigator as unknown as { vibrate?: unknown }).vibrate = vibrate;
    mq = { matches: false };
    // Stub matchMedia so reducedMotion() is deterministic.
    (window as unknown as { matchMedia?: unknown }).matchMedia = vi.fn(() => mq);
  });

  afterEach(() => {
    (navigator as unknown as { vibrate?: unknown }).vibrate = originalVibrate;
  });

  describe('preference persistence', () => {
    it("defaults to 'os'", () => {
      expect(getHapticsPref()).toBe('os');
    });

    it("round-trips 'on' through localStorage", () => {
      setHapticsPref('on');
      expect(getHapticsPref()).toBe('on');
    });

    it("clears localStorage when set back to 'os'", () => {
      setHapticsPref('on');
      setHapticsPref('os');
      expect(getHapticsPref()).toBe('os');
      expect(localStorage.getItem('ff_haptics_pref')).toBeNull();
    });

    it('notifies subscribers on change', () => {
      const listener = vi.fn();
      const unsub = subscribeHapticsPref(listener);
      setHapticsPref('on');
      expect(listener).toHaveBeenCalledTimes(1);
      setHapticsPref('off');
      expect(listener).toHaveBeenCalledTimes(2);
      unsub();
      setHapticsPref('on');
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('isHapticsActive', () => {
    it('false when navigator.vibrate is unsupported', () => {
      (navigator as unknown as { vibrate?: unknown }).vibrate = undefined;
      expect(isHapticsActive()).toBe(false);
    });

    it("true when pref is 'on' regardless of reduced motion", () => {
      setHapticsPref('on');
      mq.matches = true;
      expect(isHapticsActive()).toBe(true);
    });

    it("false when pref is 'off' even with vibrate support", () => {
      setHapticsPref('off');
      expect(isHapticsActive()).toBe(false);
    });

    it("'os' honours reduced-motion preference", () => {
      setHapticsPref('os');
      mq.matches = false;
      expect(isHapticsActive()).toBe(true);
      mq.matches = true;
      expect(isHapticsActive()).toBe(false);
    });
  });

  describe('playHaptic', () => {
    it('calls vibrate with the tap pattern', () => {
      setHapticsPref('on');
      playHaptic('tap');
      expect(vibrate).toHaveBeenCalledWith(__test__.PATTERNS.tap);
    });

    it('calls vibrate with the clear pattern array', () => {
      setHapticsPref('on');
      playHaptic('clear');
      expect(vibrate).toHaveBeenCalledWith(__test__.PATTERNS.clear);
      expect(Array.isArray(__test__.PATTERNS.clear)).toBe(true);
    });

    it('no-ops when haptics are off', () => {
      setHapticsPref('off');
      playHaptic('tap');
      expect(vibrate).not.toHaveBeenCalled();
    });

    it('swallows vibrate exceptions (Safari iOS rejects without gesture)', () => {
      setHapticsPref('on');
      vibrate.mockImplementation(() => { throw new Error('NotAllowedError'); });
      expect(() => playHaptic('tap')).not.toThrow();
    });

    it('all named patterns produce a valid vibrate argument', () => {
      setHapticsPref('on');
      for (const name of ['tap', 'tick', 'clear'] as const) {
        vibrate.mockClear();
        playHaptic(name);
        expect(vibrate).toHaveBeenCalledTimes(1);
        const arg = vibrate.mock.calls[0]?.[0];
        // Either a positive number or an array of positive numbers.
        if (typeof arg === 'number') {
          expect(arg).toBeGreaterThan(0);
        } else {
          expect(Array.isArray(arg)).toBe(true);
          for (const n of arg as number[]) expect(n).toBeGreaterThan(0);
        }
      }
    });
  });
});
