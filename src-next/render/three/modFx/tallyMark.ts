// src-next/render/three/modFx/tallyMark.ts — Tally Mark's fire animation.
// A single horizontal stroke is "scribed" left-to-right across the die,
// then a tiny chip-bonus flash. Tells the player a tally tick was
// recorded — reads as ink-on-paper.
//
// Stage timings:
//   0-180ms: stroke widens left→right (scale.x grows; opacity bell)
//   140-280ms: chip flash (single sprite, opacity 0→1→0)

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type TallyMarkHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 280;
const STROKE_DURATION_MS = 180;

export function fireTallyMark(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): TallyMarkHandle {
  // The stroke: a thin sprite that we stretch horizontally over time.
  // SpriteMaterial doesn't expose a proper rect, so we use a sprite at
  // a low scale.y to approximate an ink line.
  const strokeMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: accentColor,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const stroke = new THREE.Sprite(strokeMat);
  // Start anchored at left side of die.
  stroke.position.set(position.x - dieSize * 0.4, position.y + 0.01, position.z);
  stroke.scale.set(0.001, dieSize * 0.18, 1);
  scene.add(stroke);

  const flashMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: '#fff7e0',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const flash = new THREE.Sprite(flashMat);
  flash.position.copy(position);
  flash.scale.set(dieSize * 0.6, dieSize * 0.6, 1);
  scene.add(flash);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Stroke phase: grow width 0→0.9× dieSize while sliding rightward.
    if (dt < STROKE_DURATION_MS) {
      const t = dt / STROKE_DURATION_MS;
      const eased = 1 - Math.pow(1 - t, 2);
      const width = dieSize * 0.9 * eased;
      stroke.scale.set(width, dieSize * 0.18, 1);
      // Slide so the stroke's left edge stays at -0.4× dieSize.
      const offsetX = -dieSize * 0.4 + width * 0.5;
      stroke.position.set(position.x + offsetX, position.y + 0.01, position.z);
      // Bell opacity, peak at 50%.
      strokeMat.opacity = t < 0.5 ? (t / 0.5) * 0.9 : 0.9 * (1 - (t - 0.5) / 0.5);
    } else {
      strokeMat.opacity = 0;
    }

    // Chip flash: starts at 140ms, lasts 140ms.
    if (dt >= 140 && dt < TOTAL_DURATION_MS) {
      const t = (dt - 140) / (TOTAL_DURATION_MS - 140);
      flashMat.opacity = t < 0.4 ? (t / 0.4) * 0.85 : 0.85 * (1 - (t - 0.4) / 0.6);
      const s = dieSize * (0.6 + t * 0.3);
      flash.scale.set(s, s, 1);
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
    scene.remove(stroke);
    strokeMat.dispose();
    scene.remove(flash);
    flashMat.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
