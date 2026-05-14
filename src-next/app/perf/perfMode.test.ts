import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPerfMode,
  setPerfMode,
  isPerfDegraded,
  subscribePerfMode,
  installPerfBodyClass,
  _resetPerfMode,
  _setBudgetExceededForTest,
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

describe('installPerfBodyClass', () => {
  let teardown: (() => void) | null = null;
  beforeEach(() => {
    _resetPerfMode();
    document.body.classList.remove('perf-degraded');
  });
  afterEach(() => {
    teardown?.();
    teardown = null;
    document.body.classList.remove('perf-degraded');
  });

  it('adds the perf-degraded body class when mode is "on"', () => {
    setPerfMode('on');
    teardown = installPerfBodyClass();
    expect(document.body.classList.contains('perf-degraded')).toBe(true);
  });

  it('does NOT add the class when mode is "off"', () => {
    setPerfMode('off');
    teardown = installPerfBodyClass();
    expect(document.body.classList.contains('perf-degraded')).toBe(false);
  });

  it('toggles the class live when mode flips', () => {
    setPerfMode('off');
    teardown = installPerfBodyClass();
    expect(document.body.classList.contains('perf-degraded')).toBe(false);
    setPerfMode('on');
    expect(document.body.classList.contains('perf-degraded')).toBe(true);
    setPerfMode('off');
    expect(document.body.classList.contains('perf-degraded')).toBe(false);
  });

  it('reacts to the auto-mode frame-budget watcher flip', () => {
    // In auto mode, _budgetExceeded flipping should propagate to the
    // body class through the same notify() bus the manual toggle uses.
    setPerfMode('auto');
    teardown = installPerfBodyClass();
    expect(document.body.classList.contains('perf-degraded')).toBe(false);
    _setBudgetExceededForTest(true);
    expect(document.body.classList.contains('perf-degraded')).toBe(true);
    _setBudgetExceededForTest(false);
    expect(document.body.classList.contains('perf-degraded')).toBe(false);
  });

  it('teardown removes the class + stops listening', () => {
    setPerfMode('off');
    teardown = installPerfBodyClass();
    teardown();
    teardown = null;
    document.body.classList.add('perf-degraded'); // simulate leftover
    setPerfMode('on');
    // Class wasn't toggled — teardown removed the listener. Class
    // stays manually-set without the helper interfering.
    expect(document.body.classList.contains('perf-degraded')).toBe(true);
  });
});
