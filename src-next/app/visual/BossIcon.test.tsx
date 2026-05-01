import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BossIcon } from './BossIcon';
import type { BossBlind } from '../../data/blinds';

const fakeBoss: BossBlind = {
  id: 'test', name: 'Test', color: '#ff7847',
  description: '', debuffs: [],
  iconGlyph: { viewBox: '0 0 24 24', paths: ['M 0 0 L 24 24', 'M 12 0 L 12 24'] },
  sigil: { viewBox: '0 0 100 100', groups: [
    { class: 'body-core', paths: ['M 50 50 L 50 50'] },
  ]},
};

describe('BossIcon', () => {
  it('renders one path per iconGlyph.paths entry', () => {
    const { container } = render(<BossIcon boss={fakeBoss} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
  });

  it('uses iconGlyph.viewBox on the svg', () => {
    const { container } = render(<BossIcon boss={fakeBoss} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('applies boss color as stroke', () => {
    const { container } = render(<BossIcon boss={fakeBoss} />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('stroke')).toBe('#ff7847');
  });

  it('defaults size to 16 and accepts override', () => {
    const { container, rerender } = render(<BossIcon boss={fakeBoss} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('16');
    rerender(<BossIcon boss={fakeBoss} size={32} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('32');
  });
});
