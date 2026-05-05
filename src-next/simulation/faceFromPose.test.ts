import { describe, it, expect } from 'vitest';
import {
  faceFromQuaternion,
  faceCorrection,
  faceNormal,
  quatMul,
  quatFromTo,
  quatIdentity,
} from './faceFromPose';
import type { DieShape } from '../data/dice';

describe('faceFromQuaternion', () => {
  it('identity quaternion shows face 1 (+Y)', () => {
    expect(faceFromQuaternion({ x: 0, y: 0, z: 0, w: 1 })).toBe(1);
  });

  it('180° rotation around X flips +Y to -Y, showing face 6', () => {
    expect(faceFromQuaternion({ x: 1, y: 0, z: 0, w: 0 })).toBe(6);
  });
});

describe('faceCorrection', () => {
  for (const physFace of [1, 2, 3, 4, 5, 6]) {
    for (const targetFace of [1, 2, 3, 4, 5, 6]) {
      it(`maps physics face ${physFace} → target face ${targetFace}`, () => {
        // Build a physics rest quaternion that shows `physFace`.
        const qPhys = quatFromTo(faceNormal(physFace), { x: 0, y: 1, z: 0 });
        expect(faceFromQuaternion(qPhys)).toBe(physFace);

        // Apply the correction and verify the corrected pose now shows
        // `targetFace`.
        const corr = faceCorrection(qPhys, targetFace);
        const qCorrected = quatMul(qPhys, corr);
        expect(faceFromQuaternion(qCorrected)).toBe(targetFace);
      });
    }
  }

  it('returns identity when target equals physics face', () => {
    const qPhys = quatIdentity();
    const corr = faceCorrection(qPhys, 1);
    expect(corr.x).toBeCloseTo(0);
    expect(corr.y).toBeCloseTo(0);
    expect(corr.z).toBeCloseTo(0);
    expect(corr.w).toBeCloseTo(1);
  });
});

// Per-shape coverage: each polyhedron must round-trip through
// faceFromQuaternion ∘ faceCorrection for every face value.
describe('faceFromQuaternion / faceCorrection — non-cube shapes', () => {
  const SHAPES: { shape: DieShape; faceCount: number }[] = [
    { shape: 'd4',  faceCount: 4 },
    { shape: 'd8',  faceCount: 8 },
    { shape: 'd10', faceCount: 10 },
    { shape: 'd12', faceCount: 12 },
    { shape: 'd20', faceCount: 20 },
  ];

  for (const { shape, faceCount } of SHAPES) {
    it(`${shape}: identity rotation has a definite face up`, () => {
      const f = faceFromQuaternion({ x: 0, y: 0, z: 0, w: 1 }, shape);
      expect(f).toBeGreaterThanOrEqual(1);
      expect(f).toBeLessThanOrEqual(faceCount);
    });

    it(`${shape}: applying faceCorrection lands on the requested face`, () => {
      // Sample quaternion: a non-trivial rest pose.
      const qPhys = quatFromTo({ x: 0.3, y: 0.7, z: 0.5 }, { x: 0, y: 1, z: 0 });
      for (let target = 1; target <= faceCount; target++) {
        const corr = faceCorrection(qPhys, target, shape);
        const qCorrected = quatMul(qPhys, corr);
        expect(faceFromQuaternion(qCorrected, shape)).toBe(target);
      }
    });

    it(`${shape}: face axes are unit length`, () => {
      for (let f = 1; f <= faceCount; f++) {
        const n = faceNormal(f, shape);
        const m = Math.hypot(n.x, n.y, n.z);
        expect(m).toBeCloseTo(1, 6);
      }
    });
  }
});
