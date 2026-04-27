import type { SimulationResult, SimMetrics } from '../../events/types';

const norm = (v: number, lo: number, hi: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
const max  = (a: number[]) => (a.length === 0 ? 0 : Math.max(...a));
const avg  = (a: number[]) => (a.length === 0 ? 0 : a.reduce((s, x) => s + x, 0) / a.length);
const stdev = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = avg(a);
  return Math.sqrt(avg(a.map((x) => (x - m) ** 2)));
};

export function deriveMetrics(r: SimulationResult): SimMetrics {
  return {
    chaos:  norm(r.collisionCount, 0, 30) * 0.6 + norm(r.peakVelocity, 0, 12) * 0.4,
    impact: max(r.bounceHeights),
    settle: avg(r.settleMs),
    sync:   1 - Math.min(1, stdev(r.settleMs) / 1000),
  };
}
