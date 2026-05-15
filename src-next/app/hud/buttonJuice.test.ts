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

describe('buttonJuice (Wave K tier system)', () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    document.body.innerHTML = '<button class="btn btn-primary">Play Hand</button>';
    vi.spyOn(sfxModule, 'sfxPlay').mockImplementation(() => {});
  });

  afterEach(() => {
    teardown?.();
    teardown = null;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.documentElement.classList.remove('reduce-motion');
  });

  describe('press SFX per tier', () => {
    it('plays uiClick on .btn-primary pointerdown', () => {
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiClick');
    });

    it('plays uiClick on .btn-ghost pointerdown', () => {
      document.body.innerHTML = '<button class="btn btn-ghost">Reroll</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-ghost')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiClick');
    });

    it('plays uiClick on .btn-cta pointerdown', () => {
      document.body.innerHTML = '<button class="btn btn-cta">Begin Challenge</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-cta')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiClick');
    });

    it('plays uiCommit (not uiClick) on .btn-danger pointerdown', () => {
      document.body.innerHTML = '<button class="btn btn-danger">Restore Defaults</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-danger')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiCommit');
      expect(sfxModule.sfxPlay).not.toHaveBeenCalledWith('uiClick');
    });

    it('suppresses uiClick on data-coach="roll-btn" (castSwell already plays)', () => {
      document.body.innerHTML = '<button class="btn btn-ghost" data-coach="roll-btn">Roll</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('[data-coach="roll-btn"]')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      expect(sfxModule.sfxPlay).not.toHaveBeenCalledWith('uiClick');
    });
  });

  describe('disabled-press deflection', () => {
    it('fires uiDenied on disabled button pointerdown', () => {
      document.body.innerHTML = '<button class="btn btn-primary" disabled>Play</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiDenied');
      expect(sfxModule.sfxPlay).not.toHaveBeenCalledWith('uiClick');
    });

    it('marks the disabled button with data-denied for the shake animation', () => {
      document.body.innerHTML = '<button class="btn btn-primary" disabled>Play</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      expect(btn.getAttribute('data-denied')).toBe('true');
    });

    it('disabled press in reduce-motion still plays uiDenied but skips the shake', () => {
      document.documentElement.classList.add('reduce-motion');
      document.body.innerHTML = '<button class="btn btn-primary" disabled>Play</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiDenied');
      expect(btn.getAttribute('data-denied')).toBeNull();
    });
  });

  describe('shockwave per tier', () => {
    it('spawns a primary-variant shockwave on .btn-primary pointerup', () => {
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      btn.dispatchEvent(pointerEvent('pointerup'));
      const wave = document.querySelector('.btn-shockwave');
      expect(wave).not.toBeNull();
      expect(wave!.classList.contains('btn-shockwave-primary')).toBe(true);
    });

    it('spawns a ghost-variant shockwave on .btn-ghost pointerup', () => {
      document.body.innerHTML = '<button class="btn btn-ghost">Reroll</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-ghost')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      btn.dispatchEvent(pointerEvent('pointerup'));
      const wave = document.querySelector('.btn-shockwave');
      expect(wave).not.toBeNull();
      expect(wave!.classList.contains('btn-shockwave-ghost')).toBe(true);
    });

    it('spawns a cta-variant shockwave on .btn-cta pointerup', () => {
      document.body.innerHTML = '<button class="btn btn-cta">Begin Challenge</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-cta')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      btn.dispatchEvent(pointerEvent('pointerup'));
      const wave = document.querySelector('.btn-shockwave');
      expect(wave).not.toBeNull();
      expect(wave!.classList.contains('btn-shockwave-cta')).toBe(true);
    });

    it('spawns a danger-variant shockwave on .btn-danger pointerup', () => {
      document.body.innerHTML = '<button class="btn btn-danger">Forfeit</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-danger')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      btn.dispatchEvent(pointerEvent('pointerup'));
      const wave = document.querySelector('.btn-shockwave');
      expect(wave).not.toBeNull();
      expect(wave!.classList.contains('btn-shockwave-danger')).toBe(true);
    });

    it('skips shockwave when reduce-motion is set', () => {
      document.documentElement.classList.add('reduce-motion');
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown'));
      btn.dispatchEvent(pointerEvent('pointerup'));
      const wave = document.querySelector('.btn-shockwave');
      expect(wave).toBeNull();
    });
  });

  describe('hover SFX per tier', () => {
    it('plays uiHover on .btn-primary mouseover', () => {
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
      btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiHover');
    });

    it('plays uiHover on .btn-cta mouseover', () => {
      document.body.innerHTML = '<button class="btn btn-cta">Begin</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-cta')! as HTMLButtonElement;
      btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiHover');
    });

    it('plays uiHoverSoft (not uiHover) on .btn-ghost mouseover', () => {
      document.body.innerHTML = '<button class="btn btn-ghost">Reroll</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-ghost')! as HTMLButtonElement;
      btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiHoverSoft');
      expect(sfxModule.sfxPlay).not.toHaveBeenCalledWith('uiHover');
    });

    it('plays no hover SFX on .btn-danger mouseover', () => {
      document.body.innerHTML = '<button class="btn btn-danger">Forfeit</button>';
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-danger')! as HTMLButtonElement;
      btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(sfxModule.sfxPlay).not.toHaveBeenCalledWith('uiHover');
      expect(sfxModule.sfxPlay).not.toHaveBeenCalledWith('uiHoverSoft');
    });
  });

  describe('haptics on touch', () => {
    it('fires navigator.vibrate(10) on .btn-primary touch pointerdown', () => {
      const vibrateSpy = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateSpy, configurable: true, writable: true,
      });
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown', 'touch'));
      expect(vibrateSpy).toHaveBeenCalledWith(10);
    });

    it('fires navigator.vibrate(6) on .btn-ghost touch pointerdown', () => {
      document.body.innerHTML = '<button class="btn btn-ghost">Reroll</button>';
      const vibrateSpy = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateSpy, configurable: true, writable: true,
      });
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-ghost')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown', 'touch'));
      expect(vibrateSpy).toHaveBeenCalledWith(6);
    });

    it('fires navigator.vibrate(20) on .btn-danger touch pointerdown', () => {
      document.body.innerHTML = '<button class="btn btn-danger">Forfeit</button>';
      const vibrateSpy = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateSpy, configurable: true, writable: true,
      });
      teardown = installButtonJuice();
      const btn = document.querySelector('.btn-danger')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown', 'touch'));
      expect(vibrateSpy).toHaveBeenCalledWith(20);
    });

    it('still vibrates on roll-btn touch pointerdown (haptic not suppressed)', () => {
      document.body.innerHTML = '<button class="btn btn-ghost" data-coach="roll-btn">Roll</button>';
      const vibrateSpy = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateSpy, configurable: true, writable: true,
      });
      teardown = installButtonJuice();
      const btn = document.querySelector('[data-coach="roll-btn"]')! as HTMLButtonElement;
      btn.dispatchEvent(pointerEvent('pointerdown', 'touch'));
      expect(vibrateSpy).toHaveBeenCalledWith(6);
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
  });

  it('teardown removes all delegated listeners', () => {
    teardown = installButtonJuice();
    teardown();
    teardown = null;
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(pointerEvent('pointerdown'));
    expect(sfxModule.sfxPlay).not.toHaveBeenCalled();
  });
});
