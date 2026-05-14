// src-next/render/three/modFx/conduit.ts — Conduit's fire animation.
// Three small bright sparks sweep in from the left (representing the
// dice that already scored), converge into the die, and trigger a
// central pulse. Tells the player "chain current arrived here."
//
// Stage timings:
//   0-200ms: three sparks travel from -1.4× to 0× along X axis, fading
//            up; staggered start by 50ms each so they read as a sequence
//   180-400ms: central pulse (scale 1.0→1.7, opacity 0.85→0)

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type ConduitHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 400;
const SPARK_COUNT = 3;
const SPARK_TRAVEL_MS = 200;
const SPARK_STAGGER_MS = 50;

export function fireConduit(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): ConduitHandle {
  const pulseMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: accentColor,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const pulse = new THREE.Sprite(pulseMat);
  pulse.position.copy(position);
  scene.add(pulse);

  const sparks: THREE.Sprite[] = [];
  const sparkMats: THREE.SpriteMaterial[] = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
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
    const s = dieSize * 0.16;
    sprite.scale.set(s, s, 1);
    sprite.position.copy(position);
    scene.add(sprite);
    sparks.push(sprite);
    sparkMats.push(mat);
  }

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Sparks: sweep in from -1.4× X to 0× X, fade-in/fade-out.
    for (let i = 0; i < sparks.length; i++) {
      const sprite = sparks[i]!;
      const mat = sparkMats[i]!;
      const startAt = i * SPARK_STAGGER_MS;
      const localDt = dt - startAt;
      if (localDt < 0) {
        mat.opacity = 0;
        continue;
      }
      if (localDt < SPARK_TRAVEL_MS) {
        const t = localDt / SPARK_TRAVEL_MS;
        const eased = 1 - Math.pow(1 - t, 2);
        // Travel from -1.4 → 0 along X (slight Z spread per index).
        const x = position.x + (-1.4 + 1.4 * eased) * dieSize;
        const z = position.z + (i - 1) * dieSize * 0.18;
        sprite.position.set(x, position.y + 0.01, z);
        // Bell-shape opacity centred at 60%.
        mat.opacity = t < 0.6 ? (t / 0.6) * 0.95 : 0.95 * (1 - (t - 0.6) / 0.4);
      } else {
        mat.opacity = 0;
      }
    }

    // Pulse: starts at 180ms when sparks are converging.
    if (dt > 180 && dt < TOTAL_DURATION_MS) {
      const t = (dt - 180) / (TOTAL_DURATION_MS - 180);
      const eased = 1 - Math.pow(1 - t, 3);
      const s = dieSize * (1.0 + eased * 0.7);
      pulse.scale.set(s, s, 1);
      pulseMat.opacity = 0.85 * (1 - eased);
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
    scene.remove(pulse);
    pulseMat.dispose();
    for (const s of sparks) scene.remove(s);
    for (const m of sparkMats) m.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
