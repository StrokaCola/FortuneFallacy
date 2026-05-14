// src-next/render/three/rimOverlay.ts
import * as THREE from 'three';

export type RimOverlayOpts = {
  // The legacy single-color path. Either this or `accentColors` must be set.
  accentColor?: string;
  // 2026-05-11 Phase 3.2 — when a die carries multiple mods (3+), the
  // rim band cycles its color across all attached accents over ~6s so
  // the player visually parses the *combination* rather than just the
  // topmost mod. Pass [primary, secondary, tertiary] accents here.
  accentColors?: string[];
  dieSize: number;
};

export type RimOverlay = {
  group: THREE.Group;
  dispose: () => void;
  // Phase 3.2 — when multi-color, the renderer calls tick(timeMs) each
  // frame to advance the cycle. tick is a no-op for single-color rims.
  tick?: (timeMs: number) => void;
};

// Hair-line outset to avoid z-fighting against the die body.
const RIM_OUTSET = 0.012;
// Tube thickness as fraction of die size. At Forge preview scale
// (dieSize ≥ 1.0), the 0.022 factor resolves to ~7px of band on a
// 360px render — readable. At gameplay scale (dieSize < 1.0) the
// same factor lands at ~1-2px, which reads as noise instead of a
// "this die has 3 mods" cue. Double the tube on small dice so the
// rim survives the downscale.
const RIM_TUBE_FACTOR = 0.022;
const RIM_TUBE_FACTOR_SMALL = 0.044;
// Cycle period for the multi-color sweep — slow enough to read as ambient.
const CYCLE_MS = 6000;

export function buildRimOverlay(opts: RimOverlayOpts): RimOverlay {
  const { dieSize } = opts;
  const accents = (opts.accentColors && opts.accentColors.length > 0)
    ? opts.accentColors
    : [opts.accentColor ?? '#7be3ff'];
  const group = new THREE.Group();
  group.name = 'RimOverlay';

  const major = dieSize / 2 + RIM_OUTSET;
  const tube = dieSize * (dieSize < 1.0 ? RIM_TUBE_FACTOR_SMALL : RIM_TUBE_FACTOR);
  const geom = new THREE.TorusGeometry(major, tube, 12, 64);
  const startColor = new THREE.Color(accents[0]!);
  const mat = new THREE.MeshStandardMaterial({
    color: startColor.clone(),
    emissive: startColor.clone(),
    emissiveIntensity: 1.2,
    metalness: 0.0,
    roughness: 0.45,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.name = 'RimBand';
  group.add(mesh);

  // Multi-color tick — lerps between adjacent accents in a loop so a
  // 3-mod stack reads as a slow rainbow of the player's chosen mods.
  const accentObjs = accents.map((c) => new THREE.Color(c));
  function tick(timeMs: number): void {
    if (accentObjs.length < 2) return;
    const phase = (timeMs % CYCLE_MS) / CYCLE_MS;       // 0..1
    const segCount = accentObjs.length;
    const segScaled = phase * segCount;
    const segIdx = Math.floor(segScaled) % segCount;
    const t = segScaled - Math.floor(segScaled);
    const a = accentObjs[segIdx]!;
    const b = accentObjs[(segIdx + 1) % segCount]!;
    mat.color.copy(a).lerp(b, t);
    mat.emissive.copy(mat.color);
  }

  function dispose(): void {
    geom.dispose();
    mat.dispose();
  }

  return { group, dispose, tick: accentObjs.length > 1 ? tick : undefined };
}
