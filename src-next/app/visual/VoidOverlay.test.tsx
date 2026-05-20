import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { VoidOverlay } from './VoidOverlay';

afterEach(() => cleanup());

describe('<VoidOverlay />', () => {
  it('renders a fixed-position tint container when active', () => {
    const { container } = render(<VoidOverlay active={true} />);
    expect(container.querySelector('[data-testid="void-overlay"]')).toBeTruthy();
  });

  it('renders nothing when active is false', () => {
    const { container } = render(<VoidOverlay active={false} />);
    expect(container.querySelector('[data-testid="void-overlay"]')).toBeFalsy();
  });
});
