import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCounterTween } from './useCounterTween';

describe('useCounterTween', () => {
  let rafCallbacks: Array<{ cb: FrameRequestCallback; id: number }>;
  let nextId: number;
  let fakeNow: number;
  let perfNowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rafCallbacks = [];
    nextId = 1;
    fakeNow = 0;
    document.documentElement.classList.remove('reduce-motion');
    perfNowSpy = vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextId++;
      rafCallbacks.push({ cb, id });
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks = rafCallbacks.filter((r) => r.id !== id);
    });
  });

  afterEach(() => {
    perfNowSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  function flushFrames(times: number, perFrameMs = 16) {
    for (let i = 0; i < times; i++) {
      fakeNow += perFrameMs;
      const pending = rafCallbacks;
      rafCallbacks = [];
      for (const { cb } of pending) {
        act(() => cb(fakeNow));
      }
    }
  }

  it('returns the initial target on mount with no tween', () => {
    const { result } = renderHook(() => useCounterTween(42, 200));
    expect(result.current).toBe(42);
    expect(rafCallbacks.length).toBe(0);
  });

  it('tweens toward a new target across rAF frames', () => {
    const { result, rerender } = renderHook(({ v }) => useCounterTween(v, 200), {
      initialProps: { v: 0 },
    });
    expect(result.current).toBe(0);

    rerender({ v: 100 });
    // Effect scheduled a rAF; flush several frames toward completion.
    flushFrames(40);
    expect(result.current).toBe(100);
  });

  it('snaps immediately under reduce-motion', () => {
    document.documentElement.classList.add('reduce-motion');
    const { result, rerender } = renderHook(({ v }) => useCounterTween(v, 200), {
      initialProps: { v: 0 },
    });
    rerender({ v: 99 });
    expect(result.current).toBe(99);
    expect(rafCallbacks.length).toBe(0);
  });

  it('does not re-trigger the tween when target stays the same', () => {
    const { rerender } = renderHook(({ v }) => useCounterTween(v, 200), {
      initialProps: { v: 7 },
    });
    rerender({ v: 7 });
    expect(rafCallbacks.length).toBe(0);
  });
});
