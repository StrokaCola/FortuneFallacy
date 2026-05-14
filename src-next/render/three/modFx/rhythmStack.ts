// src-next/render/three/modFx/rhythmStack.ts — Cadence's fire animation.
// Three short tempo-beats appear sequentially above the die, each
// fading as the next arrives. Reads as the stack-count climbing — the
// player sees a beat-rhythm rather than just a halo.
//
// Stage timings:
//   0-380ms total
//   Beat 1: 0-180ms   (peak at 60ms, fade by 180ms)
//   Beat 2: 80-280ms  (peak at 140ms)
//   Beat 3: 160-380ms (peak at 220ms)

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type RhythmStackHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 380;
const BEAT_DURATION_MS = 180;

type Beat = { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; startAt: number; yOffset: number };

export function fireRhythmStack(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): RhythmStackHandle {
  const beats: Beat[] = [];
  for (let i = 0; i < 3; i++) {
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
    // Beats stack vertically above the die: 0.3, 0.6, 0.9 × dieSize up.
    const yOffset = (i + 1) * dieSize * 0.30;
    sprite.position.set(position.x, position.y + yOffset, position.z);
    const s = dieSize * 0.32;
    sprite.scale.set(s, s, 1);
    scene.add(sprite);
    beats.push({ sprite, mat, startAt: i * 80, yOffset });
  }

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    for (const b of beats) {
      const localDt = dt - b.startAt;
      if (localDt < 0 || localDt > BEAT_DURATION_MS) {
        b.mat.opacity = 0;
        continue;
      }
      const t = localDt / BEAT_DURATION_MS;
      const eased = 1 - Math.pow(1 - t, 3);
      // Beat rises slightly and grows.
      const yRise = t * dieSize * 0.10;
      b.sprite.position.set(position.x, position.y + b.yOffset + yRise, position.z);
      const s = dieSize * 0.32 * (1 + eased * 0.4);
      b.sprite.scale.set(s, s, 1);
      // Bell opacity, peak at 33%.
      b.mat.opacity = t < 0.33
        ? (t / 0.33) * 0.9
        : 0.9 * (1 - (t - 0.33) / 0.67);
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
    for (const b of beats) {
      scene.remove(b.sprite);
      b.mat.dispose();
    }
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
