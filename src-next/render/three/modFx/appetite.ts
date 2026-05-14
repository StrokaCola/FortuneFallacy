// src-next/render/three/modFx/appetite.ts — Glutton's fire animation.
// 6 small sprites converge inward from a 1.5× radius toward the die
// centre, then a saturated central pulse expands. The "consumption"
// is sucking inward — opposite of Crown's outward fountain.
//
// Stage timings:
//   0-220ms : satellites converge from radius 1.5 → 0, fading at 70%
//   180-420ms: central pulse expands (scale 0.6 → 1.8, opacity bell)

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type AppetiteHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 420;
const SATELLITE_COUNT = 6;
const CONVERGE_MS = 220;

export function fireAppetite(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): AppetiteHandle {
  const sats: THREE.Sprite[] = [];
  const satMats: THREE.SpriteMaterial[] = [];
  for (let i = 0; i < SATELLITE_COUNT; i++) {
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
    const s = dieSize * 0.18;
    sprite.scale.set(s, s, 1);
    scene.add(sprite);
    sats.push(sprite);
    satMats.push(mat);
  }

  const pulseMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: accentColor,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const pulse = new THREE.Sprite(pulseMat);
  pulse.position.copy(position);
  scene.add(pulse);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Satellites: converge inward, fade out at 70% of converge time.
    for (let i = 0; i < sats.length; i++) {
      const sprite = sats[i]!;
      const mat = satMats[i]!;
      const angle = (i / SATELLITE_COUNT) * Math.PI * 2;
      if (dt < CONVERGE_MS) {
        const t = dt / CONVERGE_MS;
        const eased = 1 - Math.pow(1 - t, 2);
        const radius = (1 - eased) * dieSize * 1.5;
        sprite.position.set(
          position.x + Math.cos(angle) * radius,
          position.y + 0.01,
          position.z + Math.sin(angle) * radius,
        );
        mat.opacity = t < 0.7 ? 0.85 : 0.85 * (1 - (t - 0.7) / 0.3);
      } else {
        mat.opacity = 0;
      }
    }

    // Pulse: starts at 180ms (just before satellites finish converging).
    if (dt >= 180 && dt < TOTAL_DURATION_MS) {
      const t = (dt - 180) / (TOTAL_DURATION_MS - 180);
      const eased = 1 - Math.pow(1 - t, 2);
      const s = dieSize * (0.6 + 1.2 * eased);
      pulse.scale.set(s, s, 1);
      // Bell opacity, peak at 30%.
      pulseMat.opacity = t < 0.3 ? (t / 0.3) * 0.95 : 0.95 * (1 - (t - 0.3) / 0.7);
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
    scene.remove(pulse);
    pulseMat.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
