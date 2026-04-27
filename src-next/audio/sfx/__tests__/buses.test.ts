import { describe, it, expect, beforeAll, vi } from 'vitest';

// Tone.js cannot run under jsdom (no Web Audio). Mock the surface that
// `buses.ts` touches with lightweight stubs that record connections and
// expose AudioParam-shaped properties so triggerDuck can schedule.
vi.mock('tone', () => {
  class FakeParam {
    value = 1;
    cancelScheduledValues = vi.fn();
    setValueAtTime = vi.fn();
    linearRampToValueAtTime = vi.fn();
    setTargetAtTime = vi.fn();
  }
  class Node {
    connect() { return this; }
    disconnect() { return this; }
    toDestination() { return this; }
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
    getContext: () => ({ rawContext: { currentTime: 0 } }),
  };
});

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
});
