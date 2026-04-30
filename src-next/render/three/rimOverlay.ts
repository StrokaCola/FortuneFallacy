// src-next/render/three/rimOverlay.ts
import * as THREE from 'three';

export type RimOverlayOpts = {
  accentColor: string;     // hex string, e.g. '#7be3ff'
  dieSize: number;         // world-space size of the parent die
};

export type RimOverlay = {
  group: THREE.Group;
  dispose: () => void;
};

// Hair-line outset to avoid z-fighting against the die body.
const RIM_OUTSET = 0.012;
// Tube thickness as fraction of die size.
const RIM_TUBE_FACTOR = 0.022;

export function buildRimOverlay(opts: RimOverlayOpts): RimOverlay {
  const { accentColor, dieSize } = opts;
  const group = new THREE.Group();
  group.name = 'RimOverlay';

  const major = dieSize / 2 + RIM_OUTSET;
  const tube = dieSize * RIM_TUBE_FACTOR;
  const geom = new THREE.TorusGeometry(major, tube, 12, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.2,
    metalness: 0.0,
    roughness: 0.45,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  // Lay the torus flat on the die's equator (XZ plane). TorusGeometry's
  // default plane is XY — rotate so the band wraps around the Y axis.
  mesh.rotation.x = Math.PI / 2;
  mesh.name = 'RimBand';
  group.add(mesh);

  function dispose(): void {
    geom.dispose();
    mat.dispose();
  }

  return { group, dispose };
}
