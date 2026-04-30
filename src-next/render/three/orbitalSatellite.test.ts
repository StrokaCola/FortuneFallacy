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

  it('chip diameter is ~12% of die size', () => {
    const sat = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 0.85 });
    const mesh = sat.group.children.find((c) => c.type === 'Mesh') as THREE.Mesh;
    const sphere = mesh.geometry as THREE.SphereGeometry;
    // SphereGeometry stores its radius parameter on .parameters
    expect(sphere.parameters.radius).toBeCloseTo(0.85 * 0.06, 3);
  });

  it('setAngle moves the chip in a circular orbit at radius ~die size * 0.7', () => {
    const sat = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 1.0 });
    sat.setAngle(0);
    const p0 = sat.group.children[0]!.position.clone();
    sat.setAngle(Math.PI / 2);
    const p1 = sat.group.children[0]!.position.clone();
    // After a 90° rotation the position should differ — distance between
    // the two points on a circle of radius r is r * sqrt(2).
    const dist = p0.distanceTo(p1);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(2.0);
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
