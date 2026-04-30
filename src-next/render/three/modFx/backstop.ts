// src-next/render/three/modFx/backstop.ts
import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type BackstopHandle = {
  dispose: () => void;
};

const JADE = '#9bd0a8';
const JADE_BRIGHT = '#d8f0dc';
const TOTAL_DURATION_MS = 650;

export function fireBackstop(
  scene: THREE.Scene,
  position: THREE.Vector3,
  dieSize: number,
): BackstopHandle {
  const rimMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: JADE_BRIGHT,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const rim = new THREE.Sprite(rimMat);
  rim.position.copy(position);
  rim.scale.set(dieSize * 1.5, dieSize * 1.5, 1);
  scene.add(rim);

  const ringMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: JADE,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const ring = new THREE.Sprite(ringMat);
  ring.position.copy(position);
  ring.scale.set(dieSize * 1.0, dieSize * 1.0, 1);
  scene.add(ring);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    if (dt < 150) {
      const t = dt / 150;
      rimMat.opacity = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
    } else {
      rimMat.opacity = 0;
    }

    if (dt >= 150 && dt < 400) {
      const t = (dt - 150) / 250;
      const scale = (1.0 + t * 2.5) * dieSize;
      ring.scale.set(scale, scale, 1);
      ringMat.opacity = 0.7 * (1 - t);
    }

    if (dt >= 400 && dt < TOTAL_DURATION_MS) {
      const t = (dt - 400) / 250;
      ringMat.opacity = Math.max(0, 0.1 * (1 - t));
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
    scene.remove(rim);
    rimMat.dispose();
    scene.remove(ring);
    ringMat.dispose();
    // The shared halo texture is module-cached in buildDie.ts; do not dispose.
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
