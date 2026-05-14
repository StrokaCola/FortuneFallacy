// src-next/render/three/modFx/awaken.ts — Dormant's fire animation.
// A slow purple swirl resolves into a bright wide flash — reads as
// the latent mod finally activating after 10 stacks. Longest, slowest
// FX in the set (720ms) because it's a once-per-run moment that earns
// the screen time.
//
// Stage timings:
//   0-480ms : swirling ring (3 sprites orbit, low opacity, slowly building)
//   400-720ms: bright flash + scale-out (the awakening)

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type AwakenHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 720;
const SWIRL_DURATION_MS = 480;
const SWIRL_COUNT = 3;

export function fireAwaken(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): AwakenHandle {
  const sats: THREE.Sprite[] = [];
  const satMats: THREE.SpriteMaterial[] = [];
  for (let i = 0; i < SWIRL_COUNT; i++) {
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
    const s = dieSize * 0.22;
    sprite.scale.set(s, s, 1);
    scene.add(sprite);
    sats.push(sprite);
    satMats.push(mat);
  }

  const flashMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: '#fff7e0',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const flash = new THREE.Sprite(flashMat);
  flash.position.copy(position);
  scene.add(flash);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Swirl phase: 3 satellites orbit slowly inward, opacity rises.
    if (dt < SWIRL_DURATION_MS) {
      const t = dt / SWIRL_DURATION_MS;
      // 1.2 orbits total over the swirl phase.
      const rotation = t * Math.PI * 2 * 1.2;
      for (let i = 0; i < sats.length; i++) {
        const sprite = sats[i]!;
        const mat = satMats[i]!;
        const baseAngle = (i / SWIRL_COUNT) * Math.PI * 2;
        const angle = baseAngle + rotation;
        // Radius spirals inward 1.1 → 0.4.
        const radius = (1.1 - 0.7 * t) * dieSize;
        sprite.position.set(
          position.x + Math.cos(angle) * radius,
          position.y + 0.01,
          position.z + Math.sin(angle) * radius,
        );
        mat.opacity = 0.7 * t;
      }
    } else {
      // Satellites disappear into the flash.
      const fadeOut = Math.min(1, (dt - SWIRL_DURATION_MS) / 100);
      for (const mat of satMats) mat.opacity = 0.7 * (1 - fadeOut);
    }

    // Flash phase: starts at 400ms, expands and bright-fades by 720ms.
    if (dt >= 400 && dt < TOTAL_DURATION_MS) {
      const t = (dt - 400) / (TOTAL_DURATION_MS - 400);
      const eased = 1 - Math.pow(1 - t, 2);
      const s = dieSize * (0.6 + eased * 2.0);
      flash.scale.set(s, s, 1);
      // Sharp ramp-up, slow fade.
      flashMat.opacity = t < 0.2 ? (t / 0.2) : (1 - (t - 0.2) / 0.8);
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
    for (const s of sats) scene.remove(s);
    for (const m of satMats) m.dispose();
    scene.remove(flash);
    flashMat.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
