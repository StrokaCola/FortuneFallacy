import { describe, it, expect, beforeEach, vi } from 'vitest';

type FakeHowl = {
  src: string;
  played: boolean;
  paused: boolean;
  unloaded: boolean;
  vol: number;
  fadeCalls: Array<[number, number, number]>;
};

const howlInstances: FakeHowl[] = [];

vi.mock('howler', () => {
  class Howl {
    private inst: FakeHowl;
    constructor(opts: { src: string[]; loop?: boolean; volume?: number }) {
      this.inst = {
        src: opts.src[0]!,
        played: false,
        paused: false,
        unloaded: false,
        vol: opts.volume ?? 0,
        fadeCalls: [],
      };
      howlInstances.push(this.inst);
    }
    play() { this.inst.played = true; return 1; }
    pause() { this.inst.paused = true; return this; }
    fade(from: number, to: number, durationMs: number) {
      this.inst.fadeCalls.push([from, to, durationMs]);
      this.inst.vol = to;
      return this;
    }
    unload() { this.inst.unloaded = true; }
    volume(v?: number): number { if (v != null) this.inst.vol = v; return this.inst.vol; }
    state() { return 'loaded'; }
  }
  return { Howl, Howler: { volume: vi.fn() } };
});

import { screenMusic } from '../ScreenMusic';

beforeEach(() => {
  howlInstances.length = 0;
  screenMusic.reset();
});

describe('ScreenMusic', () => {
  it('starts a screen track lazily on start()', () => {
    screenMusic.start('hub');
    expect(howlInstances).toHaveLength(1);
    expect(howlInstances[0]!.src).toContain('hub-loop.wav');
    expect(howlInstances[0]!.played).toBe(true);
    expect(howlInstances[0]!.fadeCalls.at(0)?.[1]).toBeGreaterThan(0);
  });

  it('crossfades between two different screens', () => {
    screenMusic.start('hub');
    screenMusic.start('shop');
    expect(howlInstances).toHaveLength(2);
    const oldFade = howlInstances[0]!.fadeCalls.at(-1);
    const newFade = howlInstances[1]!.fadeCalls.at(-1);
    expect(oldFade?.[1]).toBe(0);
    expect(newFade?.[1]).toBeGreaterThan(0);
    expect(oldFade?.[2]).toBe(1500);
    expect(newFade?.[2]).toBe(1500);
  });

  it('start(same) is a no-op', () => {
    screenMusic.start('hub');
    const before = howlInstances.length;
    screenMusic.start('hub');
    expect(howlInstances.length).toBe(before);
  });

  it('stop() fades out the active track', () => {
    screenMusic.start('hub');
    screenMusic.stop();
    const fade = howlInstances[0]!.fadeCalls.at(-1);
    expect(fade?.[1]).toBe(0);
  });

  it('setMaster scales the active track volume target', () => {
    screenMusic.start('hub');
    screenMusic.setMaster(0.5);
    screenMusic.start('shop');
    const shopFade = howlInstances[1]!.fadeCalls.at(-1);
    expect(shopFade?.[1]).toBeLessThanOrEqual(0.5);
    expect(shopFade?.[1]).toBeGreaterThan(0);
  });
});
