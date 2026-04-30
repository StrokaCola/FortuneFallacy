// src-next/render/three/modFx/pipCharge.ts
import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type PipChargeHandle = {
  dispose: () => void;
};

const AMBER = '#ffd84a';
const AMBER_BRIGHT = '#fff3a0';
const GATHER_MS = 100;
const PER_PIP_MS = 80;

const FACE_OFFSETS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.22, -0.22], [0.22, 0.22]],
  3: [[-0.24, -0.24], [0, 0], [0.24, 0.24]],
  4: [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]],
  5: [[-0.24, -0.24], [0.24, -0.24], [0, 0], [-0.24, 0.24], [0.24, 0.24]],
  6: [[-0.24, -0.28], [0.24, -0.28], [-0.24, 0], [0.24, 0], [-0.24, 0.28], [0.24, 0.28]],
};

export function firePipCharge(
  scene: THREE.Scene,
  position: THREE.Vector3,
  faceValue: number,
  dieSize: number,
): PipChargeHandle {
  const offsets = FACE_OFFSETS[Math.max(1, Math.min(6, faceValue))] ?? FACE_OFFSETS[1]!;
  const totalDuration = GATHER_MS + offsets.length * PER_PIP_MS;

  const gatherMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: AMBER,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const gather = new THREE.Sprite(gatherMat);
  gather.position.copy(position);
  gather.scale.set(dieSize * 1.0, dieSize * 1.0, 1);
  scene.add(gather);

  const pipSprites: THREE.Sprite[] = [];
  const pipMats: THREE.SpriteMaterial[] = [];
  for (const [u, v] of offsets) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: AMBER_BRIGHT,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(
      position.x + u * dieSize,
      position.y + 0.01,
      position.z + v * dieSize,
    );
    const pipSize = dieSize * 0.22;
    sprite.scale.set(pipSize, pipSize, 1);
    scene.add(sprite);
    pipSprites.push(sprite);
    pipMats.push(mat);
  }

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    if (dt < GATHER_MS) {
      const t = dt / GATHER_MS;
      gatherMat.opacity = t * 0.8;
    } else {
      gatherMat.opacity = Math.max(0, 0.8 * (1 - (dt - GATHER_MS) / 200));
    }

    for (let i = 0; i < pipMats.length; i++) {
      const start = GATHER_MS + i * PER_PIP_MS;
      const end = start + PER_PIP_MS * 1.5;
      if (dt >= start && dt < end) {
        const t = (dt - start) / (end - start);
        const opacity = t < 0.3 ? t / 0.3 : (t > 0.5 ? Math.max(0, 1 - (t - 0.5) / 0.5) : 1);
        pipMats[i]!.opacity = opacity;
      } else if (dt >= end) {
        pipMats[i]!.opacity = 0;
      }
    }

    if (dt >= totalDuration + 100) {
      doDispose();
      return;
    }
    rafHandle = requestAnimationFrame(step);
  }

  function doDispose(): void {
    if (disposed) return;
    disposed = true;
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    scene.remove(gather);
    gatherMat.dispose();
    for (const s of pipSprites) scene.remove(s);
    for (const m of pipMats) m.dispose();
    // The shared halo texture is module-cached in buildDie.ts; do not dispose.
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
