import { describe, it, expect } from 'vitest';
import { setIn } from './setIn';

describe('setIn', () => {
  it('sets a top-level key', () => {
    const o = { a: 1, b: 2 };
    expect(setIn(o, 'a', 9)).toEqual({ a: 9, b: 2 });
  });

  it('sets a nested key', () => {
    const o = { a: { b: { c: 1 } } };
    expect(setIn(o, 'a.b.c', 9)).toEqual({ a: { b: { c: 9 } } });
  });

  it('sets an array index', () => {
    const o = { xs: [10, 20, 30] };
    expect(setIn(o, 'xs.1', 99)).toEqual({ xs: [10, 99, 30] });
  });

  it('sets a nested key inside an array element', () => {
    const o = { dice: [{ locked: false }, { locked: false }] };
    expect(setIn(o, 'dice.1.locked', true)).toEqual({
      dice: [{ locked: false }, { locked: true }],
    });
  });

  it('throws on missing top-level key', () => {
    expect(() => setIn({ a: 1 }, 'b', 2)).toThrow(/missing/);
  });

  it('throws on missing nested key', () => {
    expect(() => setIn({ a: { b: 1 } }, 'a.c', 9)).toThrow(/missing/);
  });

  it('throws on array index out of bounds', () => {
    expect(() => setIn({ xs: [1, 2] }, 'xs.5', 9)).toThrow(/out of bounds/);
  });

  it('throws on non-integer array index', () => {
    expect(() => setIn({ xs: [1, 2] }, 'xs.foo', 9)).toThrow(/out of bounds/);
  });

  it('throws on empty path', () => {
    expect(() => setIn({ a: 1 }, '', 9)).toThrow(/empty path/);
  });

  it('throws when descending into a non-object', () => {
    expect(() => setIn({ a: 1 }, 'a.b', 9)).toThrow(/non-object/);
  });

  it('does not mutate the original object', () => {
    const o = { a: { b: 1 }, c: [1, 2] };
    const next = setIn(o, 'a.b', 99);
    expect(o).toEqual({ a: { b: 1 }, c: [1, 2] });
    expect(next).not.toBe(o);
    expect(next.a).not.toBe(o.a);
    expect(next.c).toBe(o.c);
  });
});
