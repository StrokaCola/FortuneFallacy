// src-next/render/three/modFx/loaded.ts
import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type LoadedHandle = {
  dispose: () => void;
};

const BRONZE = '#c87a4a';
const BRONZE_BRIGHT = '#ffb074';
const TOTAL_DURATION_MS = 550;

// Stage timings:
//   0-120ms  : condense (single bronze sprite, scale 1.0→0.4, opacity 0→1)
//   120-300ms: halo expand+collapse (scale 0.4→2.5→0)
//   300-500ms: 6-pip bloom (six small sprites fade in then out)
//   500-550ms: edge flash settle (one larger sprite, brief flare)

const PIP_BLOOM_OFFSETS: [number, number][] = [
  [-0.24, -0.28], [0.24, -0.28],
  [-0.24,  0.00], [0.24,  0.00],
  [-0.24,  0.28], [0.24,  0.28],
];

export function fireLoaded(
  scene: THREE.Scene,
  position: THREE.Vector3,
  dieSize: number,
): LoadedHandle {
  const primaryMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: BRONZE,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const primary = new THREE.Sprite(primaryMat);
  primary.position.copy(position);
  primary.scale.set(dieSize, dieSize, 1);
  scene.add(primary);

  const pipSprites: THREE.Sprite[] = [];
  const pipMats: THREE.SpriteMaterial[] = [];
  for (const [u, v] of PIP_BLOOM_OFFSETS) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: BRONZE_BRIGHT,
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
    const pipSize = dieSize * 0.18;
    sprite.scale.set(pipSize, pipSize, 1);
    scene.add(sprite);
    pipSprites.push(sprite);
    pipMats.push(mat);
  }

  const edgeMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: BRONZE,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const edge = new THREE.Sprite(edgeMat);
  edge.position.copy(position);
  edge.scale.set(dieSize * 2.0, dieSize * 2.0, 1);
  scene.add(edge);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    if (dt < 120) {
      const t = dt / 120;
      primaryMat.opacity = t;
      const s = (1.0 - t * 0.6) * dieSize;
      primary.scale.set(s, s, 1);
    } else if (dt < 300) {
      const t = (dt - 120) / 180;
      const peak = 2.5;
      const s = (t < 0.5 ? 0.4 + (peak - 0.4) * (t / 0.5) : peak * (1 - (t - 0.5) / 0.5)) * dieSize;
      primary.scale.set(Math.max(0.001, s), Math.max(0.001, s), 1);
      primaryMat.opacity = 1 - t * 0.7;
    } else {
      primaryMat.opacity = 0;
    }

    if (dt >= 300 && dt < 500) {
      const t = (dt - 300) / 200;
      const opacity = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
      for (const m of pipMats) m.opacity = opacity;
    } else if (dt >= 500) {
      for (const m of pipMats) m.opacity = 0;
    }

    if (dt >= 500 && dt < TOTAL_DURATION_MS) {
      const t = (dt - 500) / 50;
      edgeMat.opacity = (1 - t) * 0.6;
    } else if (dt < 500) {
      edgeMat.opacity = 0;
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
    scene.remove(primary);
    primaryMat.dispose();
    for (const sprite of pipSprites) scene.remove(sprite);
    for (const mat of pipMats) mat.dispose();
    scene.remove(edge);
    edgeMat.dispose();
    // The shared halo texture is module-cached in buildDie.ts; do not dispose.
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
