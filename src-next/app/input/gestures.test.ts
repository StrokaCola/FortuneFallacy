import { describe, it, expect } from 'vitest';
import { classifyPointerSequence } from './gestures';

describe('classifyPointerSequence', () => {
  it('tap: short, no movement', () => {
    expect(classifyPointerSequence({ durationMs: 100, dx: 0, dy: 0, longPressFired: false }))
      .toEqual({ kind: 'tap' });
  });

  it('tap: at boundary (250ms, 8px)', () => {
    expect(classifyPointerSequence({ durationMs: 250, dx: 5, dy: 5, longPressFired: false }))
      .toEqual({ kind: 'tap' });
  });

  it('not tap: too long', () => {
    expect(classifyPointerSequence({ durationMs: 300, dx: 0, dy: 0, longPressFired: false }))
      .toEqual({ kind: 'none' });
  });

  it('longPress: fired during hold', () => {
    expect(classifyPointerSequence({ durationMs: 600, dx: 2, dy: 2, longPressFired: true }))
      .toEqual({ kind: 'longPress' });
  });

  it('longPress wins over swipe when both could fit', () => {
    expect(classifyPointerSequence({ durationMs: 600, dx: 100, dy: 0, longPressFired: true }))
      .toEqual({ kind: 'longPress' });
  });

  it('swipe right: 32px+ horizontal', () => {
    expect(classifyPointerSequence({ durationMs: 200, dx: 40, dy: 5, longPressFired: false }))
      .toEqual({ kind: 'swipe', dir: 'right' });
  });

  it('swipe left', () => {
    expect(classifyPointerSequence({ durationMs: 200, dx: -50, dy: 0, longPressFired: false }))
      .toEqual({ kind: 'swipe', dir: 'left' });
  });

  it('swipe up', () => {
    expect(classifyPointerSequence({ durationMs: 200, dx: 0, dy: -40, longPressFired: false }))
      .toEqual({ kind: 'swipe', dir: 'up' });
  });

  it('swipe down', () => {
    expect(classifyPointerSequence({ durationMs: 200, dx: 5, dy: 60, longPressFired: false }))
      .toEqual({ kind: 'swipe', dir: 'down' });
  });

  it('mid-distance, slow: none', () => {
    expect(classifyPointerSequence({ durationMs: 1000, dx: 15, dy: 15, longPressFired: false }))
      .toEqual({ kind: 'none' });
  });
});
