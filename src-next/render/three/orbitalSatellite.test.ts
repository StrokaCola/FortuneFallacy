// src-next/render/three/orbitalSatellite.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as THREE from 'three';
import { buildOrbitalSatellite } from './orbitalSatellite';

// jsdom canvas-2d stub — required because buildOrbitalSatellite uses the same
// halo texture as buildDie via getHaloTexture().
beforeAll(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as any).__origGetContext = orig;
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') {
      return {
        createRadialGradient: () => ({ addColorStop: () => {} }),
        fillRect: () => {},
        set fillStyle(_v: string) {},
      };
    }
    return null;
  } as any;
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = (HTMLCanvasElement.prototype as any).__origGetContext;
});

describe('buildOrbitalSatellite', () => {
  it('returns a Group with a chip mesh and a halo sprite', () => {
    const sat = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 0.85 });
    expect(sat.group).toBeInstanceOf(THREE.Group);
    const types = sat.group.children.map((c) => c.type);
    expect(types).toContain('Mesh');
    expect(types).toContain('Sprite');
  });

  it('chip diameter scales with die size — 12% at preview scale (size ≥ 1.0), 16% at gameplay scale (size < 1.0)', () => {
    // The chip factor tier was added for the dice-readability pass:
    // at gameplay-scale dieSize (~0.85 in world units) the prior 12%
    // factor rendered the chip at ~0.7px on a 56-72px screen render —
    // visually a sparkle, not a "mod #2 is present" cue. The 16%
    // factor at small scale gives ~1.1px which actually reads.
    const small = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 0.85 });
    const smallSphere = (small.group.children.find((c) => c.type === 'Mesh') as THREE.Mesh).geometry as THREE.SphereGeometry;
    // Radius = (size * factor) / 2; small uses factor 0.16.
    expect(smallSphere.parameters.radius).toBeCloseTo(0.85 * 0.16 / 2, 3);

    const preview = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 1.2 });
    const previewSphere = (preview.group.children.find((c) => c.type === 'Mesh') as THREE.Mesh).geometry as THREE.SphereGeometry;
    // Preview uses the original 0.12 factor — slimmer chip on the
    // Forge centerpiece so it doesn't read as a bolted-on ornament.
    expect(previewSphere.parameters.radius).toBeCloseTo(1.2 * 0.12 / 2, 3);
  });

  it('setAngle moves the chip in a circular orbit at radius ~die size * 0.65–0.7', () => {
    const sat = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 1.2 });
    sat.setAngle(0);
    const p0 = sat.group.children[0]!.position.clone();
    sat.setAngle(Math.PI / 2);
    const p1 = sat.group.children[0]!.position.clone();
    // After a 90° rotation the position should differ — distance between
    // the two points on a circle of radius r is r * sqrt(2).
    const dist = p0.distanceTo(p1);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(2.4);
  });

  it('dispose releases mesh geometry and material', () => {
    const sat = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 0.85 });
    const mesh = sat.group.children.find((c) => c.type === 'Mesh') as THREE.Mesh;
    const geomDisposed = vi.fn();
    const matDisposed = vi.fn();
    mesh.geometry.dispose = geomDisposed as any;
    (mesh.material as THREE.Material).dispose = matDisposed as any;
    sat.dispose();
    expect(geomDisposed).toHaveBeenCalled();
    expect(matDisposed).toHaveBeenCalled();
  });
});
