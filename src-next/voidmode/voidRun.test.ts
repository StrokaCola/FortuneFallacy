import { describe, it, expect, beforeEach } from 'vitest';
import { dispatch } from '../actions/dispatch';
import { store, resetStore } from '../state/store';

// Each test starts from a fresh store so cross-test state (e.g. a leftover
// void run from the previous suite) doesn't bleed in.
beforeEach(() => {
  resetStore();
});

describe('START_VOID_RUN', () => {
  it('sets run.mode to "void"', () => {
    dispatch({ type: 'START_VOID_RUN', seed: 42, voidSeed: 42, runAlias: 'Echo 17', dailyCertified: false });
    expect(store.getState().run.mode).toBe('void');
  });

  it('stores voidSeed and alias', () => {
    dispatch({ type: 'START_VOID_RUN', seed: 42, voidSeed: 42, runAlias: 'Echo 17', dailyCertified: false });
    expect(store.getState().run.voidSeed).toBe(42);
    expect(store.getState().run.runAlias).toBe('Echo 17');
  });

  it('clears catalystAffixes and consumableAffixes on entry', () => {
    dispatch({ type: 'START_VOID_RUN', seed: 1, voidSeed: 1, runAlias: 'X', dailyCertified: false });
    expect(store.getState().run.catalystAffixes).toEqual({});
    expect(store.getState().run.consumableAffixes).toEqual({});
  });

  it('marks dailyCertified per payload', () => {
    dispatch({ type: 'START_VOID_RUN', seed: 1, voidSeed: 1, runAlias: 'X', dailyCertified: true });
    expect(store.getState().run.dailyCertified).toBe(true);
  });

  it('resets the round slice (fresh score/hands)', () => {
    dispatch({ type: 'START_VOID_RUN', seed: 1, voidSeed: 1, runAlias: 'X', dailyCertified: false });
    expect(store.getState().round.score).toBe(0);
  });
});

describe('END_VOID_RUN', () => {
  it('returns mode to "normal"', () => {
    dispatch({ type: 'START_VOID_RUN', seed: 1, voidSeed: 1, runAlias: 'X', dailyCertified: false });
    dispatch({ type: 'END_VOID_RUN' });
    expect(store.getState().run.mode).toBe('normal');
  });

  it('clears voidSeed, runAlias, dailyCertified', () => {
    dispatch({ type: 'START_VOID_RUN', seed: 99, voidSeed: 99, runAlias: 'Echo 99', dailyCertified: true });
    dispatch({ type: 'END_VOID_RUN' });
    const r = store.getState().run;
    expect(r.voidSeed).toBe(0);
    expect(r.runAlias).toBe('');
    expect(r.dailyCertified).toBe(false);
  });
});
