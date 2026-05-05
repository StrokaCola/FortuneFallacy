import type { DieShape } from '../data/dice';
import { getFaceCenters } from '../render/three/polyhedra';

export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };

function rotateVec(q: Quat, v: Vec3): Vec3 {
  const { x: qx, y: qy, z: qz, w: qw } = q;
  const { x, y, z } = v;
  const ix =  qw * x + qy * z - qz * y;
  const iy =  qw * y + qz * x - qx * z;
  const iz =  qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

// Per-shape face axes are sourced from `polyhedra.ts` (which is the single
// truth for vertex/face data shared with the renderer). For d6 we keep an
// explicit table so the cube path doesn't depend on the renderer module.
//
// Each axis is the "face up" vector — when face N is rolled, this axis
// points at world +Y after the die settles. For d4 the axes point inward
// (toward the resting face) so the same `largest +Y dot` lookup works.
const FACE_AXES_BY_SHAPE: Record<DieShape, { face: number; axis: Vec3 }[]> = {
  d4:  buildAxes('d4'),
  d6:  [
    { face: 1, axis: { x: 0, y:  1, z: 0 } },
    { face: 6, axis: { x: 0, y: -1, z: 0 } },
    { face: 2, axis: { x: 1, y: 0,  z: 0 } },
    { face: 5, axis: { x: -1, y: 0, z: 0 } },
    { face: 3, axis: { x: 0, y: 0,  z: 1 } },
    { face: 4, axis: { x: 0, y: 0, z: -1 } },
  ],
  d8:  buildAxes('d8'),
  d10: buildAxes('d10'),
  d12: buildAxes('d12'),
  d20: buildAxes('d20'),
};

function buildAxes(shape: DieShape) {
  const centers = getFaceCenters(shape);
  return centers.map((c, i) => ({ face: i + 1, axis: { x: c.x, y: c.y, z: c.z } }));
}

export function faceNormal(face: number, shape: DieShape = 'd6'): Vec3 {
  const list = FACE_AXES_BY_SHAPE[shape];
  for (const { face: f, axis } of list) if (f === face) return axis;
  return list[0]!.axis;
}

export function faceFromQuaternion(q: Quat, shape: DieShape = 'd6'): number {
  const list = FACE_AXES_BY_SHAPE[shape];
  let bestFace = list[0]!.face;
  let bestDot = -Infinity;
  for (const { face, axis } of list) {
    const rotated = rotateVec(q, axis);
    const dot = rotated.y;        // up = (0, 1, 0); only Y component matters
    if (dot > bestDot) {
      bestDot = dot;
      bestFace = face;
    }
  }
  return bestFace;
}

const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

function quatNormalize(q: Quat): Quat {
  const m = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / m, y: q.y / m, z: q.z / m, w: q.w / m };
}

export function quatMul(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

// Shortest-arc rotation that maps unit vector `from` to unit vector `to`.
export function quatFromTo(from: Vec3, to: Vec3): Quat {
  const d = from.x * to.x + from.y * to.y + from.z * to.z;
  if (d > 0.999999) return { ...IDENTITY };
  if (d < -0.999999) {
    // 180° rotation around any axis perpendicular to `from`.
    const ax = Math.abs(from.x) < 0.9
      ? { x: 1, y: 0, z: 0 }
      : { x: 0, y: 1, z: 0 };
    const cx = from.y * ax.z - from.z * ax.y;
    const cy = from.z * ax.x - from.x * ax.z;
    const cz = from.x * ax.y - from.y * ax.x;
    return quatNormalize({ x: cx, y: cy, z: cz, w: 0 });
  }
  const cx = from.y * to.z - from.z * to.y;
  const cy = from.z * to.x - from.x * to.z;
  const cz = from.x * to.y - from.y * to.x;
  const w = 1 + d;
  return quatNormalize({ x: cx, y: cy, z: cz, w });
}

export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  let dot = a.x * bx + a.y * by + a.z * bz + a.w * bw;
  if (dot < 0) {
    bx = -bx; by = -by; bz = -bz; bw = -bw;
    dot = -dot;
  }
  if (dot > 0.9995) {
    return quatNormalize({
      x: a.x + (bx - a.x) * t,
      y: a.y + (by - a.y) * t,
      z: a.z + (bz - a.z) * t,
      w: a.w + (bw - a.w) * t,
    });
  }
  const theta0 = Math.acos(dot);
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
  const s1 = sinTheta / sinTheta0;
  return {
    x: a.x * s0 + bx * s1,
    y: a.y * s0 + by * s1,
    z: a.z * s0 + bz * s1,
    w: a.w * s0 + bw * s1,
  };
}

// Compute a local-frame correction quaternion that, when post-multiplied onto
// the physics rest pose, makes `targetFace` end up on top instead of the face
// the physics happened to land on. The correction maps the target face's
// local normal onto the physics-up face's local normal, so that
// (qPhys * qCorr).rotate(targetNormal) == qPhys.rotate(physNormal) == +Y.
export function faceCorrection(qPhysRest: Quat, targetFace: number, shape: DieShape = 'd6'): Quat {
  const physFace = faceFromQuaternion(qPhysRest, shape);
  if (physFace === targetFace) return { ...IDENTITY };
  return quatFromTo(faceNormal(targetFace, shape), faceNormal(physFace, shape));
}

export function quatIdentity(): Quat {
  return { ...IDENTITY };
}
