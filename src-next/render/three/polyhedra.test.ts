import { describe, it, expect } from 'vitest';
import { SHAPE_DATA, getFaceCenters, buildPolyhedronGeometry } from './polyhedra';
import type { DieShape } from '../../data/dice';

describe('polyhedra shape data', () => {
  const EXPECTED: Record<Exclude<DieShape, 'd6'>, { vertices: number; faces: number }> = {
    d4:  { vertices: 4,  faces: 4  },
    d8:  { vertices: 6,  faces: 8  },
    d10: { vertices: 12, faces: 10 },
    d12: { vertices: 20, faces: 12 },
    d20: { vertices: 12, faces: 20 },
  };

  for (const shape of Object.keys(EXPECTED) as Exclude<DieShape, 'd6'>[]) {
    it(`${shape} has the expected vertex and face count`, () => {
      const data = SHAPE_DATA[shape];
      expect(data.vertices.length).toBe(EXPECTED[shape].vertices * 3);
      expect(data.faceVertices.length).toBe(EXPECTED[shape].faces);
      expect(data.faceCenters.length).toBe(EXPECTED[shape].faces);
    });

    it(`${shape} face centers are unit length`, () => {
      for (const c of SHAPE_DATA[shape].faceCenters) {
        expect(Math.hypot(c.x, c.y, c.z)).toBeCloseTo(1, 6);
      }
    });

    it(`${shape} face centers are mutually distinct`, () => {
      const centers = SHAPE_DATA[shape].faceCenters;
      for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
          const a = centers[i]!, b = centers[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
          expect(d).toBeGreaterThan(0.05);    // not duplicates
        }
      }
    });
  }
});

describe('getFaceCenters', () => {
  it('returns cube axes for d6', () => {
    const c = getFaceCenters('d6');
    expect(c).toHaveLength(6);
    expect(c[0]).toEqual({ x: 0, y: +1, z: 0 });
    expect(c[5]).toEqual({ x: 0, y: -1, z: 0 });
  });

  it('matches SHAPE_DATA for non-cube shapes', () => {
    expect(getFaceCenters('d20')).toBe(SHAPE_DATA.d20.faceCenters);
  });
});

describe('buildPolyhedronGeometry', () => {
  it('produces a BufferGeometry with position + color attributes', () => {
    const { geometry, vertexCloud } = buildPolyhedronGeometry('d20', 1.0, 0xffffff, 0x000000);
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
    expect(vertexCloud.length).toBe(SHAPE_DATA.d20.vertices.length);
    geometry.dispose();
  });

  it('positions vertices within the requested half-extent', () => {
    const size = 2.0;
    const { vertexCloud } = buildPolyhedronGeometry('d12', size, 0x000000, 0x000000);
    const half = size / 2;
    for (let i = 0; i < vertexCloud.length; i += 3) {
      const r = Math.hypot(vertexCloud[i]!, vertexCloud[i + 1]!, vertexCloud[i + 2]!);
      expect(r).toBeLessThanOrEqual(half + 1e-6);
      expect(r).toBeGreaterThan(half * 0.95);   // unit-sphere * half
    }
  });
});
