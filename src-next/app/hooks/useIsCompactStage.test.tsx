import { describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { useIsCompactStage } from './useIsCompactStage';

let captured = false;
function Probe() {
  captured = useIsCompactStage();
  return null;
}

function setViewportWidth(w: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
}

describe('useIsCompactStage', () => {
  it('returns true when innerWidth < 900', () => {
    setViewportWidth(800);
    render(<Probe />);
    expect(captured).toBe(true);
  });

  it('returns false at the desktop threshold', () => {
    setViewportWidth(1200);
    render(<Probe />);
    expect(captured).toBe(false);
  });

  it('updates on resize events', () => {
    setViewportWidth(1200);
    render(<Probe />);
    expect(captured).toBe(false);
    act(() => {
      setViewportWidth(600);
      window.dispatchEvent(new Event('resize'));
    });
    expect(captured).toBe(true);
  });
});
