// src-next/render/three/Dice3D.test.ts
//
// Regression coverage for the binary-dice display bug: switching from a
// constellation with canonical d6 faces (Lyra [1..6]) to one with custom
// d6 faces (Eclipse [0,0,0,1,1,1]) used to leave the existing dice meshes
// untouched because the only rebuild trigger keyed off shape changes. The
// fix added `facesEqual` so `syncDiceSpecs` rebuilds when the face array
// differs even if the shape is identical.

import { describe, it, expect } from 'vitest';
import { facesEqual } from './Dice3D';

describe('facesEqual', () => {
  it('treats identical references as equal', () => {
    const faces = [1, 2, 3, 4, 5, 6];
    expect(facesEqual(faces, faces)).toBe(true);
  });

  it('treats two undefined inputs as equal', () => {
    expect(facesEqual(undefined, undefined)).toBe(true);
  });

  it('treats one undefined side as not equal', () => {
    expect(facesEqual(undefined, [1, 2, 3, 4, 5, 6])).toBe(false);
    expect(facesEqual([1, 2, 3, 4, 5, 6], undefined)).toBe(false);
  });

  it('compares element-by-element for canonical d6 faces', () => {
    expect(facesEqual([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6])).toBe(true);
  });

  it('detects Lyra [1..6] vs Eclipse [0,0,0,1,1,1] as different', () => {
    // The exact case the renderer must catch — same length, same shape, but
    // different values, so the digit-texture path must be re-routed.
    expect(facesEqual([1, 2, 3, 4, 5, 6], [0, 0, 0, 1, 1, 1])).toBe(false);
  });

  it('detects a mid-array divergence', () => {
    expect(facesEqual([1, 1, 2, 3, 5, 8], [1, 1, 2, 3, 5, 9])).toBe(false);
  });

  it('compares the WILD/BLANK string sentinels by value', () => {
    expect(facesEqual([1, 2, 3, 4, 5, 'WILD'], [1, 2, 3, 4, 5, 'WILD'])).toBe(true);
    expect(facesEqual([1, 2, 3, 4, 5, 'WILD'], [1, 2, 3, 4, 5, 'BLANK'])).toBe(false);
  });

  it('treats different lengths as not equal', () => {
    expect(facesEqual([1, 2, 3], [1, 2, 3, 4, 5, 6])).toBe(false);
  });
});
