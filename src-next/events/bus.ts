import type { GameEventMap } from './types';

export type Listener<T> = (payload: T) => void;

export interface Bus<M> {
  emit<K extends keyof M>(k: K, payload: M[K]): void;
  on<K extends keyof M>(k: K, fn: Listener<M[K]>): () => void;
  off<K extends keyof M>(k: K, fn: Listener<M[K]>): void;
  once<K extends keyof M>(k: K, fn: Listener<M[K]>): () => void;
  onAny(fn: (key: keyof M, payload: M[keyof M]) => void): () => void;
}

function createBus<M extends Record<string, unknown>>(): Bus<M> {
  const listeners = new Map<keyof M, Set<Listener<unknown>>>();
  const anyListeners = new Set<(k: keyof M, p: unknown) => void>();

  const on = <K extends keyof M>(k: K, fn: Listener<M[K]>) => {
    let set = listeners.get(k);
    if (!set) {
      set = new Set();
      listeners.set(k, set);
    }
    set.add(fn as Listener<unknown>);
    return () => off(k, fn);
  };

  const off = <K extends keyof M>(k: K, fn: Listener<M[K]>) => {
    listeners.get(k)?.delete(fn as Listener<unknown>);
  };

  const once = <K extends keyof M>(k: K, fn: Listener<M[K]>) => {
    const wrap: Listener<M[K]> = (p) => { off(k, wrap); fn(p); };
    return on(k, wrap);
  };

  const emit = <K extends keyof M>(k: K, payload: M[K]) => {
    listeners.get(k)?.forEach((fn) => {
      try { (fn as Listener<M[K]>)(payload); }
      catch (e) { console.error(`[bus] listener for ${String(k)} threw:`, e); }
    });
    anyListeners.forEach((fn) => {
      try { fn(k, payload); } catch (e) { console.error('[bus] any-listener threw:', e); }
    });
  };

  const onAny = (fn: (k: keyof M, p: M[keyof M]) => void) => {
    anyListeners.add(fn as (k: keyof M, p: unknown) => void);
    return () => { anyListeners.delete(fn as (k: keyof M, p: unknown) => void); };
  };

  return { emit, on, off, once, onAny };
}

export const bus: Bus<GameEventMap> = createBus<GameEventMap>();
