// src-next/render/three/rimOverlay.test.ts
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildRimOverlay } from './rimOverlay';

describe('buildRimOverlay', () => {
  it('returns a Group with one TorusGeometry mesh', () => {
    const rim = buildRimOverlay({ accentColor: '#7be3ff', dieSize: 0.85 });
    expect(rim.group).toBeInstanceOf(THREE.Group);
    const meshes = rim.group.children.filter((c) => c.type === 'Mesh');
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0] as THREE.Mesh;
    expect(mesh.geometry).toBeInstanceOf(THREE.TorusGeometry);
  });

  it('torus radius hugs the die equator (~die-size / 2 with small outset)', () => {
    const rim = buildRimOverlay({ accentColor: '#7be3ff', dieSize: 1.0 });
    const mesh = rim.group.children.find((c) => c.type === 'Mesh') as THREE.Mesh;
    const torus = mesh.geometry as THREE.TorusGeometry;
    expect(torus.parameters.radius).toBeGreaterThan(0.50);
    expect(torus.parameters.radius).toBeLessThan(0.60);
  });

  it('dispose releases geometry and material', () => {
    const rim = buildRimOverlay({ accentColor: '#7be3ff', dieSize: 0.85 });
    const mesh = rim.group.children.find((c) => c.type === 'Mesh') as THREE.Mesh;
    const geomDisposed = vi.fn();
    const matDisposed = vi.fn();
    mesh.geometry.dispose = geomDisposed as any;
    (mesh.material as THREE.Material).dispose = matDisposed as any;
    rim.dispose();
    expect(geomDisposed).toHaveBeenCalled();
    expect(matDisposed).toHaveBeenCalled();
  });
});
