// src-next/render/three/DieView.test.tsx
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as sharedRenderer from './sharedRenderer';
import * as webglDetect from './webglDetect';
import * as buildDieMod from './buildDie';
import * as orbitalMod from './orbitalSatellite';
import * as rimMod from './rimOverlay';
import { DieView } from './DieView';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class FakeRenderer {
    domElement = document.createElement('canvas');
    setPixelRatio() {} setSize() {} setScissorTest() {}
    setScissor() {} setViewport() {} render() {} dispose() {}
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

// jsdom doesn't implement canvas 2d context — stub the minimum needed for
// getHaloTexture() inside buildDie so the component can mount without a real GPU.
let origGetContext: typeof HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
    if (type === '2d') {
      const noop = () => {};
      const fakeGradient = { addColorStop: noop };
      return {
        createRadialGradient: () => fakeGradient,
        fillRect: noop,
        set fillStyle(_: unknown) {},
      } as unknown as CanvasRenderingContext2D;
    }
    return origGetContext.call(this, type as any);
  } as typeof HTMLCanvasElement.prototype.getContext;
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = origGetContext;
});

describe('DieView', () => {
  beforeEach(() => {
    sharedRenderer._resetSharedRenderer();
    webglDetect._resetWebGLCache();
    vi.clearAllMocks();
    cleanup();
  });

  it('renders a placeholder div with the requested size when WebGL is available', () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const { container } = render(<DieView size={140} face={3} />);
    const el = container.querySelector('[data-die-view]') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.width).toBe('140px');
    expect(el.style.height).toBe('140px');
  });

  it('registers a view on mount and disposes on unmount', () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const spy = vi.spyOn(sharedRenderer, 'registerView');
    const { unmount } = render(<DieView size={88} />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(sharedRenderer._viewCount()).toBe(1);
    unmount();
    expect(sharedRenderer._viewCount()).toBe(0);
  });

  it('falls back to Die3DCSS when WebGL is unavailable', () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(false);
    const { container } = render(<DieView size={88} face={2} />);
    expect(container.querySelector('.die3d-wrap')).not.toBeNull();
    expect(container.querySelector('[data-die-view]')).toBeNull();
  });

  it('passes the first mod\'s material override to buildDie', () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const spy = vi.spyOn(buildDieMod, 'buildDie');
    const mods = [{ icon: '◆', name: 'Gilded', color: '#f5c451' }];
    // The component looks up by mod.name (case-insensitive). 'Gilded' resolves to
    // the gilded mod whose materialKey is 'gilded' — its bodyTint is 0xf5c451.
    const { unmount } = render(<DieView size={140} face={1} mods={mods} />);
    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    const override = lastCall[2];
    expect(override?.bodyTint).toBe(0xf5c451);
    unmount();
  });

  it('looks up mod by id when available (preferring id over name)', () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const spy = vi.spyOn(buildDieMod, 'buildDie');
    // Pass a "mismatched name" — name says one thing, id says another. The id
    // should win; the override should be the gilded mod's bodyTint.
    const mods = [{ id: 'gilded' as const, icon: '◆', name: 'Renamed', color: '#f5c451' }];
    const { unmount } = render(<DieView size={140} face={1} mods={mods} />);
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(lastCall[2]?.bodyTint).toBe(0xf5c451);
    unmount();
  });

  it("threads the primary mod's geometricVariant into buildDie", () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const spy = vi.spyOn(buildDieMod, 'buildDie');
    // Loaded mod has visual.geometricVariant = 'asymmetric' per Phase 2 wiring.
    const mods = [{ id: 'loaded' as const, icon: '⚔', name: 'Loaded', color: '#c87a4a' }];
    const { unmount } = render(<DieView size={140} face={1} mods={mods} />);
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    // 4th argument is the geometricVariant.
    expect(lastCall[3]).toBe('asymmetric');
    unmount();
  });

  it('builds an orbital satellite when 2 mods are attached', async () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const spy = vi.spyOn(orbitalMod, 'buildOrbitalSatellite');
    const mods = [
      { id: 'gilded' as const, icon: '◆', name: 'Gilded', color: '#f5c451' },
      { id: 'sharpened' as const, icon: '▲', name: 'Sharpened', color: '#a4d4ff' },
    ];
    const { unmount } = render(<DieView size={140} face={1} mods={mods} />);
    expect(spy).toHaveBeenCalled();
    // Secondary's accent color should drive the satellite.
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(lastCall[0].accentColor).toBe('#a4d4ff');
    unmount();
  });

  it('builds rim+satellite when 3 mods are attached (voucher case)', async () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const rimSpy = vi.spyOn(rimMod, 'buildRimOverlay');
    const orbitalSpy = vi.spyOn(orbitalMod, 'buildOrbitalSatellite');
    const mods = [
      { id: 'gilded' as const, icon: '◆', name: 'Gilded', color: '#f5c451' },
      { id: 'sharpened' as const, icon: '▲', name: 'Sharpened', color: '#a4d4ff' },
      { id: 'loaded' as const, icon: '⚔', name: 'Loaded', color: '#c87a4a' },
    ];
    const { unmount } = render(<DieView size={140} face={1} mods={mods} />);
    // 2026-05-11 Phase 3.2 — rim is now built with the full accent
    // array (primary, secondary, tertiary) so the band cycles across
    // all three colors. The secondary accent still appears at index 1.
    expect(rimSpy).toHaveBeenCalled();
    const rimArgs = rimSpy.mock.calls[rimSpy.mock.calls.length - 1]![0];
    expect(rimArgs.accentColors).toBeDefined();
    expect(rimArgs.accentColors).toContain('#a4d4ff'); // secondary still present
    expect(rimArgs.accentColors).toContain('#f5c451'); // primary present too
    // Orbital satellite is built from tertiary's accent.
    expect(orbitalSpy).toHaveBeenCalled();
    expect(orbitalSpy.mock.calls[orbitalSpy.mock.calls.length - 1]![0].accentColor).toBe('#c87a4a');
    unmount();
  });

  it('does NOT build a satellite at size < 80', async () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const spy = vi.spyOn(orbitalMod, 'buildOrbitalSatellite');
    const mods = [
      { id: 'gilded' as const, icon: '◆', name: 'Gilded', color: '#f5c451' },
      { id: 'sharpened' as const, icon: '▲', name: 'Sharpened', color: '#a4d4ff' },
    ];
    const { unmount } = render(<DieView size={56} face={1} mods={mods} />);
    expect(spy).not.toHaveBeenCalled();
    unmount();
  });
});
