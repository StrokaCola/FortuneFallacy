// src-next/render/three/orbitalSatellite.ts
import * as THREE from 'three';
import { getHaloTexture } from './buildDie';

export type OrbitalSatelliteOpts = {
  accentColor: string;          // hex string, e.g. '#7be3ff'
  glyph?: string;               // reserved for future SDF text; ignored in Phase 3
  dieSize: number;              // world-space size of the parent die
  tilt?: number;                // orbital plane tilt in radians; default 15°
};

export type OrbitalSatellite = {
  group: THREE.Group;
  setAngle: (radians: number) => void;
  dispose: () => void;
};

// Orbit radius is ~70% of die-size away from the die center, putting the
// satellite just outside the die's silhouette.
const ORBIT_RADIUS_FACTOR = 0.7;
// Chip diameter is ~12% of the die size per spec.
const CHIP_DIAMETER_FACTOR = 0.12;

export function buildOrbitalSatellite(opts: OrbitalSatelliteOpts): OrbitalSatellite {
  const { accentColor, dieSize, tilt = (15 * Math.PI) / 180 } = opts;
  const group = new THREE.Group();
  group.name = 'OrbitalSatellite';
  // Tilt the orbital plane around the X axis so the satellite arcs above/below
  // the die equator rather than orbiting flat.
  group.rotation.x = tilt;

  const chipRadius = (dieSize * CHIP_DIAMETER_FACTOR) / 2;
  const orbitRadius = dieSize * ORBIT_RADIUS_FACTOR;

  // Chip — small emissive sphere in the accent color.
  const chipGeo = new THREE.SphereGeometry(chipRadius, 16, 12);
  const chipMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.4,
    metalness: 0.0,
    roughness: 0.4,
    toneMapped: false,
  });
  const chip = new THREE.Mesh(chipGeo, chipMat);
  chip.name = 'Chip';
  group.add(chip);

  // Halo sprite — soft glow behind the chip for visual punch.
  const haloMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: accentColor,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Sprite(haloMat);
  const haloSize = chipRadius * 5.0;
  halo.scale.set(haloSize, haloSize, 1);
  halo.name = 'Halo';
  group.add(halo);

  // Initialize at angle 0.
  setAngle(0);

  function setAngle(radians: number): void {
    const x = orbitRadius * Math.cos(radians);
    const z = orbitRadius * Math.sin(radians);
    chip.position.set(x, 0, z);
    halo.position.set(x, 0, z);
  }

  function dispose(): void {
    chipGeo.dispose();
    chipMat.dispose();
    haloMat.dispose();
    // The shared halo texture is module-cached and not disposed here.
  }

  return { group, setAngle, dispose };
}
