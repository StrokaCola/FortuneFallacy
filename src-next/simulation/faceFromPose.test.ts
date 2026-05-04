import { describe, it, expect } from 'vitest';
import {
  faceFromQuaternion,
  faceCorrection,
  faceNormal,
  quatMul,
  quatFromTo,
  quatIdentity,
} from './faceFromPose';

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
