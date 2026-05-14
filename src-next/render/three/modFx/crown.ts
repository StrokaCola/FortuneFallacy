// src-next/render/three/modFx/crown.ts — Crown mod fires when its die
// lands on a 6. Animation: a six-pip "fountain" — the canonical 6-face
// dot grid blooms outward from the die center as a gold corona.
//
// Stage timings:
//   0-100ms : six pip-sprites scale 0 → 1.0 (in-place bloom)
//   100-350ms: pip-sprites scatter outward to 2.4× radius + fade
//   0-450ms : single outer corona halo (slow expand + fade)
//
// Distinct from Loaded which condenses inward; Crown radiates outward
// so the player reads it as a payoff, not a setup.

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type CrownHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 450;
const GOLD = '#ffd84a';
const GOLD_BRIGHT = '#fff7e0';

// 6-pip arrangement (two columns of three) at unit-radius positions.
const PIP_OFFSETS: [number, number][] = [
  [-0.22, -0.30], [0.22, -0.30],
  [-0.22,  0.00], [0.22,  0.00],
  [-0.22,  0.30], [0.22,  0.30],
];

export function fireCrown(
  scene: THREE.Scene,
  position: THREE.Vector3,
  dieSize: number,
): CrownHandle {
  const coronaMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: GOLD,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const corona = new THREE.Sprite(coronaMat);
  corona.position.copy(position);
  scene.add(corona);

  const pipSprites: THREE.Sprite[] = [];
  const pipMats: THREE.SpriteMaterial[] = [];
  for (let i = 0; i < PIP_OFFSETS.length; i++) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: i % 2 === 0 ? GOLD_BRIGHT : GOLD,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(0.001, 0.001, 1);
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

    // Corona — slow expand 1.0 → 2.2, opacity 0 → 0.85 (peak 30%) → 0.
    const tCorona = Math.min(1, dt / TOTAL_DURATION_MS);
    const easedCorona = 1 - Math.pow(1 - tCorona, 2);
    const cs = dieSize * (1.0 + easedCorona * 1.2);
    corona.scale.set(cs, cs, 1);
    coronaMat.opacity = tCorona < 0.3
      ? (tCorona / 0.3) * 0.85
      : 0.85 * (1 - (tCorona - 0.3) / 0.7);

    // Pips — bloom 0→100ms, scatter 100→350ms, fade 350→450ms.
    for (let i = 0; i < pipSprites.length; i++) {
      const sprite = pipSprites[i]!;
      const mat = pipMats[i]!;
      const [u, v] = PIP_OFFSETS[i]!;
      if (dt < 100) {
        const t = dt / 100;
        const s = dieSize * 0.22 * t;
        sprite.scale.set(s, s, 1);
        mat.opacity = t;
        sprite.position.set(position.x + u * dieSize, position.y + 0.01, position.z + v * dieSize);
      } else if (dt < 350) {
        const t = (dt - 100) / 250;
        const eased = 1 - Math.pow(1 - t, 3);
        const radius = 1 + eased * 1.4; // 1.0 → 2.4
        sprite.position.set(
          position.x + u * dieSize * radius,
          position.y + 0.01,
          position.z + v * dieSize * radius,
        );
        const s = dieSize * 0.22 * (1 + eased * 0.6);
        sprite.scale.set(s, s, 1);
        mat.opacity = 1 - eased * 0.3;
      } else {
        const t = Math.min(1, (dt - 350) / 100);
        mat.opacity = 0.7 * (1 - t);
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
    scene.remove(corona);
    coronaMat.dispose();
    for (const s of pipSprites) scene.remove(s);
    for (const m of pipMats) m.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
