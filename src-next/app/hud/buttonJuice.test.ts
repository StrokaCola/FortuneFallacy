import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installButtonJuice } from './buttonJuice';
import * as sfxModule from '../../audio/sfx';

// Helper: dispatch a PointerEvent in jsdom. The built-in PointerEvent
// constructor isn't always available; fall back to a synthesized
// MouseEvent with a pointerType field that jsdom forwards to handlers.
function pointerEvent(type: string, pointerType: 'mouse' | 'touch' | 'pen' = 'mouse'): Event {
  try {
    return new PointerEvent(type, { bubbles: true, pointerType });
  } catch {
    const ev = new MouseEvent(type, { bubbles: true }) as MouseEvent & { pointerType?: string };
    ev.pointerType = pointerType;
    return ev;
  }
}

describe('buttonJuice', () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    document.body.innerHTML = '<button class="btn-primary">Roll</button>';
    vi.spyOn(sfxModule, 'sfxPlay').mockImplementation(() => {});
  });

  afterEach(() => {
    teardown?.();
    teardown = null;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('plays uiClick on .btn-primary pointerdown', () => {
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(pointerEvent('pointerdown'));
    expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiClick');
  });

  it('plays uiHover on .btn-primary mouseover (delegated)', () => {
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiHover');
  });

  it('spawns a .btn-shockwave element on pointerup', () => {
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(pointerEvent('pointerdown'));
    btn.dispatchEvent(pointerEvent('pointerup'));
    const shockwave = document.querySelector('.btn-shockwave');
    expect(shockwave).not.toBeNull();
  });

  it('fires navigator.vibrate(10) on touch pointerdown', () => {
    const vibrateSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateSpy, configurable: true, writable: true,
    });
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(pointerEvent('pointerdown', 'touch'));
    expect(vibrateSpy).toHaveBeenCalledWith(10);
  });

  it('does NOT vibrate on mouse pointerdown', () => {
    const vibrateSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateSpy, configurable: true, writable: true,
    });
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(pointerEvent('pointerdown', 'mouse'));
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it('teardown removes all delegated listeners', () => {
    teardown = installButtonJuice();
    teardown();
    teardown = null;
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(pointerEvent('pointerdown'));
    expect(sfxModule.sfxPlay).not.toHaveBeenCalled();
  });

  it('skips shockwave when reduce-motion is set', () => {
    document.documentElement.classList.add('reduce-motion');
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(pointerEvent('pointerdown'));
    btn.dispatchEvent(pointerEvent('pointerup'));
    const shockwave = document.querySelector('.btn-shockwave');
    expect(shockwave).toBeNull();
    document.documentElement.classList.remove('reduce-motion');
  });
});
