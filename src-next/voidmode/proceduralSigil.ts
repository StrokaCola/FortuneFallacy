// src-next/voidmode/proceduralSigil.ts
// Seeded SVG-path generator for Void Mode boss sigils. Produces a
// closed-shape silhouette in a [0..100, 0..100] viewBox. Output is a
// single `d` attribute string suitable for <path d={...}>.
//
// Algorithm:
//   1. Sample N points on a perturbed circle (radial-noise displacement)
//   2. Connect with smooth cubic beziers between consecutive points
//   3. Close the path (Z)
//
// Same seed always yields the same path. Two different seeds yield
// visually distinct silhouettes — varying number of lobes, sharpness,
// and asymmetry.

import { mulberry32 } from '../core/rng';

const CENTER = 50;

export interface ProceduralSigil {
  pathD: string;
  // Bounding circle radius the path occupies, in viewBox units.
  // Useful for callers that want to layer effects (glow rings, etc.)
  // around the silhouette without overlapping the strokes.
  radius: number;
}

export function generateProceduralSigil(seed: number): ProceduralSigil {
  const rng = mulberry32(seed >>> 0);
  // Random count of major lobes (5..9). Higher = more "starburst", lower
  // = smoother blob-like silhouette.
  const lobeCount = 5 + rng.int(0, 4);
  // Base radius slightly randomized so silhouettes don't all sit at the
  // same scale.
  const baseR = 32 + rng.next() * 10;
  // Spike amplitude — how far the lobes extend past the base.
  const spike = 6 + rng.next() * 14;

  // Sample 2*lobeCount points around the circle so each lobe has an
  // inner and outer point (giving the silhouette teeth/folds).
  const sampleCount = lobeCount * 2;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = (i / sampleCount) * Math.PI * 2;
    // Alternating spike: outer points get +spike, inner points get base.
    const outer = i % 2 === 0;
    const noise = (rng.next() - 0.5) * 4; // small per-point jitter
    const r = baseR + (outer ? spike : 0) + noise;
    pts.push({
      x: CENTER + Math.cos(t) * r,
      y: CENTER + Math.sin(t) * r,
    });
  }

  // Build the path with cubic Beziers between consecutive points. The
  // control points are offsets perpendicular to the chord between
  // adjacent points, smoothed by a constant factor.
  const smooth = 0.35;
  let d = `M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)} `;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const prev = pts[(i - 1 + pts.length) % pts.length]!;
    const next = pts[(i + 2) % pts.length]!;
    const c1x = a.x + (b.x - prev.x) * smooth;
    const c1y = a.y + (b.y - prev.y) * smooth;
    const c2x = b.x - (next.x - a.x) * smooth;
    const c2y = b.y - (next.y - a.y) * smooth;
    d += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${b.x.toFixed(2)} ${b.y.toFixed(2)} `;
  }
  d += 'Z';

  return { pathD: d.trim(), radius: baseR + spike };
}

// Helper: combine a void seed with a boss id + ante into a stable
// per-boss-per-run seed. Same player on the same daily certified
// seed sees the same boss sigil; different seeds yield different
// silhouettes.
export function proceduralSigilSeed(voidSeed: number, bossId: string, ante: number): number {
  let h = (voidSeed >>> 0) ^ 0x9e3779b9;
  for (let i = 0; i < bossId.length; i++) {
    h = Math.imul(h ^ bossId.charCodeAt(i), 0x01000193);
  }
  return (h ^ Math.imul(ante + 1, 0x85ebca6b)) >>> 0;
}
