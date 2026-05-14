import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ModIcon } from './ModIcon';
import { MOD_ICON_SVGS, hasModIconSvg } from '../../data/modIcons';

describe('ModIcon', () => {
  it('renders a registered SVG when one exists for the mod id', () => {
    expect(hasModIconSvg('high_roller')).toBe(true);
    const { container } = render(
      <ModIcon modId="high_roller" fallbackChar="🎯" color="#7be3ff" size={20} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('20');
    // Fallback char must NOT be in the DOM when an SVG renderer is registered.
    expect(container.textContent).not.toContain('🎯');
    cleanup();
  });

  it('renders pyre_mark sigil instead of the 🔥 emoji', () => {
    const { container } = render(
      <ModIcon modId="pyre_mark" fallbackChar="🔥" color="#ff7847" size={24} />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).not.toContain('🔥');
    cleanup();
  });

  it('falls back to the mod\'s icon char when no SVG is registered', () => {
    expect(hasModIconSvg('not_a_real_mod_id')).toBe(false);
    const { container } = render(
      <ModIcon modId="not_a_real_mod_id" fallbackChar="⚖" color="#bba8ff" />,
    );
    expect(container.textContent).toContain('⚖');
    expect(container.querySelector('svg')).toBeNull();
    cleanup();
  });

  it('has both worst-offender emoji mods registered', () => {
    expect(MOD_ICON_SVGS['high_roller']).toBeDefined();
    expect(MOD_ICON_SVGS['pyre_mark']).toBeDefined();
  });
});
