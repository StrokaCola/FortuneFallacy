import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { VoidHudBadge } from './VoidHudBadge';

afterEach(() => cleanup());

describe('<VoidHudBadge />', () => {
  it('renders seed (hex) + alias', () => {
    const { getByText } = render(
      <VoidHudBadge seed={0x1a2b3c4d} alias="Echo 17" certified={false} />
    );
    expect(getByText(/echo 17/i)).toBeTruthy();
    expect(getByText(/1a2b3c4d/i)).toBeTruthy();
  });

  it('shows a Certified badge when certified is true', () => {
    const { getByText } = render(
      <VoidHudBadge seed={1} alias="Echo 17" certified={true} />
    );
    expect(getByText(/certified/i)).toBeTruthy();
  });

  it('shows an Uncertified caveat when certified is false', () => {
    const { getByText } = render(
      <VoidHudBadge seed={1} alias="Echo 17" certified={false} />
    );
    expect(getByText(/uncertified/i)).toBeTruthy();
  });
});
