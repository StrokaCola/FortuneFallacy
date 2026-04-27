import { describe, it, expect, beforeAll, vi } from 'vitest';

const volumeCalls: Record<string, number[]> = {};
function makeHowl(label: string) {
  return {
    play: vi.fn(),
    volume: vi.fn((v?: number) => {
      if (v != null) {
        volumeCalls[label] = volumeCalls[label] ?? [];
        volumeCalls[label]!.push(v);
      }
    }),
  };
}

vi.mock('howler', () => {
  class MockHowl {
    constructor(opts: { src: string[] }) {
      const label = opts.src[0]!.includes('base') ? 'base'
                  : opts.src[0]!.includes('combo') ? 'combo'
                  : opts.src[0]!.includes('peak') ? 'peak'
                  : 'fail';
      return makeHowl(label) as any;
    }
  }
  return {
    Howl: MockHowl,
    Howler: { ctx: null, volume: vi.fn() },
  };
});

import { audioEngine } from '../AudioEngine';

describe('AudioEngine.setActive', () => {
  beforeAll(() => {
    audioEngine.start();
  });

  it('exposes a setActive method', () => {
    expect(typeof (audioEngine as unknown as { setActive: (b: boolean) => void }).setActive).toBe('function');
  });

  it('clamps all four layer volumes to 0 within ~30 ticks of setActive(false)', async () => {
    audioEngine.bumpHeat(1.0);
    audioEngine.bumpCombo(8);
    await new Promise((r) => setTimeout(r, 100));
    (audioEngine as unknown as { setActive: (b: boolean) => void }).setActive(false);
    await new Promise((r) => setTimeout(r, 600));

    const lastBase = volumeCalls['base']?.at(-1) ?? 1;
    const lastCombo = volumeCalls['combo']?.at(-1) ?? 1;
    const lastPeak = volumeCalls['peak']?.at(-1) ?? 1;
    const lastFail = volumeCalls['fail']?.at(-1) ?? 1;
    expect(lastBase).toBeLessThan(0.05);
    expect(lastCombo).toBeLessThan(0.05);
    expect(lastPeak).toBeLessThan(0.05);
    expect(lastFail).toBeLessThan(0.05);
  });

  it('restores normal mixing after setActive(true)', async () => {
    audioEngine.bumpHeat(1.0);
    (audioEngine as unknown as { setActive: (b: boolean) => void }).setActive(true);
    await new Promise((r) => setTimeout(r, 600));

    const lastBase = volumeCalls['base']?.at(-1) ?? 0;
    expect(lastBase).toBeGreaterThan(0.1);
  });
});
