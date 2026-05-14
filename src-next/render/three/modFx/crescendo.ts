// src-next/render/three/modFx/crescendo.ts — Crescendo's fire animation.
// Three concentric halos expand outward at staggered start times, each
// slightly larger and dimmer than the last. Reads as a wave swell —
// the chain growing forward through the scoring order.
//
// Stage timings:
//   0-450ms : ring 1 (scale 1.0→1.6, peak opacity 0.85)
//   80-530ms: ring 2 (scale 1.0→1.9, peak opacity 0.65)
//   160-610ms: ring 3 (scale 1.0→2.2, peak opacity 0.45)

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type CrescendoHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 610;
const RING_DURATION_MS = 450;

type Ring = {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  startAt: number;
  endScale: number;
  peakOpacity: number;
};

export function fireCrescendo(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): CrescendoHandle {
  const rings: Ring[] = [];
  const configs: Array<{ startAt: number; endScale: number; peakOpacity: number }> = [
    { startAt:   0, endScale: 1.6, peakOpacity: 0.85 },
    { startAt:  80, endScale: 1.9, peakOpacity: 0.65 },
    { startAt: 160, endScale: 2.2, peakOpacity: 0.45 },
  ];
  for (const cfg of configs) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: accentColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(dieSize, dieSize, 1);
    scene.add(sprite);
    rings.push({ sprite, mat, ...cfg });
  }

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    for (const r of rings) {
      const localDt = dt - r.startAt;
      if (localDt < 0) continue;
      if (localDt < RING_DURATION_MS) {
        const t = localDt / RING_DURATION_MS;
        const eased = 1 - Math.pow(1 - t, 2);
        const s = dieSize * (1.0 + (r.endScale - 1.0) * eased);
        r.sprite.scale.set(s, s, 1);
        // Bell opacity peaking at 25%.
        r.mat.opacity = t < 0.25
          ? (t / 0.25) * r.peakOpacity
          : r.peakOpacity * (1 - (t - 0.25) / 0.75);
      } else {
        r.mat.opacity = 0;
      }
    }

    if (dt >= TOTAL_DURATION_MS) {
      doDispose();
      return;
    }
    rafHandle = requestAnimationFrame(step);
  }

  function doDispose(): void {
    if (disposed) return;
    disposed = true;
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    for (const r of rings) {
      scene.remove(r.sprite);
      r.mat.dispose();
    }
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
