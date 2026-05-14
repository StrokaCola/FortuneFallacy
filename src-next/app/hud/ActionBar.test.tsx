// Smoke tests for the shared <ActionBar> component. Pins the
// tight-vs-normal contract that Hub / Title / Shop / Forge will all
// depend on:
//   - tight=true adds `data-action-bar-grow` so the CSS rule applies
//     `flex: 1 1 auto; min-width: <X>px` to each child
//   - tight=false omits the grow attribute; children flow at natural width
//   - the min-width CSS var is set from the prop
//   - children render through unchanged (no React.Children magic)

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ActionBar } from './ActionBar';

afterEach(cleanup);

describe('<ActionBar>', () => {
  it('sets the data-action-bar-grow attribute on tight viewports', () => {
    const { container } = render(
      <ActionBar tight={true}>
        <button>One</button>
        <button>Two</button>
      </ActionBar>,
    );
    const bar = container.querySelector('[data-action-bar]')!;
    expect(bar.getAttribute('data-action-bar-grow')).toBe('true');
  });

  it('omits the grow attribute on non-tight viewports', () => {
    const { container } = render(
      <ActionBar tight={false}>
        <button>One</button>
      </ActionBar>,
    );
    const bar = container.querySelector('[data-action-bar]')!;
    expect(bar.getAttribute('data-action-bar-grow')).toBeNull();
  });

  it('writes the minChildWidth prop into the --action-bar-min-w CSS var', () => {
    const { container } = render(
      <ActionBar tight={true} minChildWidth={120}>
        <button>One</button>
      </ActionBar>,
    );
    const bar = container.querySelector('[data-action-bar]') as HTMLElement;
    expect(bar.style.getPropertyValue('--action-bar-min-w')).toBe('120px');
  });

  it('defaults to 80px min-width', () => {
    const { container } = render(
      <ActionBar tight={true}>
        <button>One</button>
      </ActionBar>,
    );
    const bar = container.querySelector('[data-action-bar]') as HTMLElement;
    expect(bar.style.getPropertyValue('--action-bar-min-w')).toBe('80px');
  });

  it('renders all children in order', () => {
    const { container } = render(
      <ActionBar tight={true}>
        <button>One</button>
        <button>Two</button>
        <button>Three</button>
      </ActionBar>,
    );
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).toEqual(['One', 'Two', 'Three']);
  });

  it('applies a custom gap when provided', () => {
    const { container } = render(
      <ActionBar tight={true} gap={16}>
        <button>One</button>
      </ActionBar>,
    );
    const bar = container.querySelector('[data-action-bar]') as HTMLElement;
    expect(bar.style.gap).toBe('16px');
  });

  it('defaults gap to 4px tight, 12px non-tight', () => {
    const { container: tight } = render(<ActionBar tight={true}><button /></ActionBar>);
    const tightBar = tight.querySelector('[data-action-bar]') as HTMLElement;
    expect(tightBar.style.gap).toBe('4px');
    cleanup();

    const { container: wide } = render(<ActionBar tight={false}><button /></ActionBar>);
    const wideBar = wide.querySelector('[data-action-bar]') as HTMLElement;
    expect(wideBar.style.gap).toBe('12px');
  });
});
