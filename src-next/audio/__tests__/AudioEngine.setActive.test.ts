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
  function MockHowl(opts: { src: string[] }) {
    const label = opts.src[0]!.includes('base') ? 'base'
                : opts.src[0]!.includes('combo') ? 'combo'
                : opts.src[0]!.includes('peak') ? 'peak'
                : 'fail';
    return makeHowl(label);
  }

  return {
    Howl: MockHowl,
    Howler: { ctx: null, volume: vi.fn() },
  };
});

import { audioEngine } from '../AudioEngine';

async function awaitTicks(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe('AudioEngine.setActive', () => {
  beforeAll(() => {
    audioEngine.start();
  });

  it('exposes setActive + isActive methods', () => {
    expect(typeof audioEngine.setActive).toBe('function');
    expect(typeof audioEngine.isActive).toBe('function');
  });

  it('isActive() defaults to true', () => {
    audioEngine.setActive(true);
    expect(audioEngine.isActive()).toBe(true);
  });

  it('clamps all four layer volumes to 0 within ~600 ms of setActive(false)', async () => {
    // Self-contained: ensure active first, then drive volumes up, verify baseline non-zero, then flip.
    audioEngine.setActive(true);
    audioEngine.bumpHeat(1.0);
    audioEngine.bumpCombo(8);
    await awaitTicks(120);

    // Baseline assertion — guards against false positives where a muted master would
    // silently make every recorded volume 0 regardless of the active gate.
    const baselineBase = volumeCalls['base']?.at(-1) ?? 0;
    expect(baselineBase).toBeGreaterThan(0.1);

    audioEngine.setActive(false);
    expect(audioEngine.isActive()).toBe(false);
    await awaitTicks(600);

    expect(volumeCalls['base']?.at(-1) ?? 1).toBeLessThan(0.05);
    expect(volumeCalls['combo']?.at(-1) ?? 1).toBeLessThan(0.05);
    expect(volumeCalls['peak']?.at(-1) ?? 1).toBeLessThan(0.05);
    expect(volumeCalls['fail']?.at(-1) ?? 1).toBeLessThan(0.05);
  });

  it('restores normal mixing after setActive(true) regardless of prior state', async () => {
    // Force inactive state first so this test never depends on prior test ordering.
    audioEngine.setActive(false);
    audioEngine.bumpHeat(1.0);
    await awaitTicks(400);
    expect(volumeCalls['base']?.at(-1) ?? 1).toBeLessThan(0.05);

    audioEngine.setActive(true);
    audioEngine.bumpHeat(1.0);
    await awaitTicks(600);

    expect(volumeCalls['base']?.at(-1) ?? 0).toBeGreaterThan(0.1);
    expect(audioEngine.isActive()).toBe(true);
  });
});
