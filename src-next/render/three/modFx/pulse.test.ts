// src-next/render/three/modFx/pulse.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as THREE from 'three';
import { firePulse } from './pulse';

// jsdom canvas-2d stub — required because firePulse uses getHaloTexture()
// from buildDie, which paints to a 2d canvas.
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

describe('firePulse', () => {
  it('adds a Sprite to the scene', () => {
    const scene = new THREE.Scene();
    const before = scene.children.length;
    firePulse(scene, new THREE.Vector3(0, 0, 0), '#7be3ff', 0.85);
    expect(scene.children.length).toBe(before + 1);
    const added = scene.children[scene.children.length - 1]!;
    expect(added.type).toBe('Sprite');
  });

  it('returns a dispose handle that removes the sprite from the scene', () => {
    const scene = new THREE.Scene();
    const handle = firePulse(scene, new THREE.Vector3(1, 2, 3), '#7be3ff', 0.85);
    expect(scene.children.length).toBe(1);
    handle.dispose();
    expect(scene.children.length).toBe(0);
  });

  it('positions the sprite at the supplied world position', () => {
    const scene = new THREE.Scene();
    firePulse(scene, new THREE.Vector3(1.5, -2, 0.7), '#7be3ff', 0.85);
    const sprite = scene.children[0] as THREE.Sprite;
    expect(sprite.position.x).toBeCloseTo(1.5);
    expect(sprite.position.y).toBeCloseTo(-2);
    expect(sprite.position.z).toBeCloseTo(0.7);
  });

  it('disposes material on auto-completion (280ms)', async () => {
    const scene = new THREE.Scene();
    firePulse(scene, new THREE.Vector3(), '#7be3ff', 0.85);
    const sprite = scene.children[0] as THREE.Sprite;
    const matDispose = vi.fn();
    (sprite.material as THREE.Material).dispose = matDispose as any;
    // Wait slightly longer than the 280ms animation duration.
    await new Promise((r) => setTimeout(r, 350));
    expect(matDispose).toHaveBeenCalled();
    expect(scene.children.length).toBe(0);
  });
});
