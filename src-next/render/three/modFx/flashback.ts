// src-next/render/three/modFx/flashback.ts — Echo's fire animation. A
// double-pulse — the same halo fires twice, the second one delayed
// and slightly larger and at lower opacity, reading as a "memory" of
// the first. Tells the player Echo repeated the prior mod's effect.
//
// Stage timings:
//   0-220ms : primary pulse (scale 1.0 → 1.6, opacity 0.9 → 0)
//   120-440ms: ghost pulse (delayed by 120ms, scale 1.1 → 1.9, opacity 0.5 → 0)

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type FlashbackHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 440;
const PRIMARY_DURATION_MS = 220;
const GHOST_DELAY_MS = 120;
const GHOST_DURATION_MS = 320;

export function fireFlashback(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): FlashbackHandle {
  function makePulse(color: string, startOpacity: number) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color,
      transparent: true,
      opacity: startOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(dieSize * 1.4, dieSize * 1.4, 1);
    scene.add(sprite);
    return { sprite, mat };
  }

  const primary = makePulse(accentColor, 0);
  const ghost = makePulse('#fff7e0', 0);
  ghost.sprite.position.copy(position);
  // Ghost begins slightly larger so the two pulses don't visually merge.
  ghost.sprite.scale.set(dieSize * 1.55, dieSize * 1.55, 1);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Primary pulse: ease-out cubic, 1.0 → 1.6 scale, 0.9 → 0 opacity.
    if (dt < PRIMARY_DURATION_MS) {
      const t = dt / PRIMARY_DURATION_MS;
      const eased = 1 - Math.pow(1 - t, 3);
      const s = dieSize * (1.4 + 0.4 * eased);
      primary.sprite.scale.set(s, s, 1);
      primary.mat.opacity = 0.9 * (1 - eased);
    } else {
      primary.mat.opacity = 0;
    }

    // Ghost pulse: starts 120ms in, 320ms duration, slightly larger.
    if (dt >= GHOST_DELAY_MS && dt < GHOST_DELAY_MS + GHOST_DURATION_MS) {
      const t = (dt - GHOST_DELAY_MS) / GHOST_DURATION_MS;
      const eased = 1 - Math.pow(1 - t, 2);
      const s = dieSize * (1.55 + 0.55 * eased);
      ghost.sprite.scale.set(s, s, 1);
      // Bell-shaped opacity (peak at 30%).
      ghost.mat.opacity = t < 0.3
        ? (t / 0.3) * 0.5
        : 0.5 * (1 - (t - 0.3) / 0.7);
    } else if (dt >= GHOST_DELAY_MS) {
      ghost.mat.opacity = 0;
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
    scene.remove(primary.sprite);
    primary.mat.dispose();
    scene.remove(ghost.sprite);
    ghost.mat.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
