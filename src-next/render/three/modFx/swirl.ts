// src-next/render/three/modFx/swirl.ts — Wildcard's fire animation. A
// rotating prismatic ring of 6 small sprites (one per face) that
// "cycles through faces" before resolving, telling the player the
// wildcard chose. Reads as the dice's uncertainty collapsing.
//
// Stage timings:
//   0-400ms: 6 satellites orbit, spinning ~360°
//   320-500ms: satellites converge inward + fade
//   0-500ms: pulsing inner glow that breathes during the spin

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type SwirlHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 500;
const SAT_COUNT = 6;

export function fireSwirl(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): SwirlHandle {
  const coreMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: accentColor,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const core = new THREE.Sprite(coreMat);
  core.position.copy(position);
  scene.add(core);

  const sats: THREE.Sprite[] = [];
  const satMats: THREE.SpriteMaterial[] = [];
  for (let i = 0; i < SAT_COUNT; i++) {
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
    const s = dieSize * 0.18;
    sprite.scale.set(s, s, 1);
    scene.add(sprite);
    sats.push(sprite);
    satMats.push(mat);
  }

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;
    const t = Math.min(1, dt / TOTAL_DURATION_MS);

    // Inner glow: breathing pulse that peaks at 50% then drops.
    const breath = Math.sin(t * Math.PI);
    const coreSize = dieSize * (0.6 + breath * 0.4);
    core.scale.set(coreSize, coreSize, 1);
    coreMat.opacity = 0.6 * breath;

    // Six satellites orbit ~1.4 turns, then fall in.
    const rotation = t * Math.PI * 2 * 1.4;
    for (let i = 0; i < sats.length; i++) {
      const sprite = sats[i]!;
      const mat = satMats[i]!;
      const baseAngle = (i / SAT_COUNT) * Math.PI * 2;
      const angle = baseAngle + rotation;
      // Orbit radius shrinks in the last 30%.
      const radius = t < 0.65
        ? dieSize * 0.9
        : dieSize * 0.9 * (1 - (t - 0.65) / 0.35);
      sprite.position.set(
        position.x + Math.cos(angle) * radius,
        position.y + 0.01,
        position.z + Math.sin(angle) * radius,
      );
      // Fade in 0-15%, hold, fade out 70-100%.
      if (t < 0.15) {
        mat.opacity = (t / 0.15) * 0.9;
      } else if (t < 0.70) {
        mat.opacity = 0.9;
      } else {
        mat.opacity = 0.9 * (1 - (t - 0.70) / 0.30);
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
    scene.remove(core);
    coreMat.dispose();
    for (const s of sats) scene.remove(s);
    for (const m of satMats) m.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
