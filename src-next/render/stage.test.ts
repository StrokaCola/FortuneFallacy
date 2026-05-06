import { describe, it, expect } from 'vitest';
import { computeScale, mapClientToStage, STAGE_W, STAGE_H } from './stage';

// Tier 2: layout fills the viewport (no fixed 1280×800 transform-scale).
// `computeScale` is preserved as a pure ratio for callers that want it,
// but `mapClientToStage` is now pass-through because client pixels ARE
// stage pixels.
describe('stage', () => {
  describe('computeScale (pure ratio, no longer drives layout)', () => {
    it('returns 1 when viewport equals nominal stage', () => {
      expect(computeScale(STAGE_W, STAGE_H)).toBe(1);
    });

    it('returns the smaller-dimension ratio', () => {
      expect(computeScale(640, 400)).toBe(0.5);
      expect(computeScale(2560, 1600)).toBe(2);
    });

    it('respects aspect ratio (smaller dim wins)', () => {
      expect(computeScale(2560, 800)).toBe(1);
      expect(computeScale(1280, 1600)).toBe(1);
    });

    it('returns 1 for non-positive dimensions', () => {
      expect(computeScale(0, 600)).toBe(1);
      expect(computeScale(800, 0)).toBe(1);
      expect(computeScale(-100, 600)).toBe(1);
    });
  });

  describe('mapClientToStage (pass-through in tier 2)', () => {
    it('subtracts rect origin and returns client coords directly', () => {
      const r = { left: 0, top: 0, width: 1024, height: 768 };
      expect(mapClientToStage(640, 400, r)).toEqual({ x: 640, y: 400 });
    });

    it('handles offset rects', () => {
      const r = { left: 100, top: 50, width: 800, height: 600 };
      expect(mapClientToStage(100, 50, r)).toEqual({ x: 0, y: 0 });
      expect(mapClientToStage(900, 650, r)).toEqual({ x: 800, y: 600 });
    });

    it('does not divide-by-zero on collapsed rects', () => {
      const r = { left: 100, top: 100, width: 0, height: 0 };
      expect(mapClientToStage(100, 100, r)).toEqual({ x: 0, y: 0 });
    });
  });
});
