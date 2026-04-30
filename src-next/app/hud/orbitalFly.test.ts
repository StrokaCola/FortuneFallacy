import { describe, it, expect } from 'vitest';
import { computeOrbitalPosition } from './orbitalFly';

describe('computeOrbitalPosition', () => {
  const opts = { startX: 200, startY: 300, endX: 50, endY: 50 };

  it('at t=0 returns start position', () => {
    const p = computeOrbitalPosition(opts, 0);
    expect(p.x).toBeCloseTo(200, 1);
    expect(p.y).toBeCloseTo(300, 1);
  });

  it('at t=0.2 (arc-up stage), y is between start and a point above end', () => {
    const p = computeOrbitalPosition(opts, 0.2);
    expect(p.y).toBeLessThan(opts.startY);
    expect(p.y).toBeGreaterThan(opts.endY - 200);
  });

  it('at t=0.5 (orbit stage), distance from end is ~orbit radius', () => {
    const p = computeOrbitalPosition(opts, 0.5);
    const dx = p.x - opts.endX;
    const dy = p.y - opts.endY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(15);
    expect(dist).toBeLessThan(50);
  });

  it('at t=1 (dock stage end), is at end position', () => {
    const p = computeOrbitalPosition(opts, 1);
    expect(p.x).toBeCloseTo(opts.endX, 1);
    expect(p.y).toBeCloseTo(opts.endY, 1);
  });

  it('opacity at t=0.95 (dock late) is fading', () => {
    const p = computeOrbitalPosition(opts, 0.95);
    expect(p.opacity).toBeLessThan(0.5);
    expect(p.opacity).toBeGreaterThanOrEqual(0);
  });

  it('opacity at t=0.5 (orbit) is full', () => {
    const p = computeOrbitalPosition(opts, 0.5);
    expect(p.opacity).toBeCloseTo(1, 1);
  });
});
