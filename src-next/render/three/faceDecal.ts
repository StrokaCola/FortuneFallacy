// faceDecal.ts — render a constellation+mod decal SVG to a Three.js
// CanvasTexture, suitable for use as an `aoMap` or emissive overlay on
// the die's face material. Phase 2.2 of the 2026-05-11 Forge overhaul.
//
// The renderer is purely CSR (Canvas 2D → CanvasTexture). We don't
// need any actual SVG parsing because each DecalDef's `d` string is a
// simple path-data subset (M / L / Q / A / Z / `m -r 0` circle macro).
// We rasterize via Path2D, which the modern browser canvases support.
//
// Caching: textures are memoized per (constellationId, modId) so the
// die-build path doesn't pay a paint cost on every roll. The cache
// is process-global; cleared if a hot-reload re-imports this module.

import * as THREE from 'three';
import type { DecalDef } from '../../data/constellationDecals';
import { getDecalForMod } from '../../data/constellationDecals';

const TEXTURE_PX = 128; // baked at 128×128 — enough sharpness on a 140px DieView
const cache = new Map<string, THREE.CanvasTexture>();

function buildCanvas(decal: DecalDef, accent: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = TEXTURE_PX;
  const ctx = c.getContext('2d')!;
  // Start with a transparent base — the decal lives over the existing
  // face material; we don't fill the background.
  ctx.clearRect(0, 0, TEXTURE_PX, TEXTURE_PX);
  // Map authored viewBox (default 64×64) → canvas pixels.
  const vb = (decal.viewBox ?? '0 0 64 64').split(/\s+/).map(Number);
  const vbW = vb[2] ?? 64, vbH = vb[3] ?? 64;
  const sx = TEXTURE_PX / vbW, sy = TEXTURE_PX / vbH;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.strokeStyle = accent;
  ctx.lineWidth = (decal.strokeWidth ?? 1.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 2.5; // tiny glow so the decal reads even at low opacity
  // Path2D parses the same `d` string the SVG path would, including
  // M/L/Q/A/Z. We treat the entire d as one path so multiple sub-paths
  // batch into a single stroke call.
  try {
    const path = new Path2D(decal.d);
    ctx.stroke(path);
  } catch (e) {
    // Defensive: a bad d string shouldn't crash the die build. Render
    // nothing (the face just won't show a decal).
    if (typeof console !== 'undefined') {
      console.warn('[faceDecal] path parse failed:', e);
    }
  }
  ctx.restore();
  return c;
}

export function getFaceDecalTexture(
  constellationId: string,
  modId: string,
  accent: string,
): THREE.CanvasTexture | null {
  const decal = getDecalForMod(constellationId, modId);
  if (!decal) return null;
  // Cache key includes the accent so different mods with the same path
  // (e.g., if two etched mods share the default rune) still get color-
  // appropriate textures.
  const key = `${constellationId}|${modId}|${accent}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = buildCanvas(decal, accent);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

// Test/dev hook — clears the cache so a hot-reload doesn't keep stale
// textures around when the decal table is edited.
export function __clearFaceDecalCache(): void {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

// Attach a decal plane to every face of a built d6. The plane sits a
// hair above the face surface (0.005 × size offset) so it doesn't
// z-fight with the body and is rotated to lie flush with the face
// normal. Color = the mod's accent so different etched mods on the
// same constellation read as different runes.
//
// Returns a dispose function the caller folds into the DieView cleanup.
// Polyhedron shapes — d8 / d10 / d12 / d20 — are skipped for v1; the
// decal still attaches to a top-aligned plane so something readable
// shows, but face-aligned placement would require per-shape normals
// from polyhedra.ts. Tracked as a follow-up.
export function attachFaceDecals(
  group: THREE.Group,
  size: number,
  constellationId: string,
  modId: string,
  accent: string,
  shape: string,
): (() => void) | null {
  const tex = getFaceDecalTexture(constellationId, modId, accent);
  if (!tex) return null;
  const planeGeo = new THREE.PlaneGeometry(size * 0.62, size * 0.62);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const half = size / 2;
  const offset = size * 0.005;
  const created: THREE.Mesh[] = [];
  if (shape === 'd6') {
    // Six faces of a cube, axis-aligned. Position the plane just
    // outside the face surface, rotated to face outward.
    const faces: Array<[THREE.Vector3, THREE.Euler]> = [
      [new THREE.Vector3(0,        half+offset,  0       ), new THREE.Euler(-Math.PI / 2, 0, 0)],
      [new THREE.Vector3(0,       -half-offset,  0       ), new THREE.Euler( Math.PI / 2, 0, 0)],
      [new THREE.Vector3( half+offset, 0,        0       ), new THREE.Euler(0,  Math.PI / 2, 0)],
      [new THREE.Vector3(-half-offset, 0,        0       ), new THREE.Euler(0, -Math.PI / 2, 0)],
      [new THREE.Vector3(0,        0,        half+offset), new THREE.Euler(0,  0,           0)],
      [new THREE.Vector3(0,        0,       -half-offset), new THREE.Euler(0,  Math.PI,     0)],
    ];
    for (const [pos, rot] of faces) {
      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.position.copy(pos);
      mesh.rotation.copy(rot);
      mesh.name = `Decal_${modId}`;
      group.add(mesh);
      created.push(mesh);
    }
  } else {
    // Polyhedron stop-gap: place a single decal plane on the +Y face
    // (which is always up-facing after applyFaceRotation). Better
    // than nothing; full per-face placement is a Phase 3 follow-up.
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.position.set(0, half + offset, 0);
    mesh.rotation.set(-Math.PI / 2, 0, 0);
    mesh.name = `Decal_${modId}`;
    group.add(mesh);
    created.push(mesh);
  }
  return () => {
    for (const m of created) {
      group.remove(m);
      m.geometry.dispose();
      // Material is shared across all 6 planes — dispose once at the end.
    }
    (mat as THREE.Material).dispose();
    planeGeo.dispose();
  };
}
