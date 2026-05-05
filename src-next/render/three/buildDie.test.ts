// src-next/render/three/buildDie.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { buildDie, STYLES, PIPS, FACE_DEFS } from './buildDie';

// jsdom doesn't implement canvas 2d context — stub the minimum needed for
// getHaloTexture() and the digit-texture path so the mesh-construction
// tests can run without a real GPU.
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
        clearRect: noop,
        fillText: noop,
        strokeText: noop,
        set fillStyle(_: unknown) {},
        set strokeStyle(_: unknown) {},
        set lineWidth(_: unknown) {},
        set font(_: unknown) {},
        set textAlign(_: unknown) {},
        set textBaseline(_: unknown) {},
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

  it("plated variant uses a larger RoundedBoxGeometry chamfer radius", () => {
    const baseline = buildDie(0.85, 'celestial');
    const plated = buildDie(0.85, 'celestial', undefined, 'plated');
    const baseBody = baseline.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    const platedBody = plated.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    // RoundedBoxGeometry stores its radius parameter on .parameters.radius.
    const baseRadius = (baseBody.geometry as any).parameters.radius as number;
    const platedRadius = (platedBody.geometry as any).parameters.radius as number;
    expect(platedRadius).toBeGreaterThan(baseRadius);
    expect(platedRadius).toBeCloseTo(0.85 * 0.26, 4);
  });

  it("asymmetric variant nudges +Y face vertices inward", () => {
    const baseline = buildDie(0.85, 'celestial');
    const asym = buildDie(0.85, 'celestial', undefined, 'asymmetric');
    const baseBody = baseline.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    const asymBody = asym.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    const basePos = baseBody.geometry.attributes.position!;
    const asymPos = asymBody.geometry.attributes.position!;
    // Find the maximum Y across all vertices for each. Asymmetric should have
    // a smaller max-Y because the +Y face was nudged inward.
    let baseMaxY = -Infinity;
    let asymMaxY = -Infinity;
    for (let i = 0; i < basePos.count; i++) baseMaxY = Math.max(baseMaxY, basePos.getY(i));
    for (let i = 0; i < asymPos.count; i++) asymMaxY = Math.max(asymMaxY, asymPos.getY(i));
    expect(asymMaxY).toBeLessThan(baseMaxY);
    // The displacement should be subtle — at most ~5% of die size below the
    // baseline's max-Y. (Spec calls for "subtle, not exaggerated".)
    expect(baseMaxY - asymMaxY).toBeLessThan(0.85 * 0.05);
  });

  it("routes non-canonical d6 specs (Eclipse [0,0,0,1,1,1]) to the digit-texture path", () => {
    // Regression for the binary-dice display bug: Eclipse rolls 0/1 and
    // expects digit textures on each face, not the standard 1..6 pip pattern.
    const built = buildDie(0.85, 'celestial', undefined, undefined, 'd6', [0, 0, 0, 1, 1, 1]);
    expect(built.group.name).toBe('FortuneFallacyDie_d6digits');
  });

  it("routes plain d6 specs to the standard pip cube path", () => {
    const built = buildDie(0.85, 'celestial', undefined, undefined, 'd6', [1, 2, 3, 4, 5, 6]);
    expect(built.group.name).toBe('FortuneFallacyDie_celestial');
  });

  it("recessed variant places pip orbs deeper inside the body", () => {
    const baseline = buildDie(0.85, 'celestial');
    const recessed = buildDie(0.85, 'celestial', undefined, 'recessed');
    // First face's first pip has the orb mesh at index 0 within its faceGroup.
    // We can grab it via pipGroup.children[0].children[0].
    const baseFirstFaceGroup = baseline.pipGroup.children[0]!;
    const recFirstFaceGroup = recessed.pipGroup.children[0]!;
    const baseOrb = baseFirstFaceGroup.children[0] as THREE.Mesh;
    const recOrb = recFirstFaceGroup.children[0] as THREE.Mesh;
    // Orb is sunk along local -Z; smaller (more negative) z = deeper.
    expect(recOrb.position.z).toBeLessThan(baseOrb.position.z);
    // Recessed should match `size * 0.16` exactly.
    expect(recOrb.position.z).toBeCloseTo(-0.85 * 0.16, 4);
    // Baseline should match `size * 0.10`.
    expect(baseOrb.position.z).toBeCloseTo(-0.85 * 0.10, 4);
  });
});
