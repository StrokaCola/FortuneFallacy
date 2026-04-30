import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installButtonJuice } from './buttonJuice';
import * as sfxModule from '../../audio/sfx';

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

  it('plays uiClick on .btn-primary mousedown', () => {
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiClick');
  });

  it('plays uiHover on .btn-primary mouseover (delegated)', () => {
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiHover');
  });

  it('spawns a .btn-shockwave element on mouseup', () => {
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const shockwave = document.querySelector('.btn-shockwave');
    expect(shockwave).not.toBeNull();
  });

  it('teardown removes all delegated listeners', () => {
    teardown = installButtonJuice();
    teardown();
    teardown = null;
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(sfxModule.sfxPlay).not.toHaveBeenCalled();
  });

  it('skips shockwave when reduce-motion is set', () => {
    document.documentElement.classList.add('reduce-motion');
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const shockwave = document.querySelector('.btn-shockwave');
    expect(shockwave).toBeNull();
    document.documentElement.classList.remove('reduce-motion');
  });
});
