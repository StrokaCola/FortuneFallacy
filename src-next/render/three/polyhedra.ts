// Per-shape polyhedron data for non-cube dice (d4/d8/d10/d12/d20).
//
// Each entry exports:
//   - `vertices` flat Float32 (xyz triples) on the unit sphere — used as the
//     point cloud for the rapier convex-hull collider.
//   - `faceVertices` per-face vertex-index lists, in winding order. Used to
//     derive `faceCenters` and to triangulate the BufferGeometry.
//   - `faceCenters` unit-length vectors that point from the centroid toward
//     each face. `faceFromQuaternion(q, shape)` finds the face whose center
//     has the largest +Y component after `q` is applied. Index 0 = face 1.
//
// Convention: for d6/d8/d10/d12/d20, `faceCenters[i]` is the OUTWARD normal
// of face (i+1) — when that face is on TOP of the settled die, the player
// reads its value. For d4, the resting tetrahedron sits on a face and shows
// a vertex on top; players read the value from the BOTTOM (the face touching
// the tray). To keep `faceFromQuaternion` shape-agnostic, d4's `faceCenters`
// store INWARD normals so the same `largest +Y` lookup picks the face whose
// outward normal points DOWN.
//
// Vertex orderings for tetra / octa / dodeca / icosa match Three.js's
// built-in PolyhedronGeometry data so face groupings stay verifiable
// against the upstream source.

import * as THREE from 'three';
import type { DieShape } from '../../data/dice';

const PHI = (1 + Math.sqrt(5)) / 2;        // golden ratio
const INV_PHI = 1 / PHI;

export type PolyData = {
  /** Flat xyz on the unit sphere; size scaling applied at geometry build. */
  vertices: number[];
  /** Each face is a list of vertex indices in CCW winding viewed from outside. */
  faceVertices: number[][];
  /** Unit-length per-face axes used for `faceFromQuaternion`. See header. */
  faceCenters: { x: number; y: number; z: number }[];
};

// Tetrahedron — 4 vertices, 4 triangular faces. Vertex order matches
// three.js TetrahedronGeometry (4 of 8 cube corners).
const TETRA: PolyData = (() => {
  const raw: number[][] = [
    [+1, +1, +1],   // 0
    [-1, -1, +1],   // 1
    [-1, +1, -1],   // 2
    [+1, -1, -1],   // 3
  ];
  const v = normaliseAndFlatten(raw);
  // Each face is opposite to one vertex (the one NOT in the index list).
  // Numbering puts face_i opposite vertex_(i-1).
  const faces = [
    [1, 2, 3],  // face 1 — opposite v0
    [0, 3, 2],  // face 2 — opposite v1
    [0, 1, 3],  // face 3 — opposite v2
    [0, 2, 1],  // face 4 — opposite v3
  ];
  // d4 stores INWARD normals so the resting (bottom) face wins the +Y test.
  const centers = faceCentersFrom(v, faces).map((c) => ({ x: -c.x, y: -c.y, z: -c.z }));
  return { vertices: v, faceVertices: faces, faceCenters: centers };
})();

// Octahedron — 6 vertices on the axes, 8 triangular faces (octants).
// Vertex order matches three.js OctahedronGeometry.
const OCTA: PolyData = (() => {
  const raw: number[][] = [
    [+1,  0,  0],   // 0
    [-1,  0,  0],   // 1
    [ 0, +1,  0],   // 2
    [ 0, -1,  0],   // 3
    [ 0,  0, +1],   // 4
    [ 0,  0, -1],   // 5
  ];
  const v = normaliseAndFlatten(raw);
  // Faces enumerated so face N and N+1 are opposite (1↔2, 3↔4, etc.)
  // Cosmetic — the trad d8 has 1+8=9 opposite pairs, but rapier doesn't care.
  const faces = [
    [0, 2, 4],  // 1: +X +Y +Z
    [1, 3, 5],  // 2: opposite
    [0, 4, 3],  // 3: +X -Y +Z
    [1, 5, 2],  // 4: opposite
    [0, 5, 2],  // 5: +X +Y -Z
    [1, 4, 3],  // 6: opposite
    [0, 3, 5],  // 7: +X -Y -Z
    [1, 2, 4],  // 8: opposite
  ];
  return { vertices: v, faceVertices: faces, faceCenters: faceCentersFrom(v, faces) };
})();

// Pentagonal trapezohedron (d10) — 12 vertices, 10 kite faces.
// Hand-built (no three.js built-in). Top apex + 5 upper belt + 5 lower belt
// (twisted 36°) + bottom apex. Each kite has 4 vertices; triangulated at
// geometry build time.
const D10: PolyData = (() => {
  const beltY = 0.45;
  const beltR = Math.sqrt(1 - beltY * beltY);
  const v: number[] = [];
  v.push(0, +1, 0);                                  // 0  top apex
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    v.push(Math.cos(a) * beltR, +beltY, Math.sin(a) * beltR);
  }                                                  // 1..5 upper belt
  for (let i = 0; i < 5; i++) {
    const a = ((i + 0.5) / 5) * Math.PI * 2;
    v.push(Math.cos(a) * beltR, -beltY, Math.sin(a) * beltR);
  }                                                  // 6..10 lower belt
  v.push(0, -1, 0);                                  // 11 bottom apex
  const upper = (i: number) => 1 + (i % 5);
  const lower = (i: number) => 6 + ((i + 5) % 5);
  const faces: number[][] = [];
  for (let i = 0; i < 5; i++) {
    // Upper-apex kite: top, upper[i], lower[i], upper[i+1].
    faces.push([0, upper(i), lower(i), upper(i + 1)]);
  }
  for (let i = 0; i < 5; i++) {
    // Lower-apex kite: bottom, lower[i+1], upper[i+1], lower[i].
    faces.push([11, lower(i + 1), upper(i + 1), lower(i)]);
  }
  return { vertices: v, faceVertices: faces, faceCenters: faceCentersFrom(v, faces) };
})();

// Dodecahedron — 20 vertices, 12 pentagonal faces.
// Vertex order and face groupings parsed from three.js DodecahedronGeometry's
// hardcoded triangle list (each pentagon = a fan of 3 triangles around vertex
// k0; the 5 unique indices give the pentagon).
const DODECA: PolyData = (() => {
  const r = INV_PHI;
  const t = PHI;
  const raw: number[][] = [
    // (±1, ±1, ±1)
    [-1, -1, -1], [-1, -1, +1], [-1, +1, -1], [-1, +1, +1],   // 0..3
    [+1, -1, -1], [+1, -1, +1], [+1, +1, -1], [+1, +1, +1],   // 4..7
    // (0, ±r, ±t)
    [ 0, -r, -t], [ 0, -r, +t], [ 0, +r, -t], [ 0, +r, +t],   // 8..11
    // (±r, ±t, 0)
    [-r, -t, 0], [-r, +t, 0], [+r, -t, 0], [+r, +t, 0],       // 12..15
    // (±t, 0, ±r)
    [-t, 0, -r], [+t, 0, -r], [-t, 0, +r], [+t, 0, +r],       // 16..19
  ];
  const v = normaliseAndFlatten(raw);
  // 12 pentagons in CCW winding (viewed from outside).
  const faces = [
    [ 3, 11,  7, 15, 13],
    [ 7, 19, 17,  6, 15],
    [17,  4,  8, 10,  6],
    [ 8,  0, 16,  2, 10],
    [ 0, 12,  1, 18, 16],
    [ 6, 10,  2, 13, 15],
    [ 2, 16, 18,  3, 13],
    [18,  1,  9, 11,  3],
    [ 4, 14, 12,  0,  8],
    [11,  9,  5, 19,  7],
    [19,  5, 14,  4, 17],
    [ 1, 12, 14,  5,  9],
  ];
  return { vertices: v, faceVertices: faces, faceCenters: faceCentersFrom(v, faces) };
})();

// Icosahedron — 12 vertices, 20 triangular faces.
// Vertex order and face data from three.js IcosahedronGeometry.
const ICOSA: PolyData = (() => {
  const t = PHI;
  const raw: number[][] = [
    [-1, +t,  0], [+1, +t,  0], [-1, -t,  0], [+1, -t,  0],  // 0..3
    [ 0, -1, +t], [ 0, +1, +t], [ 0, -1, -t], [ 0, +1, -t],  // 4..7
    [+t,  0, -1], [+t,  0, +1], [-t,  0, -1], [-t,  0, +1],  // 8..11
  ];
  const v = normaliseAndFlatten(raw);
  // 20 triangular faces straight from three.js's index list.
  const faces = [
    [ 0, 11,  5], [ 0,  5,  1], [ 0,  1,  7], [ 0,  7, 10], [ 0, 10, 11],
    [ 1,  5,  9], [ 5, 11,  4], [11, 10,  2], [10,  7,  6], [ 7,  1,  8],
    [ 3,  9,  4], [ 3,  4,  2], [ 3,  2,  6], [ 3,  6,  8], [ 3,  8,  9],
    [ 4,  9,  5], [ 2,  4, 11], [ 6,  2, 10], [ 8,  6,  7], [ 9,  8,  1],
  ];
  return { vertices: v, faceVertices: faces, faceCenters: faceCentersFrom(v, faces) };
})();

function normaliseAndFlatten(raw: number[][]): number[] {
  const out: number[] = [];
  for (const [x, y, z] of raw) {
    const m = Math.hypot(x!, y!, z!) || 1;
    out.push(x! / m, y! / m, z! / m);
  }
  return out;
}

function faceCentersFrom(verts: number[], faces: number[][]) {
  return faces.map((face) => {
    let cx = 0, cy = 0, cz = 0;
    for (const idx of face) {
      cx += verts[idx * 3]!;
      cy += verts[idx * 3 + 1]!;
      cz += verts[idx * 3 + 2]!;
    }
    cx /= face.length; cy /= face.length; cz /= face.length;
    const m = Math.hypot(cx, cy, cz) || 1;
    return { x: cx / m, y: cy / m, z: cz / m };
  });
}

export const SHAPE_DATA: Record<Exclude<DieShape, 'd6'>, PolyData> = {
  d4:  TETRA,
  d8:  OCTA,
  d10: D10,
  d12: DODECA,
  d20: ICOSA,
};

/**
 * Build a flat-shaded BufferGeometry for the given shape, scaled to `size`,
 * with per-vertex color in the same tint→deep gradient pattern that
 * `buildDie` uses for the cube body. Faces are fan-triangulated.
 *
 * Returns un-indexed geometry with one vertex per triangle corner so each
 * face has a clean flat normal — no need for manual vertex deduplication
 * and the dice get their faceted look automatically.
 */
export function buildPolyhedronGeometry(
  shape: Exclude<DieShape, 'd6'>,
  size: number,
  bodyTint: number,
  bodyDeep: number,
): { geometry: THREE.BufferGeometry; vertexCloud: Float32Array } {
  const data = SHAPE_DATA[shape];
  const half = size / 2;
  const positions: number[] = [];
  const colors: number[] = [];
  const tint = new THREE.Color(bodyTint);
  const deep = new THREE.Color(bodyDeep);

  for (const face of data.faceVertices) {
    const v0Idx = face[0]!;
    const v0x = data.vertices[v0Idx * 3]! * half;
    const v0y = data.vertices[v0Idx * 3 + 1]! * half;
    const v0z = data.vertices[v0Idx * 3 + 2]! * half;
    for (let t = 1; t < face.length - 1; t++) {
      const v1Idx = face[t]!;
      const v2Idx = face[t + 1]!;
      const v1x = data.vertices[v1Idx * 3]! * half;
      const v1y = data.vertices[v1Idx * 3 + 1]! * half;
      const v1z = data.vertices[v1Idx * 3 + 2]! * half;
      const v2x = data.vertices[v2Idx * 3]! * half;
      const v2y = data.vertices[v2Idx * 3 + 1]! * half;
      const v2z = data.vertices[v2Idx * 3 + 2]! * half;
      positions.push(v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z);
      // Soft inner-glow look: corner vertices fall slightly toward the deep tone.
      for (const [cx, cy, cz] of [[v0x, v0y, v0z], [v1x, v1y, v1z], [v2x, v2y, v2z]]) {
        const radial = Math.hypot(cx!, cy!, cz!) / half;
        const c = tint.clone().lerp(deep, Math.pow(Math.min(1, radial), 1.6) * 0.55);
        colors.push(c.r, c.g, c.b);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();    // flat per-triangle normals

  // Vertex cloud for rapier convexHull — unique points only, scaled to size.
  const cloud = new Float32Array(data.vertices.length);
  for (let i = 0; i < data.vertices.length; i++) cloud[i] = data.vertices[i]! * half;

  return { geometry, vertexCloud: cloud };
}

/** Per-shape outward (or for d4, inward) face axes. Index 0 = face 1. */
export function getFaceCenters(shape: DieShape): { x: number; y: number; z: number }[] {
  if (shape === 'd6') {
    return [
      { x:  0, y: +1, z:  0 },                  // 1
      { x: +1, y:  0, z:  0 },                  // 2
      { x:  0, y:  0, z: +1 },                  // 3
      { x:  0, y:  0, z: -1 },                  // 4
      { x: -1, y:  0, z:  0 },                  // 5
      { x:  0, y: -1, z:  0 },                  // 6
    ];
  }
  return SHAPE_DATA[shape].faceCenters;
}
