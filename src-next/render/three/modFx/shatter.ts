// src-next/render/three/modFx/shatter.ts — Brittle's fire animation. A
// crimson burst with shard-sprites flying outward, then fading. Reads
// as fracture — the mod's lore is "destroyed if the hand busts," so
// the fire moment hints at that fragility every time.
//
// Stage timings:
//   0-80ms  : central flash (single sprite, opacity 0→1)
//   80-400ms: 8 shards radiate outward, scale + fade
//   0-450ms : background fissure halo (slow expand + dim)

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type ShatterHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 450;
const CRIMSON = '#ff7847';
const CRIMSON_BRIGHT = '#ffb074';
const SHARD_COUNT = 8;

export function fireShatter(
  scene: THREE.Scene,
  position: THREE.Vector3,
  dieSize: number,
): ShatterHandle {
  const flashMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: CRIMSON_BRIGHT,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const flash = new THREE.Sprite(flashMat);
  flash.position.copy(position);
  flash.scale.set(dieSize * 0.9, dieSize * 0.9, 1);
  scene.add(flash);

  const haloMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: CRIMSON,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.position.copy(position);
  scene.add(halo);

  const shards: THREE.Sprite[] = [];
  const shardMats: THREE.SpriteMaterial[] = [];
  for (let i = 0; i < SHARD_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: i % 2 === 0 ? CRIMSON_BRIGHT : CRIMSON,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    const s = dieSize * 0.12;
    sprite.scale.set(s, s, 1);
    scene.add(sprite);
    shards.push(sprite);
    shardMats.push(mat);
  }

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Flash — quick on, quick off (0-160ms).
    if (dt < 80) {
      flashMat.opacity = dt / 80;
    } else if (dt < 160) {
      flashMat.opacity = 1 - (dt - 80) / 80;
    } else {
      flashMat.opacity = 0;
    }

    // Halo — slow ring-out across full duration.
    const tHalo = Math.min(1, dt / TOTAL_DURATION_MS);
    const hs = dieSize * (1.2 + tHalo * 1.5);
    halo.scale.set(hs, hs, 1);
    haloMat.opacity = tHalo < 0.2
      ? (tHalo / 0.2) * 0.6
      : 0.6 * (1 - (tHalo - 0.2) / 0.8);

    // Shards — 8 of them radiate outward in a starburst pattern.
    for (let i = 0; i < shards.length; i++) {
      const sprite = shards[i]!;
      const mat = shardMats[i]!;
      const angle = (i / SHARD_COUNT) * Math.PI * 2;
      if (dt < 80) {
        mat.opacity = dt / 80;
        sprite.position.copy(position);
      } else if (dt < TOTAL_DURATION_MS) {
        const t = (dt - 80) / (TOTAL_DURATION_MS - 80);
        const eased = 1 - Math.pow(1 - t, 2.4);
        const radius = eased * dieSize * 1.6;
        sprite.position.set(
          position.x + Math.cos(angle) * radius,
          position.y + 0.01,
          position.z + Math.sin(angle) * radius,
        );
        const s = dieSize * 0.12 * (1 + eased * 0.5);
        sprite.scale.set(s, s, 1);
        mat.opacity = 1 - eased;
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
    scene.remove(flash);
    flashMat.dispose();
    scene.remove(halo);
    haloMat.dispose();
    for (const s of shards) scene.remove(s);
    for (const m of shardMats) m.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
