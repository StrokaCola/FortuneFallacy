// src-next/render/three/modFx/twinGlow.ts — Mirror Pair's fire animation.
// Two halos pulse in sympathy — one at the die's position, one offset
// horizontally to suggest the matched partner. Telegraphs the pair
// relationship to the player.
//
// Stage timings:
//   0-260ms: both halos scale 1.0→1.5, opacity rises then falls
//            Partner halo is offset by 1.3× dieSize on the X axis and
//            slightly delayed (40ms).

import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type TwinGlowHandle = { dispose: () => void };

const TOTAL_DURATION_MS = 360;
const PARTNER_DELAY_MS = 40;

export function fireTwinGlow(
  scene: THREE.Scene,
  position: THREE.Vector3,
  accentColor: string,
  dieSize: number,
): TwinGlowHandle {
  function makeHalo(color: string, offsetX: number, scaleStart: number) {
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
    sprite.position.set(position.x + offsetX, position.y + 0.01, position.z);
    sprite.scale.set(dieSize * scaleStart, dieSize * scaleStart, 1);
    scene.add(sprite);
    return { sprite, mat, baseSize: dieSize * scaleStart, offsetX };
  }

  const primary = makeHalo(accentColor, 0, 1.4);
  // Partner: slightly smaller, dim, alternates color for read.
  const partner = makeHalo('#fff7e0', dieSize * 1.3, 1.1);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function tick(handle: ReturnType<typeof makeHalo>, dt: number, peakOpacity: number, durationMs: number) {
    if (dt < 0 || dt > durationMs) {
      handle.mat.opacity = 0;
      return;
    }
    const t = dt / durationMs;
    const eased = 1 - Math.pow(1 - t, 2);
    const s = handle.baseSize * (1 + 0.5 * eased);
    handle.sprite.scale.set(s, s, 1);
    handle.mat.opacity = t < 0.4
      ? (t / 0.4) * peakOpacity
      : peakOpacity * (1 - (t - 0.4) / 0.6);
  }

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;
    tick(primary, dt, 0.9, 260);
    tick(partner, dt - PARTNER_DELAY_MS, 0.55, 260);

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
    scene.remove(primary.sprite);
    primary.mat.dispose();
    scene.remove(partner.sprite);
    partner.mat.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
