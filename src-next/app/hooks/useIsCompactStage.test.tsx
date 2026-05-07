import { describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { useIsCompactStage, useIsTightStage } from './useIsCompactStage';

let captured = false;
function Probe() {
  captured = useIsCompactStage();
  return null;
}

let capturedTight = false;
function TightProbe() {
  capturedTight = useIsTightStage();
  return null;
}

function setViewport(w: number, h: number = 1080) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

describe('useIsCompactStage', () => {
  it('returns true when innerWidth < 900', () => {
    setViewport(800);
    render(<Probe />);
    expect(captured).toBe(true);
  });

  it('returns true when innerHeight < 700 (phone landscape)', () => {
    setViewport(1200, 540);
    render(<Probe />);
    expect(captured).toBe(true);
  });

  it('returns false at the desktop threshold', () => {
    setViewport(1200, 1080);
    render(<Probe />);
    expect(captured).toBe(false);
  });

  it('updates on resize events', () => {
    setViewport(1200, 1080);
    render(<Probe />);
    expect(captured).toBe(false);
    act(() => {
      setViewport(600);
      window.dispatchEvent(new Event('resize'));
    });
    expect(captured).toBe(true);
  });
});

describe('useIsTightStage', () => {
  it('returns true when width < 720', () => {
    setViewport(680, 800);
    render(<TightProbe />);
    expect(capturedTight).toBe(true);
  });

  it('returns true when height < 600 (phone landscape at DPR=2)', () => {
    setViewport(1170, 540);
    render(<TightProbe />);
    expect(capturedTight).toBe(true);
  });

  it('returns true when height is well below threshold', () => {
    setViewport(1200, 480);
    render(<TightProbe />);
    expect(capturedTight).toBe(true);
  });

  it('returns false when both dimensions are spacious', () => {
    setViewport(1280, 800);
    render(<TightProbe />);
    expect(capturedTight).toBe(false);
  });

  it('updates on resize', () => {
    setViewport(1280, 800);
    render(<TightProbe />);
    expect(capturedTight).toBe(false);
    act(() => {
      setViewport(900, 400);
      window.dispatchEvent(new Event('resize'));
    });
    expect(capturedTight).toBe(true);
  });
});
