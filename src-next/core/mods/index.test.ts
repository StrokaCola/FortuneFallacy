import { describe, it, expect } from 'vitest';
import { applyFaceRemaps } from './index';

describe('applyFaceRemaps', () => {
  it('passes faces through when no mods are attached', () => {
    expect(applyFaceRemaps([1, 2, 3], [[], [], []])).toEqual([1, 2, 3]);
  });

  it('loaded mod remaps 1 to 6 by default', () => {
    expect(applyFaceRemaps([1, 1, 5], [['loaded'], [], []])).toEqual([6, 1, 5]);
  });

  it('lockOnes=true blocks loaded 1->6 remap', () => {
    expect(applyFaceRemaps([1, 1, 5], [['loaded'], ['loaded'], []], true)).toEqual([1, 1, 5]);
  });

  it('lockOnes=true does not affect non-1 dice', () => {
    expect(applyFaceRemaps([1, 4, 5], [['loaded'], [], []], true)).toEqual([1, 4, 5]);
  });

  it('backstop raises sub-min faces independently of lockOnes', () => {
    expect(applyFaceRemaps([1, 3, 5], [['backstop'], ['backstop'], []])).toEqual([4, 4, 5]);
    expect(applyFaceRemaps([1, 3, 5], [['backstop'], ['backstop'], []], true)).toEqual([4, 4, 5]);
  });
});
