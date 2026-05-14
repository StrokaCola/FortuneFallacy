// src-next/render/three/modFx/resonance.ts — Resonance's fire animation
// (legendary double-fire mod). Two halos pulse at different breathing
// frequencies so their beats interfere — sympathetic resonance made
// visible. Longer than other FX (600ms) to match the legendary
// "moment" feel + the held audio chord.

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type ResonanceHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 600;

export function fireResonance(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): ResonanceHandle {
  function makeRing(color: string, baseSize: number) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(baseSize, baseSize, 1);
    scene.add(sprite);
    return { sprite, mat, baseSize };
  }

  const ringA = makeRing(accentColor, dieSize * 1.4);
  const ringB = makeRing('#fff7e0', dieSize * 1.6);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;
    const t = Math.min(1, dt / TOTAL_DURATION_MS);

    // Envelope: ramp up to 50%, hold, ramp down. Inner curves create
    // the beat-frequency feel.
    const envelope = t < 0.3
      ? t / 0.3
      : t < 0.7
        ? 1
        : (1 - t) / 0.3;
    const breathA = 0.5 + 0.5 * Math.sin(t * Math.PI * 4); // 2 full cycles
    const breathB = 0.5 + 0.5 * Math.sin(t * Math.PI * 5); // 2.5 cycles → beat

    const sA = ringA.baseSize * (1 + 0.18 * breathA);
    ringA.sprite.scale.set(sA, sA, 1);
    ringA.mat.opacity = 0.65 * envelope * (0.5 + breathA * 0.5);

    const sB = ringB.baseSize * (1 + 0.15 * breathB);
    ringB.sprite.scale.set(sB, sB, 1);
    ringB.mat.opacity = 0.45 * envelope * (0.5 + breathB * 0.5);

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
    scene.remove(ringA.sprite);
    ringA.mat.dispose();
    scene.remove(ringB.sprite);
    ringB.mat.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
