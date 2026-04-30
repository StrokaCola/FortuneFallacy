import { describe, it, expect, beforeEach } from 'vitest';
import { hasWebGL, _resetWebGLCache } from './webglDetect';

describe('webglDetect', () => {
  beforeEach(() => _resetWebGLCache());

  it('returns false when canvas.getContext throws', () => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function () { throw new Error('no'); } as any;
    try {
      expect(hasWebGL()).toBe(false);
    } finally {
      HTMLCanvasElement.prototype.getContext = orig;
    }
  });

  it('returns false when getContext returns null (jsdom default)', () => {
    expect(hasWebGL()).toBe(false);
  });

  it('caches the probe result', () => {
    let calls = 0;
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function () { calls++; return null; } as any;
    try {
      hasWebGL();
      const afterFirst = calls;
      hasWebGL();
      hasWebGL();
      expect(calls).toBe(afterFirst);
    } finally {
      HTMLCanvasElement.prototype.getContext = orig;
    }
  });
});
