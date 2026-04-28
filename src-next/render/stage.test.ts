import { describe, it, expect } from 'vitest';
import { computeScale, mapClientToStage, STAGE_W, STAGE_H } from './stage';

describe('stage', () => {
  describe('computeScale', () => {
    it('returns 1 when viewport equals stage', () => {
      expect(computeScale(STAGE_W, STAGE_H)).toBe(1);
    });

    it('scales down when viewport smaller than stage', () => {
      expect(computeScale(640, 400)).toBe(0.5);
    });

    it('scales up when viewport larger than stage', () => {
      expect(computeScale(2560, 1600)).toBe(2);
    });

    it('uses the smaller dimension to preserve aspect ratio (letterbox)', () => {
      // wide viewport: letterbox left/right
      expect(computeScale(2560, 800)).toBe(1);
      // tall viewport: letterbox top/bottom
      expect(computeScale(1280, 1600)).toBe(1);
    });

    it('handles landscape phone (iPhone 14, 844x390)', () => {
      const s = computeScale(844, 390);
      // height-bound: 390/800 = 0.4875
      expect(s).toBeCloseTo(0.4875, 4);
    });

    it('returns 1 for non-positive dimensions', () => {
      expect(computeScale(0, 600)).toBe(1);
      expect(computeScale(800, 0)).toBe(1);
      expect(computeScale(-100, 600)).toBe(1);
    });
  });

  describe('mapClientToStage', () => {
    it('returns stage coords when rect matches stage dims', () => {
      const r = { left: 0, top: 0, width: STAGE_W, height: STAGE_H };
      expect(mapClientToStage(640, 400, r)).toEqual({ x: 640, y: 400 });
    });

    it('inverts CSS scale', () => {
      // displayed at half size with 100px offset
      const r = { left: 100, top: 50, width: STAGE_W / 2, height: STAGE_H / 2 };
      // a click at the visual center should map to stage center
      expect(mapClientToStage(100 + STAGE_W / 4, 50 + STAGE_H / 4, r)).toEqual({
        x: STAGE_W / 2,
        y: STAGE_H / 2,
      });
    });

    it('handles top-left of displayed stage', () => {
      const r = { left: 100, top: 50, width: STAGE_W / 2, height: STAGE_H / 2 };
      expect(mapClientToStage(100, 50, r)).toEqual({ x: 0, y: 0 });
    });

    it('handles bottom-right of displayed stage', () => {
      const r = { left: 100, top: 50, width: STAGE_W / 2, height: STAGE_H / 2 };
      expect(mapClientToStage(100 + STAGE_W / 2, 50 + STAGE_H / 2, r)).toEqual({
        x: STAGE_W,
        y: STAGE_H,
      });
    });

    it('returns 0-coords when rect collapses to zero size', () => {
      const r = { left: 100, top: 100, width: 0, height: 0 };
      expect(mapClientToStage(100, 100, r)).toEqual({ x: 0, y: 0 });
    });
  });
});
