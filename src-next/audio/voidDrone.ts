// Single Tone.js drone layer for Void Mode. Two detuned low sines + a
// slow amplitude LFO + a long reverb tail. Singleton — only one drone
// instance at a time. Layers UNDER the existing music; does not replace
// or mute anything.
//
// Dynamic-imports Tone so jsdom test environments (no AudioContext)
// don't blow up on module load. The `dronePlaying` flag is the
// test-visible truth; actual Tone instantiation only runs in real
// browsers (window + AudioContext present).
//
// Lifecycle:
//   - startVoidDrone()  : marks playing, builds the Tone graph, 4s fade-in
//   - stopVoidDrone()   : clears the flag, 2s fade-out, then dispose
//   - isVoidDronePlaying(): synchronous truth flag for the subscription
//                           layer + tests
//
// Double-start is idempotent (no-op on the second call). Wired in
// audioBridge: state.run.mode crossing 'normal' -> 'void' starts the
// drone; the reverse stops it.

// Minimal shape of the Tone refs we hold so dispose() can clean up.
// Typed loosely so dynamic-import-time `any` doesn't leak.
type ToneRefs = {
  osc1: { stop: () => unknown; dispose: () => unknown };
  osc2: { stop: () => unknown; dispose: () => unknown };
  lfo:  { stop: () => unknown; dispose: () => unknown };
  rev:  { dispose: () => unknown };
  gain: { gain: { rampTo: (v: number, t: number) => void }; dispose: () => unknown };
};

let dronePlaying = false;
let toneRefs: ToneRefs | null = null;

export function isVoidDronePlaying(): boolean {
  return dronePlaying;
}

export async function startVoidDrone(): Promise<void> {
  if (dronePlaying) return;
  dronePlaying = true;

  // jsdom test environment — skip Tone. We still flip dronePlaying so
  // tests can observe the lifecycle without a real AudioContext.
  if (typeof window === 'undefined') return;
  const w = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
  if (typeof w.AudioContext === 'undefined' && typeof w.webkitAudioContext === 'undefined') {
    return;
  }

  try {
    const Tone = await import('tone');
    // Modern Tone.js prefers the single-options-object constructor form.
    // Positional args still work but emit a deprecation warning per call —
    // use the object form to keep the console clean.
    const gain = new Tone.Gain({ gain: 0 }).toDestination();
    const rev  = new Tone.Reverb({ decay: 6, wet: 0.6 }).connect(gain);
    const osc1 = new Tone.Oscillator({ frequency: 55, type: 'sine' }).connect(rev).start();
    const osc2 = new Tone.Oscillator({ frequency: 58, type: 'sine' }).connect(rev).start();
    // gain.gain is a Tone Param. LFO.connect accepts the param directly
    // at runtime; the cast satisfies the dynamic-import type signature.
    const lfo  = new Tone.LFO({ frequency: 0.2, min: 0.0, max: 0.35 })
      .connect(gain.gain as unknown as Parameters<InstanceType<typeof Tone.LFO>['connect']>[0])
      .start();
    gain.gain.rampTo(0.35, 4);
    toneRefs = {
      osc1: osc1 as unknown as ToneRefs['osc1'],
      osc2: osc2 as unknown as ToneRefs['osc2'],
      lfo:  lfo  as unknown as ToneRefs['lfo'],
      rev:  rev  as unknown as ToneRefs['rev'],
      gain: gain as unknown as ToneRefs['gain'],
    };
  } catch {
    // Tone instantiation failed (AudioContext denied, etc.) — silently
    // back out so the run still works without the drone.
    dronePlaying = false;
    toneRefs = null;
  }
}

export function stopVoidDrone(): void {
  dronePlaying = false;
  if (!toneRefs) return;
  const { osc1, osc2, lfo, rev, gain } = toneRefs;
  toneRefs = null;
  try {
    gain.gain.rampTo(0, 2);
    setTimeout(() => {
      try { osc1.stop(); osc1.dispose(); } catch { /* already disposed */ }
      try { osc2.stop(); osc2.dispose(); } catch { /* already disposed */ }
      try { lfo.stop();  lfo.dispose();  } catch { /* already disposed */ }
      try { rev.dispose(); } catch { /* already disposed */ }
      try { gain.dispose(); } catch { /* already disposed */ }
    }, 2100);
  } catch {
    // Ramp scheduling failed — fall through; the refs are already
    // cleared so the next start() will rebuild cleanly.
  }
}
