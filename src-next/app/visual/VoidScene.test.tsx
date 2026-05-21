import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { VoidScene } from './VoidScene';

// VoidScene portals into #void-root (a static node in index.html
// alongside #cosmos-root / #three-next / #next-root). Tests provision
// the same host on document.body and query against it.
beforeEach(() => {
  const root = document.createElement('div');
  root.id = 'void-root';
  document.body.appendChild(root);
});

afterEach(() => {
  cleanup();
  document.getElementById('void-root')?.remove();
});

function getScene(): HTMLElement | null {
  return document.querySelector('#void-root [data-testid="void-scene"]') as HTMLElement | null;
}

describe('<VoidScene />', () => {
  it('renders nothing when active is false', () => {
    render(<VoidScene active={false} variant="lyra" tension={0} progress={0} />);
    expect(getScene()).toBeFalsy();
  });

  it('renders the layer stack when active', () => {
    render(<VoidScene active={true} variant="lyra" tension={0} progress={0} />);
    const scene = getScene();
    expect(scene).toBeTruthy();
    // 11 named cosmetic layers from the design — confirm they all mount.
    expect(scene?.querySelector('.bg-void')).toBeTruthy();
    expect(scene?.querySelector('.bg-streaks')).toBeTruthy();
    expect(scene?.querySelector('.bg-stardust')).toBeTruthy();
    expect(scene?.querySelectorAll('.void-shell').length).toBe(3);
    expect(scene?.querySelector('.web-svg')).toBeTruthy();
    expect(scene?.querySelector('.accretion-halo')).toBeTruthy();
    expect(scene?.querySelector('.accretion-disk')).toBeTruthy();
    expect(scene?.querySelectorAll('.photon-orbits').length).toBe(2);
    expect(scene?.querySelector('.photon-ring')).toBeTruthy();
    expect(scene?.querySelector('.event-horizon')).toBeTruthy();
    expect(scene?.querySelector('.bg-tension-wash')).toBeTruthy();
    expect(scene?.querySelector('.bg-progress-underwash')).toBeTruthy();
    expect(scene?.querySelector('.bg-progress-halo')).toBeTruthy();
  });

  it('applies the variant via data-variant', () => {
    render(<VoidScene active={true} variant="crimson" tension={0.5} progress={0.5} />);
    expect(getScene()?.getAttribute('data-variant')).toBe('crimson');
  });

  it('forwards tension + progress as CSS custom properties', () => {
    render(<VoidScene active={true} variant="lyra" tension={0.7} progress={1.2} />);
    const scene = getScene();
    expect(scene?.style.getPropertyValue('--tension')).toBe('0.7');
    expect(scene?.style.getPropertyValue('--progress')).toBe('1.2');
  });

  it('clamps out-of-range tension to [0,1] and progress to [0,2]', () => {
    render(<VoidScene active={true} variant="lyra" tension={5} progress={-3} />);
    const scene = getScene();
    expect(scene?.style.getPropertyValue('--tension')).toBe('1');
    expect(scene?.style.getPropertyValue('--progress')).toBe('0');
  });

  it('returns null when #void-root is absent', () => {
    document.getElementById('void-root')?.remove();
    render(<VoidScene active={true} variant="lyra" tension={0} progress={0} />);
    expect(getScene()).toBeFalsy();
  });
});
