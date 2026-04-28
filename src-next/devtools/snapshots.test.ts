import { describe, it, expect, beforeEach } from 'vitest';
import { listSnapshots, saveSnapshot, deleteSnapshot, getSnapshot } from './snapshots';
import type { GameState } from '../state/store';

const fakeState: GameState = {
  run: { foo: 1 } as never,
  round: { hands: [1, 2, 3] } as never,
  shop: {} as never,
  meta: {} as never,
  ui: { screen: 'round' } as never,
  pingCount: 0,
};

beforeEach(() => {
  localStorage.clear();
});

describe('snapshots', () => {
  it('returns empty list when storage is empty', () => {
    expect(listSnapshots()).toEqual([]);
  });

  it('round-trips a saved snapshot', () => {
    saveSnapshot('a', fakeState);
    const all = listSnapshots();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('a');
    expect(all[0].state).toEqual(fakeState);
  });

  it('getSnapshot returns deep-equal state', () => {
    saveSnapshot('a', fakeState);
    expect(getSnapshot('a')).toEqual(fakeState);
  });

  it('returns null for missing snapshot', () => {
    expect(getSnapshot('missing')).toBeNull();
  });

  it('overwrites by name', () => {
    saveSnapshot('a', fakeState);
    const next = { ...fakeState, pingCount: 99 };
    saveSnapshot('a', next);
    expect(getSnapshot('a')?.pingCount).toBe(99);
  });

  it('does not share reference with input (clones)', () => {
    saveSnapshot('a', fakeState);
    const restored = getSnapshot('a');
    expect(restored).not.toBe(fakeState);
  });

  it('sorts list by name', () => {
    saveSnapshot('b', fakeState);
    saveSnapshot('a', fakeState);
    saveSnapshot('c', fakeState);
    expect(listSnapshots().map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });

  it('deletes a snapshot by name', () => {
    saveSnapshot('a', fakeState);
    saveSnapshot('b', fakeState);
    deleteSnapshot('a');
    expect(listSnapshots().map((s) => s.name)).toEqual(['b']);
  });

  it('tolerates malformed storage', () => {
    localStorage.setItem('dev:snapshots', 'not json');
    expect(listSnapshots()).toEqual([]);
  });

  it('tolerates non-object storage', () => {
    localStorage.setItem('dev:snapshots', '[1,2,3]');
    expect(listSnapshots()).toEqual([]);
  });
});
