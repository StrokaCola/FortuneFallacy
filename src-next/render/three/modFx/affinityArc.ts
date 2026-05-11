// affinityArc — Phase 3.3 of the 2026-05-11 Forge overhaul.
//
// Fires a brief gold arc between two world positions on a die when an
// affinitied mod pair is detected on a scoring die. The arc is rendered
// as a 24-segment Line, blended additively, with a fade-in / fade-out
// over ~560 ms. The curve is a quadratic Bezier bowed outward from the
// die center so the arc reads as "connecting around" the die rather
// than cutting through it.

import * as THREE from 'three';

export type AffinityArcHandle = {
  dispose: () => void;
};

const ARC_DURATION_MS = 560;
const SEGMENTS = 24;
const ARC_COLOR = '#f5c451';

export function fireAffinityArc(
  scene: THREE.Scene,
  pointA: THREE.Vector3,
  pointB: THREE.Vector3,
  dieCenter: THREE.Vector3,
): AffinityArcHandle {
  // Build a quadratic Bezier control point bowed outward — away from
  // dieCenter along the perpendicular of A→B. The bow magnitude scales
  // with the chord length so a long arc curves more.
  const ab = new THREE.Vector3().subVectors(pointB, pointA);
  const chord = ab.length();
  const mid = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5);
  // Outward direction: from die center toward midpoint.
  const outward = new THREE.Vector3().subVectors(mid, dieCenter).normalize();
  const control = mid.clone().addScaledVector(outward, chord * 0.45);

  // Sample the curve.
  const curve = new THREE.QuadraticBezierCurve3(pointA, control, pointB);
  const pts = curve.getPoints(SEGMENTS);
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: ARC_COLOR,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    linewidth: 2, // honored by some renderers; the additive blend carries the read otherwise
  });
  const line = new THREE.Line(geom, mat);
  line.name = 'AffinityArc';
  scene.add(line);

  let disposed = false;
  let raf: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const t = (performance.now() - t0) / ARC_DURATION_MS;
    if (t >= 1) {
      doDispose();
      return;
    }
    // Envelope: fade-in 0..0.2, plateau 0.2..0.6, fade-out 0.6..1.0.
    let opacity = 0;
    if (t < 0.2) opacity = (t / 0.2) * 0.9;
    else if (t < 0.6) opacity = 0.9;
    else opacity = 0.9 * (1 - (t - 0.6) / 0.4);
    mat.opacity = opacity;
    raf = requestAnimationFrame(step);
  }

  function doDispose(): void {
    if (disposed) return;
    disposed = true;
    if (raf != null) cancelAnimationFrame(raf);
    scene.remove(line);
    geom.dispose();
    mat.dispose();
  }

  raf = requestAnimationFrame(step);
  return { dispose: doDispose };
}
