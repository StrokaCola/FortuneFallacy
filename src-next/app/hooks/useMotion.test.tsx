import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useMotion } from './useMotion';

function Probe() {
  useMotion();
  return null;
}

describe('useMotion', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('reduce-motion');
  });
  afterEach(() => {
    document.documentElement.classList.remove('reduce-motion');
  });

  it('adds .reduce-motion when prefers-reduced-motion matches', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches: q === '(prefers-reduced-motion: reduce)',
        media: q,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    render(<Probe />);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
  });

  it('omits .reduce-motion when media query does not match', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches: false,
        media: q,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    render(<Probe />);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(false);
  });
});
