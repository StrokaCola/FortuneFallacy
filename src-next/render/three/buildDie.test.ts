// src-next/render/three/buildDie.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { buildDie, STYLES, PIPS, FACE_DEFS } from './buildDie';

// jsdom doesn't implement canvas 2d context — stub the minimum needed for
// getHaloTexture() so the mesh-construction tests can run without a real GPU.
let origGetContext: typeof HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
    if (type === '2d') {
      const noop = () => {};
      const fakeGradient = { addColorStop: noop };
      return {
        createRadialGradient: () => fakeGradient,
        fillRect: noop,
        set fillStyle(_: unknown) {},
      } as unknown as CanvasRenderingContext2D;
    }
    return origGetContext.call(this, type as any);
  } as typeof HTMLCanvasElement.prototype.getContext;
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = origGetContext;
});

describe('buildDie', () => {
  it('exports 5 known styles', () => {
    expect(Object.keys(STYLES).sort()).toEqual(
      ['celestial', 'ember', 'glass', 'ivory', 'obsidian'],
    );
  });

  it('exports pip layouts for faces 1..6', () => {
    for (let f = 1; f <= 6; f++) expect(PIPS[f]?.length).toBe(f);
  });

  it('FACE_DEFS lists all 6 faces with axis+sign', () => {
    expect(FACE_DEFS).toHaveLength(6);
    const vals = FACE_DEFS.map((d) => d.val).sort();
    expect(vals).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('returns a Group with body, edge lines, and a pip group', () => {
    const built = buildDie(0.85, 'celestial');
    expect(built.group).toBeInstanceOf(THREE.Group);
    const names = built.group.children.map((c: { name: string }) => c.name);
    expect(names).toContain('Body');
    expect(names).toContain('pips');
    expect(built.faceLensMats[1]).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(built.faceHaloMats[1]).toBeInstanceOf(THREE.SpriteMaterial);
  });

  it('respects modOverride bodyTint over base style', () => {
    const built = buildDie(0.85, 'celestial', { bodyTint: 0xff0000, bodyDeep: 0x000000 });
    const body = built.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    const mat = body.material as THREE.MeshPhysicalMaterial;
    // sheenColor defaults to bodyTint when not overridden — so it should be red.
    expect(mat.sheenColor.getHex()).toBe(0xff0000);
  });

  it('respects modOverride.metalness', () => {
    const built = buildDie(0.85, 'celestial', { metalness: 0.85 });
    const body = built.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    const mat = body.material as THREE.MeshPhysicalMaterial;
    expect(mat.metalness).toBe(0.85);
  });

  it('without modOverride, base style metalness defaults to 0', () => {
    const built = buildDie(0.85, 'celestial');
    const body = built.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    const mat = body.material as THREE.MeshPhysicalMaterial;
    expect(mat.metalness).toBe(0);
  });
});
