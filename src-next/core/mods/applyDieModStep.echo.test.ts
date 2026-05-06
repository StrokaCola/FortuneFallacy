import { describe, it, expect } from 'vitest';
import { applyDieModStep } from './applyDieModStep';

function step(modIds: string[], opts: { face?: number; scoringFaces?: number[] } = {}) {
  return applyDieModStep(
    {
      face: opts.face ?? 6,
      dieIdx: 0,
      pos: 0,
      totalScoring: 1,
      scoringFaces: opts.scoringFaces ?? [opts.face ?? 6],
      titheBudget: 0,
    },
    modIds,
  );
}

describe('Echo mod (copies previous mod)', () => {
  it('copies amplify chip contribution', () => {
    // amplify alone → +2 chips. amplify + echo → +2 (amplify) + +2 (echo) = +4.
    expect(step(['amplify']).dChips).toBe(2);
    expect(step(['amplify', 'echo']).dChips).toBe(4);
  });

  it('copies sharpened mult contribution', () => {
    // sharpened alone → +1 mult. + echo → +1 +1 = +2.
    expect(step(['sharpened']).dMult).toBe(1);
    expect(step(['sharpened', 'echo']).dMult).toBe(2);
  });

  it('no-op when echo is the first slot (nothing to copy)', () => {
    expect(step(['echo']).dChips).toBe(0);
    expect(step(['echo']).dMult).toBe(0);
  });

  it('chained echoes copy the same previous contribution each time', () => {
    // amplify (+2) + echo (+2 copy) + echo (+2 copy of amplify) = +6 chips.
    expect(step(['amplify', 'echo', 'echo']).dChips).toBe(6);
  });

  it('echo skips when prior mod did not fire', () => {
    // snake_eyes only fires on face 1. On face 6, snake_eyes contributes
    // nothing → echo has nothing to copy.
    const r = step(['snake_eyes', 'echo'], { face: 6 });
    expect(r.dChips).toBe(0);
    expect(r.dMult).toBe(0);
  });
});
