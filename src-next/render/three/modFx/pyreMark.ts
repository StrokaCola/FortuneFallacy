// src-next/render/three/modFx/pyreMark.ts — Pyre Mark's fire animation.
// Fires every time the die rolls a 1 (the mod's stack-accrual trigger).
// 5 tiny ember sprites rise upward from the die, scattering slightly,
// fading as they ascend. Reads as fuel catching.

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type PyreMarkHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 380;
const EMBER_COUNT = 5;
const EMBER = '#ff7847';
const EMBER_BRIGHT = '#ffd84a';

export function firePyreMark(
  scene: THREE.Scene,
  position: THREE.Vector3,
  dieSize: number,
): PyreMarkHandle {
  // Tiny base flash at the bottom — the fuel catching.
  const baseMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: EMBER,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const base = new THREE.Sprite(baseMat);
  base.position.copy(position);
  base.scale.set(dieSize * 0.5, dieSize * 0.5, 1);
  scene.add(base);

  // Ember offsets — small random scatter around the die centre.
  const offsets: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < EMBER_COUNT; i++) {
    // Spread embers in a small horizontal band, slightly biased.
    offsets.push({
      x: ((i / (EMBER_COUNT - 1)) - 0.5) * dieSize * 0.45,
      z: ((i * 13) % 7 - 3) * dieSize * 0.04,
    });
  }

  const embers: THREE.Sprite[] = [];
  const emberMats: THREE.SpriteMaterial[] = [];
  for (let i = 0; i < EMBER_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: i % 2 === 0 ? EMBER_BRIGHT : EMBER,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(position.x + offsets[i]!.x, position.y, position.z + offsets[i]!.z);
    const s = dieSize * 0.10;
    sprite.scale.set(s, s, 1);
    scene.add(sprite);
    embers.push(sprite);
    emberMats.push(mat);
  }

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Base flash: quick on, quick off (0-120ms).
    if (dt < 60) {
      baseMat.opacity = (dt / 60) * 0.7;
    } else if (dt < 120) {
      baseMat.opacity = 0.7 * (1 - (dt - 60) / 60);
    } else {
      baseMat.opacity = 0;
    }

    // Embers: rise + fade. Each ember has its own start offset.
    for (let i = 0; i < embers.length; i++) {
      const sprite = embers[i]!;
      const mat = emberMats[i]!;
      const startAt = i * 30;
      const localDt = dt - startAt;
      if (localDt < 0) continue;
      const lifespan = TOTAL_DURATION_MS - 50;
      if (localDt < lifespan) {
        const t = localDt / lifespan;
        // Rise: 0 → 1.2× dieSize upward.
        sprite.position.set(
          position.x + offsets[i]!.x,
          position.y + t * dieSize * 1.2,
          position.z + offsets[i]!.z,
        );
        // Bell opacity, peak at 30%.
        mat.opacity = t < 0.3 ? (t / 0.3) * 0.95 : 0.95 * (1 - (t - 0.3) / 0.7);
        // Slight scale-down as it rises.
        const s = dieSize * 0.10 * (1 - t * 0.4);
        sprite.scale.set(s, s, 1);
      } else {
        mat.opacity = 0;
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
    scene.remove(base);
    baseMat.dispose();
    for (const s of embers) scene.remove(s);
    for (const m of emberMats) m.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
