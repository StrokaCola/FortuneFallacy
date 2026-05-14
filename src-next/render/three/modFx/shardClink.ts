// src-next/render/three/modFx/shardClink.ts — Tithe's fire animation.
// 4 small gold coin-sprites scatter outward radially (the shards being
// spent) along with a centred bronze flash. Reads as paying the toll.
//
// Stage timings:
//   0-80ms : centred flash (the moment of payment)
//   40-380ms: 4 coins scatter outward, slight downward drift, fading

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type ShardClinkHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 380;
const COIN_COUNT = 4;
const GOLD = '#f5c451';
const GOLD_BRIGHT = '#fff7e0';

export function fireShardClink(
  scene: THREE.Scene,
  position: THREE.Vector3,
  dieSize: number,
): ShardClinkHandle {
  const flashMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: GOLD_BRIGHT,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const flash = new THREE.Sprite(flashMat);
  flash.position.copy(position);
  flash.scale.set(dieSize * 0.7, dieSize * 0.7, 1);
  scene.add(flash);

  const coins: THREE.Sprite[] = [];
  const coinMats: THREE.SpriteMaterial[] = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: GOLD,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    const s = dieSize * 0.16;
    sprite.scale.set(s, s, 1);
    scene.add(sprite);
    coins.push(sprite);
    coinMats.push(mat);
  }

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Flash: 0-80ms quick on/off.
    if (dt < 40) {
      flashMat.opacity = (dt / 40);
    } else if (dt < 80) {
      flashMat.opacity = 1 - (dt - 40) / 40;
    } else {
      flashMat.opacity = 0;
    }

    // Coins: scatter outward in 4 cardinal directions + slight gravity dip.
    const scatterStart = 40;
    const scatterDur = TOTAL_DURATION_MS - scatterStart;
    for (let i = 0; i < coins.length; i++) {
      const sprite = coins[i]!;
      const mat = coinMats[i]!;
      const angle = (i / COIN_COUNT) * Math.PI * 2 + Math.PI / 4;
      const localDt = dt - scatterStart;
      if (localDt < 0) continue;
      const t = Math.min(1, localDt / scatterDur);
      const eased = 1 - Math.pow(1 - t, 2.2);
      const radius = eased * dieSize * 1.0;
      sprite.position.set(
        position.x + Math.cos(angle) * radius,
        position.y + 0.01 - t * t * dieSize * 0.18,
        position.z + Math.sin(angle) * radius,
      );
      mat.opacity = t < 0.2 ? (t / 0.2) * 0.95 : 0.95 * (1 - (t - 0.2) / 0.8);
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
    for (const s of coins) scene.remove(s);
    for (const m of coinMats) m.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
