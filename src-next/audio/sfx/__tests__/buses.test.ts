import { describe, it, expect, beforeAll, vi } from 'vitest';

// Tone.js cannot run under jsdom (no Web Audio). Mock the surface that
// `buses.ts` touches with lightweight stubs that record connections and
// expose AudioParam-shaped properties so triggerDuck can schedule.
const mockState = vi.hoisted(() => ({
  connections: [] as unknown[][],
  rampCalls: [] as unknown[][],
}));

vi.mock('tone', () => {
  class FakeParam {
    value = 1;
    cancelScheduledValues = vi.fn();
    cancelAndHoldAtTime = vi.fn();
    setValueAtTime = vi.fn();
    linearRampToValueAtTime = vi.fn((v: number, t: number) => {
      mockState.rampCalls.push([v, t]);
    });
    setTargetAtTime = vi.fn();
  }
  class Node {
    connect(dst: unknown) { mockState.connections.push([this, dst]); return this; }
    disconnect() { return this; }
    toDestination() { return this; }
    dispose() { return this; }
  }
  class Gain extends Node {
    gain = new FakeParam();
    constructor(v?: number) { super(); if (typeof v === 'number') this.gain.value = v; }
  }
  class EQ3 extends Node {
    low = new FakeParam();
    mid = new FakeParam();
    high = new FakeParam();
    lowFrequency = new FakeParam();
    highFrequency = new FakeParam();
    constructor(_l?: number, _m?: number, _h?: number) { super(); }
  }
  class Compressor extends Node {
    threshold = new FakeParam();
    ratio = new FakeParam();
    constructor(_t?: number, _r?: number) { super(); }
  }
  class Reverb extends Node {
    decay = 1; wet = new FakeParam();
    constructor(opts?: { decay?: number; wet?: number }) {
      super();
      if (opts?.decay !== undefined) this.decay = opts.decay;
      if (opts?.wet !== undefined) this.wet.value = opts.wet;
    }
    generate() { return Promise.resolve(this); }
  }
  class PingPongDelay extends Node {
    delayTime = new FakeParam();
    feedback = new FakeParam();
    wet = new FakeParam();
    constructor(_opts?: unknown) { super(); }
  }
  class Limiter extends Node {
    threshold = new FakeParam();
    constructor(_t?: number) { super(); }
  }
  return {
    Gain, EQ3, Compressor, Reverb, PingPongDelay, Limiter,
    getContext: () => ({ rawContext: {} }),
    now: () => 0,
    __connections: mockState.connections,
    __rampCalls: mockState.rampCalls,
  };
});

const Tone = await import('tone');
const { buildBuses, triggerDuck } = await import('../buses');
type Buses = Awaited<ReturnType<typeof buildBuses>>;

describe('buses', () => {
  let buses: Buses;

  beforeAll(async () => {
    buses = await buildBuses();
  });

  it('exposes 4 category buses', () => {
    expect(buses.perc).toBeDefined();
    expect(buses.mag).toBeDefined();
    expect(buses.impact).toBeDefined();
    expect(buses.ui).toBeDefined();
  });

  it('exposes 3 FX send nodes', () => {
    expect(buses.plate).toBeDefined();
    expect(buses.hall).toBeDefined();
    expect(buses.delay).toBeDefined();
  });

  it('exposes a master gain', () => {
    expect(buses.master).toBeDefined();
  });

  it('triggerDuck schedules without throwing', () => {
    expect(() => triggerDuck(buses, 4, 80, 250)).not.toThrow();
  });

  it('routes every category bus output through postKey -> sidechainKey -> master', () => {
    const conns = (Tone as unknown as { __connections: unknown[][] }).__connections;
    const findEdge = (src: unknown, dst: unknown) =>
      conns.some((edge) => edge[0] === src && edge[1] === dst);

    expect(buses.perc.output).toBeDefined();
    expect(buses.mag.output).toBeDefined();
    expect(buses.impact.output).toBeDefined();
    expect(buses.ui.output).toBeDefined();
    expect(buses.postKey).toBeDefined();
    expect(buses.sidechainKey).toBeDefined();
    expect(buses.master).toBeDefined();

    // Each category bus output -> postKey
    expect(findEdge(buses.perc.output, buses.postKey)).toBe(true);
    expect(findEdge(buses.mag.output, buses.postKey)).toBe(true);
    expect(findEdge(buses.impact.output, buses.postKey)).toBe(true);
    expect(findEdge(buses.ui.output, buses.postKey)).toBe(true);

    // postKey -> sidechainKey -> master
    expect(findEdge(buses.postKey, buses.sidechainKey)).toBe(true);
    expect(findEdge(buses.sidechainKey, buses.master)).toBe(true);
  });

  it('triggerDuck schedules ramps to the computed target then back to 1', () => {
    const ramps = (Tone as unknown as { __rampCalls: unknown[][] }).__rampCalls;
    const beforeRamps = ramps.length;
    triggerDuck(buses, 4, 80, 250);
    const newRamps = ramps.slice(beforeRamps);
    // Two ramps scheduled.
    expect(newRamps.length).toBeGreaterThanOrEqual(2);
    // First ramp targets ~0.631 (-4 dB linear).
    const expected = Math.pow(10, -4 / 20);
    expect(Math.abs((newRamps[0]![0] as number) - expected)).toBeLessThan(0.01);
    // Last ramp returns to 1.
    expect(newRamps[newRamps.length - 1]![0]).toBe(1);
  });

  it('triggerDuck returns early on dB <= 0', () => {
    const ramps = (Tone as unknown as { __rampCalls: unknown[][] }).__rampCalls;
    const beforeRamps = ramps.length;
    triggerDuck(buses, 0, 80, 250);
    triggerDuck(buses, -3, 80, 250);
    expect(ramps.length).toBe(beforeRamps);
  });
});
