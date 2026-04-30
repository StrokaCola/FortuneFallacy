// src-next/render/three/modFx/pulse.ts
import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type PulseHandle = {
  dispose: () => void;
};

const PULSE_DURATION_MS = 280;
// Halo size as fraction of die size — slightly larger than the die so the
// pulse reads as a flare around the die rather than on it.
const PULSE_SIZE_FACTOR = 1.4;
const SCALE_START = 1.0;
const SCALE_END = 1.6;
const OPACITY_START = 0.9;

/**
 * Fire a one-shot accent-colored halo pulse at a world position. Auto-disposes
 * after PULSE_DURATION_MS. Returns a handle that can dispose early.
 */
export function firePulse(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): PulseHandle {
  const mat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: accentColor,
    transparent: true,
    opacity: OPACITY_START,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  const baseSize = dieSize * PULSE_SIZE_FACTOR;
  sprite.scale.set(baseSize, baseSize, 1);
  sprite.position.copy(position);
  scene.add(sprite);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;
    const t = Math.min(1, dt / PULSE_DURATION_MS);
    // Ease-out cubic for both scale and fade.
    const eased = 1 - Math.pow(1 - t, 3);
    const scale = baseSize * (SCALE_START + (SCALE_END - SCALE_START) * eased);
    sprite.scale.set(scale, scale, 1);
    mat.opacity = OPACITY_START * (1 - eased);
    if (t >= 1) {
      doDispose();
      return;
    }
    rafHandle = requestAnimationFrame(step);
  }

  function doDispose(): void {
    if (disposed) return;
    disposed = true;
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    scene.remove(sprite);
    mat.dispose();
    // The shared halo texture is module-cached in buildDie.ts; do not dispose.
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
