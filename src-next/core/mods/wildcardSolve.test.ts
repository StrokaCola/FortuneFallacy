import { describe, it, expect } from 'vitest';
import { resolveWildcards } from './wildcardSolve';

describe('resolveWildcards', () => {
  it('returns input unchanged when no wildcard mods present', () => {
    const out = resolveWildcards([1, 2, 3, 4, 5], [[], [], [], [], []], [0, 1, 2, 3, 4]);
    expect(out.faces).toEqual([1, 2, 3, 4, 5]);
    expect(out.events).toEqual([]);
  });

  it('upgrades 4-of-a-kind to 5-of-a-kind via 1 wildcard', () => {
    // Faces: [4, 5, 5, 5, 5]. Wildcard at index 0 → should become 5.
    const out = resolveWildcards(
      [4, 5, 5, 5, 5],
      [['wildcard'], [], [], [], []],
      [0, 1, 2, 3, 4],
    );
    expect(out.faces[0]).toBe(5);
  });

  it('does NOT transform a face=1 die under Pluto debuff (lockOnes=true)', () => {
    const out = resolveWildcards(
      [1, 2, 3, 4, 5],
      [['wildcard'], [], [], [], []],
      [0, 1, 2, 3, 4],
      true,
    );
    expect(out.faces[0]).toBe(1);
  });

  it('only considers dice in the scoring set', () => {
    // Wildcard at idx 0 BUT idx 0 is not in scoringOrder → ignored.
    const out = resolveWildcards(
      [3, 5, 5, 5, 5],
      [['wildcard'], [], [], [], []],
      [1, 2, 3, 4],
    );
    expect(out.faces[0]).toBe(3);
  });

  it('emits onModFired-style event when wildcard transforms', () => {
    const out = resolveWildcards(
      [4, 5, 5, 5, 5],
      [['wildcard'], [], [], [], []],
      [0, 1, 2, 3, 4],
    );
    expect(out.events.length).toBe(1);
    expect(out.events[0]?.dieIdx).toBe(0);
    expect(out.events[0]?.modId).toBe('wildcard');
  });
});
