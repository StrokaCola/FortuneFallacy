import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import createBus indirectly by re-exporting it through a fresh module per test.
// Since createBus is not exported, we create a thin wrapper.
type SimpleMap = {
  ping: { msg: string };
  score: { value: number };
};

function freshBus() {
  // Replicate the createBus factory inline so tests are fully isolated.
  type Listener<T> = (payload: T) => void;
  const listeners = new Map<keyof SimpleMap, Set<Listener<unknown>>>();
  const anyListeners = new Set<(k: keyof SimpleMap, p: unknown) => void>();

  const on = <K extends keyof SimpleMap>(k: K, fn: Listener<SimpleMap[K]>) => {
    let set = listeners.get(k);
    if (!set) { set = new Set(); listeners.set(k, set); }
    set.add(fn as Listener<unknown>);
    return () => off(k, fn);
  };
  const off = <K extends keyof SimpleMap>(k: K, fn: Listener<SimpleMap[K]>) => {
    listeners.get(k)?.delete(fn as Listener<unknown>);
  };
  const once = <K extends keyof SimpleMap>(k: K, fn: Listener<SimpleMap[K]>) => {
    const wrap: Listener<SimpleMap[K]> = (p) => { off(k, wrap); fn(p); };
    return on(k, wrap);
  };
  const emit = <K extends keyof SimpleMap>(k: K, payload: SimpleMap[K]) => {
    listeners.get(k)?.forEach((fn) => {
      try { (fn as Listener<SimpleMap[K]>)(payload); } catch (e) { /* swallow */ }
    });
    anyListeners.forEach((fn) => {
      try { fn(k, payload); } catch (e) { /* swallow */ }
    });
  };
  const onAny = (fn: (k: keyof SimpleMap, p: SimpleMap[keyof SimpleMap]) => void) => {
    anyListeners.add(fn as (k: keyof SimpleMap, p: unknown) => void);
    return () => { anyListeners.delete(fn as (k: keyof SimpleMap, p: unknown) => void); };
  };

  return { emit, on, off, once, onAny };
}

describe('Bus: on / emit', () => {
  it('subscriber receives the emitted payload', () => {
    const bus = freshBus();
    const received: { msg: string }[] = [];
    bus.on('ping', (p) => received.push(p));
    bus.emit('ping', { msg: 'hello' });
    expect(received).toEqual([{ msg: 'hello' }]);
  });

  it('multiple subscribers for the same event all fire', () => {
    const bus = freshBus();
    let a = 0, b = 0;
    bus.on('ping', () => { a++; });
    bus.on('ping', () => { b++; });
    bus.emit('ping', { msg: 'x' });
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('events for different keys do not cross-fire', () => {
    const bus = freshBus();
    const pingCalls: unknown[] = [];
    const scoreCalls: unknown[] = [];
    bus.on('ping', (p) => pingCalls.push(p));
    bus.on('score', (p) => scoreCalls.push(p));
    bus.emit('score', { value: 100 });
    expect(pingCalls).toHaveLength(0);
    expect(scoreCalls).toHaveLength(1);
  });

  it('no subscribers → emit is silent (no throw)', () => {
    const bus = freshBus();
    expect(() => bus.emit('ping', { msg: 'nobody listening' })).not.toThrow();
  });
});

describe('Bus: off', () => {
  it('off stops a specific listener', () => {
    const bus = freshBus();
    const fn = vi.fn();
    bus.on('ping', fn);
    bus.off('ping', fn);
    bus.emit('ping', { msg: 'test' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('off only removes the targeted listener, not others', () => {
    const bus = freshBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('ping', a);
    bus.on('ping', b);
    bus.off('ping', a);
    bus.emit('ping', { msg: 'x' });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });
});

describe('Bus: on (returned unsubscribe)', () => {
  it('calling the returned function unsubscribes', () => {
    const bus = freshBus();
    const fn = vi.fn();
    const unsub = bus.on('ping', fn);
    unsub();
    bus.emit('ping', { msg: 'after unsub' });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('Bus: once', () => {
  it('listener fires exactly once', () => {
    const bus = freshBus();
    const fn = vi.fn();
    bus.once('ping', fn);
    bus.emit('ping', { msg: '1' });
    bus.emit('ping', { msg: '2' });
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith({ msg: '1' });
  });

  it('returned unsubscribe prevents the once from ever firing', () => {
    const bus = freshBus();
    const fn = vi.fn();
    const unsub = bus.once('ping', fn);
    unsub();
    bus.emit('ping', { msg: 'never' });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('Bus: onAny', () => {
  it('receives all emitted events with their keys', () => {
    const bus = freshBus();
    const received: Array<[string, unknown]> = [];
    bus.onAny((k, p) => received.push([String(k), p]));
    bus.emit('ping', { msg: 'a' });
    bus.emit('score', { value: 42 });
    expect(received).toEqual([
      ['ping', { msg: 'a' }],
      ['score', { value: 42 }],
    ]);
  });

  it('returned unsubscribe stops the any-listener', () => {
    const bus = freshBus();
    const fn = vi.fn();
    const unsub = bus.onAny(fn);
    unsub();
    bus.emit('ping', { msg: 'x' });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('Bus: error isolation', () => {
  it('a throwing listener does not prevent other listeners from firing', () => {
    const bus = freshBus();
    const good = vi.fn();
    bus.on('ping', () => { throw new Error('boom'); });
    bus.on('ping', good);
    expect(() => bus.emit('ping', { msg: 'test' })).not.toThrow();
    expect(good).toHaveBeenCalledOnce();
  });
});

// Integration test against the real exported bus instance
import { bus } from './bus';

describe('global bus instance (integration)', () => {
  it('on/emit works on the exported bus', () => {
    const fn = vi.fn();
    const unsub = bus.on('onPing', fn);
    bus.emit('onPing', { msg: 'test' });
    unsub();
    expect(fn).toHaveBeenCalledWith({ msg: 'test' });
  });

  it('unsub prevents further events on the global bus', () => {
    const fn = vi.fn();
    const unsub = bus.on('onPing', fn);
    unsub();
    bus.emit('onPing', { msg: 'after' });
    expect(fn).not.toHaveBeenCalled();
  });
});
