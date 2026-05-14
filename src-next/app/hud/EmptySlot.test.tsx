import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { EmptySlot } from './EmptySlot';

describe('EmptySlot', () => {
  it('renders the catalyst-flavour ghost when kind="catalyst"', () => {
    const { container } = render(<EmptySlot kind="catalyst" />);
    expect(container.textContent).toContain('catalyst');
    expect(container.textContent).toContain('none yet');
    expect(container.textContent).toContain('Buy them at the Bazaar');
    cleanup();
  });

  it('renders the consumable-flavour ghost when kind="consumable"', () => {
    const { container } = render(<EmptySlot kind="consumable" />);
    expect(container.textContent).toContain('consumable');
    expect(container.textContent).toContain('Galaxies level up');
    cleanup();
  });

  it('respects a `hint` override over the default copy', () => {
    const { container } = render(<EmptySlot kind="catalyst" hint="Custom nudge." />);
    expect(container.textContent).toContain('Custom nudge.');
    expect(container.textContent).not.toContain('Buy them at the Bazaar');
    cleanup();
  });

  it('carries .has-tip + role="img" + aria-label for screen readers', () => {
    const { container } = render(<EmptySlot kind="catalyst" />);
    const root = container.firstElementChild;
    expect(root?.classList.contains('has-tip')).toBe(true);
    expect(root?.getAttribute('role')).toBe('img');
    expect(root?.getAttribute('aria-label')).toContain('No catalyst owned');
    cleanup();
  });
});
