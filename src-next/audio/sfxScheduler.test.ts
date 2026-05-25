import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeSfxScheduler } from './sfxScheduler';

describe('makeSfxScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires a scheduled callback at the requested delay', () => {
    const sched = makeSfxScheduler();
    const cb = vi.fn();
    sched.schedule(cb, 100);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('tracks pending count + decrements on fire', () => {
    const sched = makeSfxScheduler();
    sched.schedule(() => {}, 100);
    sched.schedule(() => {}, 200);
    expect(sched.pendingCount()).toBe(2);
    vi.advanceTimersByTime(150);
    expect(sched.pendingCount()).toBe(1);
    vi.advanceTimersByTime(100);
    expect(sched.pendingCount()).toBe(0);
  });

  it('cancelAll clears all pending timers without firing them', () => {
    const sched = makeSfxScheduler();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();
    sched.schedule(cb1, 100);
    sched.schedule(cb2, 200);
    sched.schedule(cb3, 300);
    expect(sched.pendingCount()).toBe(3);
    sched.cancelAll();
    expect(sched.pendingCount()).toBe(0);
    vi.advanceTimersByTime(500);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
    expect(cb3).not.toHaveBeenCalled();
  });

  it('cancelAll on an empty queue is a no-op', () => {
    const sched = makeSfxScheduler();
    expect(() => sched.cancelAll()).not.toThrow();
    expect(sched.pendingCount()).toBe(0);
  });

  it('scheduling AFTER cancelAll still works (fresh queue)', () => {
    const sched = makeSfxScheduler();
    sched.schedule(() => {}, 100);
    sched.cancelAll();
    const cb = vi.fn();
    sched.schedule(cb, 100);
    vi.advanceTimersByTime(150);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('two schedulers maintain independent queues', () => {
    const a = makeSfxScheduler();
    const b = makeSfxScheduler();
    const cbA = vi.fn();
    const cbB = vi.fn();
    a.schedule(cbA, 100);
    b.schedule(cbB, 100);
    a.cancelAll();
    vi.advanceTimersByTime(200);
    expect(cbA).not.toHaveBeenCalled();
    expect(cbB).toHaveBeenCalledOnce();
  });
});
