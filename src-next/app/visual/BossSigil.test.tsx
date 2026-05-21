import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BossSigil } from './BossSigil';
import type { BossBlind } from '../../data/blinds';

const fakeBoss: BossBlind = {
  id: 'test', name: 'Test', color: '#ff7847',
  description: '', debuffs: [],
  iconGlyph: { viewBox: '0 0 24 24', paths: ['M 0 0 L 24 24'] },
  sigil: {
    viewBox: '0 0 100 100',
    groups: [
      { class: 'orbit-main', paths: ['M 10 50 L 90 50'] },
      { class: 'body-core', filled: true, paths: ['M 45 50 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0'] },
      { class: 'satellite', paths: ['M 80 50 L 80 50'] },
      { class: 'mark', dashed: true, opacity: 0.5, paths: ['M 0 0 L 100 100'] },
    ],
  },
};

describe('BossSigil', () => {
  it('renders one <g> per sigil group with correct class hook', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    expect(container.querySelector('.boss-sigil__orbit-main')).toBeTruthy();
    expect(container.querySelector('.boss-sigil__body-core')).toBeTruthy();
    expect(container.querySelector('.boss-sigil__satellite')).toBeTruthy();
    expect(container.querySelector('.boss-sigil__mark')).toBeTruthy();
  });

  it('renders one <path> per group path', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    expect(container.querySelectorAll('path').length).toBe(4);
  });

  it('filled groups get fill=color, stroke=none; non-filled get stroke=color, fill=none', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    const filledPath = container.querySelector('.boss-sigil__body-core path');
    expect(filledPath?.getAttribute('fill')).toBe('#ff7847');
    expect(filledPath?.getAttribute('stroke')).toBe('none');

    const strokedPath = container.querySelector('.boss-sigil__orbit-main path');
    expect(strokedPath?.getAttribute('stroke')).toBe('#ff7847');
    expect(strokedPath?.getAttribute('fill')).toBe('none');
  });

  it('dashed groups apply stroke-dasharray', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    const dashedPath = container.querySelector('.boss-sigil__mark path');
    expect(dashedPath?.getAttribute('stroke-dasharray')).toBe('2 4');
  });

  it("animate='idle' adds .boss-sigil--idle-on but not .boss-sigil--reveal", () => {
    const { container } = render(<BossSigil boss={fakeBoss} animate="idle" />);
    const root = container.querySelector('.boss-sigil');
    expect(root?.classList.contains('boss-sigil--idle-on')).toBe(true);
    expect(root?.classList.contains('boss-sigil--reveal')).toBe(false);
  });

  it("animate='reveal' adds .boss-sigil--reveal but not .boss-sigil--idle-on", () => {
    const { container } = render(<BossSigil boss={fakeBoss} animate="reveal" />);
    const root = container.querySelector('.boss-sigil');
    expect(root?.classList.contains('boss-sigil--reveal')).toBe(true);
    expect(root?.classList.contains('boss-sigil--idle-on')).toBe(false);
  });

  it("animate='both' adds both classes", () => {
    const { container } = render(<BossSigil boss={fakeBoss} animate="both" />);
    const root = container.querySelector('.boss-sigil');
    expect(root?.classList.contains('boss-sigil--idle-on')).toBe(true);
    expect(root?.classList.contains('boss-sigil--reveal')).toBe(true);
  });

  it("animate='none' adds neither class", () => {
    const { container } = render(<BossSigil boss={fakeBoss} animate="none" />);
    const root = container.querySelector('.boss-sigil');
    expect(root?.classList.contains('boss-sigil--idle-on')).toBe(false);
    expect(root?.classList.contains('boss-sigil--reveal')).toBe(false);
  });

  it('default animate is "idle"', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    const root = container.querySelector('.boss-sigil');
    expect(root?.classList.contains('boss-sigil--idle-on')).toBe(true);
  });

  it('exposes --boss-color CSS variable on the svg root', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    const svg = container.querySelector('svg.boss-sigil') as SVGSVGElement;
    expect(svg.style.getPropertyValue('--boss-color')).toBe('#ff7847');
  });

  it("animate='reveal' does not throw on jsdom render", () => {
    // jsdom does not implement getTotalLength; the effect must guard or accept the no-op.
    expect(() => render(<BossSigil boss={fakeBoss} animate="reveal" />)).not.toThrow();
  });

  it('renders the procedural path when proceduralSeed is provided', () => {
    const { container } = render(<BossSigil boss={fakeBoss} proceduralSeed={42} />);
    // The override emits a single <g> with the orbit-main class hook and
    // a single procedurally-generated <path> inside.
    expect(container.querySelector('.boss-sigil__orbit-main')).toBeTruthy();
    expect(container.querySelectorAll('path').length).toBe(1);
    const d = container.querySelector('path')!.getAttribute('d');
    expect(d).toMatch(/^M \d+\.\d+ \d+\.\d+/);
    expect(d!.endsWith('Z')).toBe(true);
  });

  it('procedural override suppresses the catalog groups', () => {
    // Catalog has body-core, satellite, mark groups; with the override
    // they should not render at all.
    const { container } = render(<BossSigil boss={fakeBoss} proceduralSeed={1} />);
    expect(container.querySelector('.boss-sigil__body-core')).toBeNull();
    expect(container.querySelector('.boss-sigil__satellite')).toBeNull();
    expect(container.querySelector('.boss-sigil__mark')).toBeNull();
  });

  it('procedural seed is deterministic — same seed renders the same path', () => {
    const a = render(<BossSigil boss={fakeBoss} proceduralSeed={123} />);
    const b = render(<BossSigil boss={fakeBoss} proceduralSeed={123} />);
    const da = a.container.querySelector('path')!.getAttribute('d');
    const db = b.container.querySelector('path')!.getAttribute('d');
    expect(da).toBe(db);
  });

  it('different procedural seeds render different paths', () => {
    const a = render(<BossSigil boss={fakeBoss} proceduralSeed={1} />);
    const b = render(<BossSigil boss={fakeBoss} proceduralSeed={2} />);
    const da = a.container.querySelector('path')!.getAttribute('d');
    const db = b.container.querySelector('path')!.getAttribute('d');
    expect(da).not.toBe(db);
  });

  it('renders the hand-authored catalog groups when proceduralSeed is undefined', () => {
    // Sanity check that the catalog path (the 4-group fakeBoss above)
    // continues to render unchanged when the procedural override is
    // not engaged.
    const { container } = render(<BossSigil boss={fakeBoss} />);
    expect(container.querySelectorAll('path').length).toBe(4);
    expect(container.querySelector('.boss-sigil__body-core')).toBeTruthy();
    expect(container.querySelector('.boss-sigil__satellite')).toBeTruthy();
    expect(container.querySelector('.boss-sigil__mark')).toBeTruthy();
  });

  it('procedural override uses the 0 0 100 100 viewBox regardless of boss.sigil.viewBox', () => {
    const oddViewBoxBoss: BossBlind = {
      ...fakeBoss,
      sigil: { ...fakeBoss.sigil, viewBox: '-200 -200 400 400' },
    };
    const { container } = render(<BossSigil boss={oddViewBoxBoss} proceduralSeed={9} />);
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 100 100');
  });
});
