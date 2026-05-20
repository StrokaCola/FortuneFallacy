// Void Mode drone stem — verifies the singleton lifecycle works
// without a real AudioContext (jsdom). The actual Tone.js
// instantiation is gated behind a runtime check; in jsdom we only
// observe the `dronePlaying` flag flips.
//
// In real-browser play the drone fades in/out under the existing
// music when state.run.mode crosses normal <-> void.

import { describe, it, expect, beforeEach } from 'vitest';
import { startVoidDrone, stopVoidDrone, isVoidDronePlaying } from './voidDrone';

describe('voidDrone', () => {
  beforeEach(() => stopVoidDrone());

  it('isVoidDronePlaying returns false before start', () => {
    expect(isVoidDronePlaying()).toBe(false);
  });

  it('startVoidDrone marks the drone as playing', async () => {
    await startVoidDrone();
    expect(isVoidDronePlaying()).toBe(true);
  });

  it('stopVoidDrone clears the playing flag', async () => {
    await startVoidDrone();
    stopVoidDrone();
    expect(isVoidDronePlaying()).toBe(false);
  });

  it('double-start is idempotent', async () => {
    await startVoidDrone();
    await startVoidDrone();
    expect(isVoidDronePlaying()).toBe(true);
    stopVoidDrone();
  });
});
