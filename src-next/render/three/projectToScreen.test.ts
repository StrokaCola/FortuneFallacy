import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { projectToScreen } from './projectToScreen';

// Build a small orthographic camera looking down +Z so world XY maps cleanly
// to NDC — keeps the assertions intuitive.
function makeCamera(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.set(0, 0, 5);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

describe('projectToScreen', () => {
  it('maps origin to rect center', () => {
    const cam = makeCamera();
    const rect = new DOMRect(0, 0, 200, 100);
    const out = projectToScreen(new THREE.Vector3(0, 0, 0), cam, rect);
    expect(out.x).toBeCloseTo(100, 5);
    expect(out.y).toBeCloseTo(50, 5);
    expect(out.inView).toBe(true);
  });

  it('respects rect offsets', () => {
    const cam = makeCamera();
    const rect = new DOMRect(40, 20, 100, 100);
    const out = projectToScreen(new THREE.Vector3(0, 0, 0), cam, rect);
    expect(out.x).toBeCloseTo(40 + 50, 5);
    expect(out.y).toBeCloseTo(20 + 50, 5);
  });

  it('maps +x world to right edge', () => {
    const cam = makeCamera();
    const rect = new DOMRect(0, 0, 100, 100);
    const out = projectToScreen(new THREE.Vector3(1, 0, 0), cam, rect);
    expect(out.x).toBeCloseTo(100, 5);
    expect(out.inView).toBe(true);
  });

  it('flags points outside the frustum as not in view', () => {
    const cam = makeCamera();
    const rect = new DOMRect(0, 0, 100, 100);
    const out = projectToScreen(new THREE.Vector3(5, 0, 0), cam, rect);
    expect(out.inView).toBe(false);
  });

  it('flips Y so world +y maps to lower pixel y (above center)', () => {
    const cam = makeCamera();
    const rect = new DOMRect(0, 0, 100, 100);
    const out = projectToScreen(new THREE.Vector3(0, 1, 0), cam, rect);
    expect(out.y).toBeCloseTo(0, 5);
  });
});
