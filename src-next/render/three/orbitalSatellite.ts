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

  // Chip — small emissive sphere in the accent color. Starts at
  // emissiveIntensity 0 + transparent opacity 0 so the entry animation
  // can fade it in; cleaner than a hard pop when a mod attaches.
  const chipGeo = new THREE.SphereGeometry(chipRadius, 16, 12);
  const chipMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0,
    metalness: 0.0,
    roughness: 0.4,
    transparent: true,
    opacity: 0,
    toneMapped: false,
  });
  const chip = new THREE.Mesh(chipGeo, chipMat);
  chip.name = 'Chip';
  group.add(chip);

  // Halo sprite — soft glow behind the chip for visual punch. The
  // entry animation expands it from 2× scale → 1×, so initial scale
  // is 2× and opacity stays elevated during the inflate.
  const haloMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: accentColor,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Sprite(haloMat);
  const haloSize = chipRadius * 5.0;
  halo.scale.set(haloSize * 2, haloSize * 2, 1);
  halo.name = 'Halo';
  group.add(halo);

  // Initialize at angle 0.
  setAngle(0);

  // Entry animation — 400ms RAF-driven fade-in + halo collapse so a
  // freshly-attached mod doesn't pop into existence. Cancels itself on
  // dispose() to avoid stale callbacks rebuilding the disposed mats.
  const ENTRY_MS = 400;
  const t0 = performance.now();
  let entryRaf = 0;
  let entryDisposed = false;
  function tickEntry(): void {
    if (entryDisposed) return;
    const dt = performance.now() - t0;
    const t = Math.min(1, dt / ENTRY_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    chipMat.opacity = eased;
    chipMat.emissiveIntensity = eased * 1.4;
    // Halo: scale 2 → 1, opacity 0 → 0.9 (bell curve so the halo peaks
    // mid-entry at ~0.85 then settles at the steady-state 0.9).
    const haloScale = (2 - eased) * haloSize;
    halo.scale.set(haloScale, haloScale, 1);
    haloMat.opacity = t < 0.5 ? (t / 0.5) * 0.85 : 0.85 + (t - 0.5) * 0.1;
    if (t < 1) entryRaf = requestAnimationFrame(tickEntry);
  }
  entryRaf = requestAnimationFrame(tickEntry);

  function setAngle(radians: number): void {
    const x = orbitRadius * Math.cos(radians);
    const z = orbitRadius * Math.sin(radians);
    chip.position.set(x, 0, z);
    halo.position.set(x, 0, z);
  }

  function dispose(): void {
    entryDisposed = true;
    if (entryRaf) cancelAnimationFrame(entryRaf);
    chipGeo.dispose();
    chipMat.dispose();
    haloMat.dispose();
    // The shared halo texture is module-cached and not disposed here.
  }

  return { group, setAngle, dispose };
}
