// Dice-land screen shake. The Rapier physics sim already returns
// `peakVelocity` per simulation (units are roughly 0–12 — see
// rapierSim.ts and core/derived/simulationMetrics.ts where it's
// normalized against a 0–12 range). We map that into the existing
// triggerShake() intensity ladder so heavy rolls (player slammed the
// table) feel different from a soft drop. Free juice — the data is
// already there, we just stopped throwing it away.
//
// Throttle/dedupe is unnecessary: triggerShake() already cancels and
// replays a running shake when called twice in quick succession.

import { bus } from '../../events/bus';
import { triggerShake, type ShakeIntensity } from './screenShake';

// Thresholds tuned conservatively. A "tiny" shake on every roll would
// numb the response; we only shake when the physics actually had some
// force behind it. Tweak the numbers in this file alone — no other
// site reads peakVelocity for visual feedback.
const TINY_THRESHOLD = 1.5;
const MID_THRESHOLD = 4.0;
const BIG_THRESHOLD = 8.0;

function intensityFromVelocity(v: number): ShakeIntensity | null {
  if (v >= BIG_THRESHOLD) return 'big';
  if (v >= MID_THRESHOLD) return 'mid';
  if (v >= TINY_THRESHOLD) return 'tiny';
  return null;
}

export function startDiceLandShake(): () => void {
  const off = bus.on('onSimulationEnd', ({ result }) => {
    const v = result?.peakVelocity ?? 0;
    const intensity = intensityFromVelocity(v);
    if (intensity) triggerShake(intensity);
  });
  return off;
}
