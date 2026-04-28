import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as audioSettings from './audioSettings';

describe('audioSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when localStorage empty (master=0.7, music=1.0, sfx=1.0)', () => {
    expect(audioSettings.getMaster()).toBe(0.7);
    expect(audioSettings.getMusic()).toBe(1.0);
    expect(audioSettings.getSfx()).toBe(1.0);
  });

  it('setMaster persists and getMaster reads back', () => {
    audioSettings.setMaster(0.5);
    expect(audioSettings.getMaster()).toBe(0.5);
    expect(localStorage.getItem('ff_next_masterVol')).toBe('0.5');
  });

  it('setMusic and setSfx persist to their respective keys', () => {
    audioSettings.setMusic(0.3);
    audioSettings.setSfx(0.9);
    expect(localStorage.getItem('ff_next_audioVol')).toBe('0.3');
    expect(localStorage.getItem('ff_next_sfxVol')).toBe('0.9');
  });

  it('clamps values to [0, 1]', () => {
    audioSettings.setMaster(-0.5);
    expect(audioSettings.getMaster()).toBe(0);
    audioSettings.setMaster(1.5);
    expect(audioSettings.getMaster()).toBe(1);
  });

  it('subscribers fire on each setter call', () => {
    const fn = vi.fn();
    audioSettings.subscribe(fn);
    audioSettings.setMaster(0.5);
    audioSettings.setMusic(0.5);
    audioSettings.setSfx(0.5);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('unsubscribe stops further notifications', () => {
    const fn = vi.fn();
    const off = audioSettings.subscribe(fn);
    audioSettings.setMaster(0.5);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    audioSettings.setMaster(0.6);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
