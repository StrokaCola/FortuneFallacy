// src-next/render/three/modFx/backstop.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { fireBackstop } from './backstop';

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

describe('fireBackstop', () => {
  it('returns a dispose handle', () => {
    const scene = new THREE.Scene();
    const handle = fireBackstop(scene, new THREE.Vector3(), 0.85);
    expect(typeof handle.dispose).toBe('function');
    handle.dispose();
  });

  it('adds at least one Sprite to the scene', () => {
    const scene = new THREE.Scene();
    const handle = fireBackstop(scene, new THREE.Vector3(), 0.85);
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBeGreaterThanOrEqual(1);
    handle.dispose();
  });

  it('disposes early via handle', () => {
    const scene = new THREE.Scene();
    const handle = fireBackstop(scene, new THREE.Vector3(), 0.85);
    handle.dispose();
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBe(0);
  });

  it('auto-disposes by ~700ms (after the 650ms sequence)', async () => {
    const scene = new THREE.Scene();
    fireBackstop(scene, new THREE.Vector3(), 0.85);
    await new Promise((r) => setTimeout(r, 800));
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBe(0);
  });
});
