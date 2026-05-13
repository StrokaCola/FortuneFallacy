import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPerfMode,
  setPerfMode,
  isPerfDegraded,
  subscribePerfMode,
  _resetPerfMode,
} from './perfMode';

describe('perfMode preference', () => {
  beforeEach(() => {
    _resetPerfMode();
  });

  it("defaults to 'auto'", () => {
    expect(getPerfMode()).toBe('auto');
  });

  it('persists a set preference', () => {
    setPerfMode('on');
    expect(getPerfMode()).toBe('on');
    setPerfMode('off');
    expect(getPerfMode()).toBe('off');
  });

  it("falls back to 'auto' for unknown stored values", () => {
    try { localStorage.setItem('ff_next_perfMode', 'bogus'); } catch { /* ignore */ }
    expect(getPerfMode()).toBe('auto');
  });

  it("'on' force-degrades regardless of device", () => {
    setPerfMode('on');
    expect(isPerfDegraded()).toBe(true);
  });

  it("'off' is never degraded regardless of device", () => {
    setPerfMode('off');
    expect(isPerfDegraded()).toBe(false);
  });

  it('notifies subscribers on change', () => {
    let count = 0;
    const unsub = subscribePerfMode(() => { count += 1; });
    setPerfMode('on');
    setPerfMode('off');
    setPerfMode('auto');
    unsub();
    expect(count).toBe(3);
  });
});
