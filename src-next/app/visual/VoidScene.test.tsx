import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { VoidScene } from './VoidScene';

afterEach(() => cleanup());

describe('<VoidScene />', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(
      <VoidScene active={false} variant="lyra" tension={0} progress={0} />,
    );
    expect(container.querySelector('[data-testid="void-scene"]')).toBeFalsy();
  });

  it('renders the layer stack when active', () => {
    const { container } = render(
      <VoidScene active={true} variant="lyra" tension={0} progress={0} />,
    );
    const scene = container.querySelector('[data-testid="void-scene"]');
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
    const { container } = render(
      <VoidScene active={true} variant="crimson" tension={0.5} progress={0.5} />,
    );
    const scene = container.querySelector('[data-testid="void-scene"]');
    expect(scene?.getAttribute('data-variant')).toBe('crimson');
  });

  it('forwards tension + progress as CSS custom properties', () => {
    const { container } = render(
      <VoidScene active={true} variant="lyra" tension={0.7} progress={1.2} />,
    );
    const scene = container.querySelector('[data-testid="void-scene"]') as HTMLElement | null;
    expect(scene?.style.getPropertyValue('--tension')).toBe('0.7');
    expect(scene?.style.getPropertyValue('--progress')).toBe('1.2');
  });

  it('clamps out-of-range tension to [0,1] and progress to [0,2]', () => {
    const { container } = render(
      <VoidScene active={true} variant="lyra" tension={5} progress={-3} />,
    );
    const scene = container.querySelector('[data-testid="void-scene"]') as HTMLElement | null;
    expect(scene?.style.getPropertyValue('--tension')).toBe('1');
    expect(scene?.style.getPropertyValue('--progress')).toBe('0');
  });
});
