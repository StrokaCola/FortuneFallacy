import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { BlackHole } from './BlackHole';

// Vitest doesn't auto-run @testing-library/react's cleanup, and other
// tests in this folder use `container.querySelector` to side-step that.
// We need scoped queries here, so explicitly clean up between tests.
afterEach(() => cleanup());

describe('<BlackHole />', () => {
  it('renders an SVG black hole element', () => {
    const { container } = render(<BlackHole onClick={() => {}} />);
    expect(container.querySelector('svg[data-testid="blackhole-svg"]')).toBeTruthy();
  });

  it('invokes onClick when the hole is clicked', () => {
    const onClick = vi.fn();
    const { getByTestId } = render(<BlackHole onClick={onClick} />);
    fireEvent.click(getByTestId('blackhole-hitbox'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has an accessible label', () => {
    const { getByLabelText } = render(<BlackHole onClick={() => {}} />);
    expect(getByLabelText(/void mode/i)).toBeTruthy();
  });
});
