type Vec3 = { x: number; y: number; z: number };
type Quat = { x: number; y: number; z: number; w: number };

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

const FACE_AXES: { face: number; axis: Vec3 }[] = [
  { face: 1, axis: { x: 0, y:  1, z: 0 } },
  { face: 6, axis: { x: 0, y: -1, z: 0 } },
  { face: 2, axis: { x: 1, y: 0,  z: 0 } },
  { face: 5, axis: { x: -1, y: 0, z: 0 } },
  { face: 3, axis: { x: 0, y: 0,  z: 1 } },
  { face: 4, axis: { x: 0, y: 0, z: -1 } },
];

export function faceFromQuaternion(q: Quat): number {
  const up = { x: 0, y: 1, z: 0 };
  let bestFace = 1;
  let bestDot = -Infinity;
  for (const { face, axis } of FACE_AXES) {
    const rotated = rotateVec(q, axis);
    const dot = rotated.x * up.x + rotated.y * up.y + rotated.z * up.z;
    if (dot > bestDot) {
      bestDot = dot;
      bestFace = face;
    }
  }
  return bestFace;
}
