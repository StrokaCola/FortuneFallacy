// src-next/render/three/sharedRenderer.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  registerView, _viewCount, _resetSharedRenderer,
} from './sharedRenderer';

// jsdom can't create a real WebGL context — stub the renderer constructor.
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class FakeRenderer {
    domElement = document.createElement('canvas');
    setPixelRatio() {}
    setSize() {}
    setScissorTest() {}
    setScissor() {}
    setViewport() {}
    render() {}
    dispose() {}
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

describe('sharedRenderer', () => {
  beforeEach(() => _resetSharedRenderer());

  it('starts with zero views', () => {
    expect(_viewCount()).toBe(0);
  });

  it('registerView increments count and dispose decrements it', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const dispose = registerView({
      scene, camera,
      getRect: () => new DOMRect(0, 0, 100, 100),
    });
    expect(_viewCount()).toBe(1);
    dispose();
    expect(_viewCount()).toBe(0);
  });

  it('supports multiple concurrent views', () => {
    const a = registerView({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), getRect: () => new DOMRect() });
    const b = registerView({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), getRect: () => new DOMRect() });
    expect(_viewCount()).toBe(2);
    a();
    expect(_viewCount()).toBe(1);
    b();
    expect(_viewCount()).toBe(0);
  });
});
