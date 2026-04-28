import { describe, it, expect, beforeEach } from 'vitest';
import { listSeeds, saveSeed, deleteSeed } from './seeds';

beforeEach(() => {
  localStorage.clear();
});

describe('seeds', () => {
  it('returns empty list when storage is empty', () => {
    expect(listSeeds()).toEqual([]);
  });

  it('round-trips a saved entry', () => {
    saveSeed({ name: 'a', seed: 42 });
    expect(listSeeds()).toEqual([{ name: 'a', seed: 42 }]);
  });

  it('preserves note field', () => {
    saveSeed({ name: 'a', seed: 1, note: 'crit bug repro' });
    expect(listSeeds()[0].note).toBe('crit bug repro');
  });

  it('overwrites entries with duplicate names', () => {
    saveSeed({ name: 'a', seed: 1 });
    saveSeed({ name: 'a', seed: 2 });
    const all = listSeeds();
    expect(all).toHaveLength(1);
    expect(all[0].seed).toBe(2);
  });

  it('keeps multiple entries with distinct names', () => {
    saveSeed({ name: 'a', seed: 1 });
    saveSeed({ name: 'b', seed: 2 });
    expect(listSeeds()).toHaveLength(2);
  });

  it('deletes an entry by name', () => {
    saveSeed({ name: 'a', seed: 1 });
    saveSeed({ name: 'b', seed: 2 });
    deleteSeed('a');
    const all = listSeeds();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('b');
  });

  it('tolerates malformed JSON in storage', () => {
    localStorage.setItem('dev:seeds', 'not json {');
    expect(listSeeds()).toEqual([]);
  });

  it('tolerates non-array JSON in storage', () => {
    localStorage.setItem('dev:seeds', '{"a":1}');
    expect(listSeeds()).toEqual([]);
  });

  it('filters out entries missing required fields', () => {
    localStorage.setItem('dev:seeds', JSON.stringify([{ name: 'ok', seed: 1 }, { foo: 'bar' }]));
    const all = listSeeds();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('ok');
  });
});
