import { Howl, Howler } from 'howler';
import {
  deltaToHeat,
  multiplierToCombo,
  tierToCombo,
  smoothstep,
  saveMemory,
  loadMemory,
  type AudioMemory,
} from './heat';
import * as audioSettings from './audioSettings';
import { evalDuck, isDuckComplete, type DuckPhase } from './duckEnvelope';

type Mode = 'idle' | 'active' | 'peak' | 'fail';

type State = {
  heat: number;
  combo: number;
  stability: number;
  fail: number;
  mode: Mode;
  bigScoreTimer: number;
};

type Layers = {
  base: Howl;
  combo: Howl;
  peak: Howl;
  fail: Howl;
};

type ActualLayers = { base: number; combo: number; peak: number; fail: number };

const BASE_PATH = '/FortuneFallacy/audio';

// 2026-05-18 P2 audio slim. Feature-detect Opus playback support so the
// Howl src arrays can drop the .wav fallback entirely on modern browsers.
// `'probably'` is the strongest assertion the MediaElement API gives us;
// `'maybe'` (or empty) means the browser is uncertain, so we keep the
// wav fallback for safety. Result cached at module load — the result
// never changes within a session.
//
// Returns true on:  Chrome/Edge/Firefox/Brave (all), Safari ≥ 17 (macOS
// Sonoma+, iOS 17+). Returns false on: legacy Safari (< 17), niche
// embedded webviews. The legacy path still ships .wav.
const supportsOpus: boolean = (() => {
  try {
    if (typeof Audio === 'undefined') return false;
    const a = new Audio();
    const probe = a.canPlayType('audio/ogg; codecs="opus"');
    return probe === 'probably' || probe === 'maybe';
  } catch {
    return false;
  }
})();

class AudioEngineImpl {
  private layers: Layers | null = null;
  private state: State;
  private actual: ActualLayers = { base: 0, combo: 0, peak: 0, fail: 0 };
  private audioSettingsUnsub: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private rafHandle: number | null = null;
  private lastTick = 0;
  private started = false;
  private paused = false;
  private bigScoreStart = 0;
  private filter: BiquadFilterNode | null = null;
  private saveTimer: number | null = null;
  private bigScoreReleased = false;
  private tension = 0;
  // Orthogonal to `mode` — gates layer output only; state evolution (heat/combo/etc.) keeps running
  // while inactive so the engine snaps back to the correct mix when reactivated.
  private active = true;
  // Round progress: score / target, clamped 0..1. Drives layer crossfade thresholds.
  private progress = 0;
  // Duck envelope multiplier on the music bus. 1.0 when idle. Driven by
  // scoring beats (hold-breath, bail) via `duck()`.
  private duckPhase: DuckPhase | null = null;
  private duckEnvelope = 1;

  constructor() {
    const mem = loadMemory();
    this.state = {
      heat: mem?.heat ?? 0,
      combo: mem?.combo ?? 0,
      stability: mem?.stability ?? 0.5,
      fail: 0,
      mode: 'idle',
      bigScoreTimer: 0,
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    Howler.volume(1.0);

    // Music beds use html5:true (streamed via <audio> rather than fully
    // decoded into memory). Trade a few ms of latency — fine for music — to
    // shed ~100MB of resident PCM on devices that load all four loops at
    // once. SFX still use html5:false elsewhere for sample-accurate timing.
    //
    // 2026-05-18 P2 audio slim: feature-detect Opus support and build a
    // single-source array (opus-only) on modern browsers. Howler's
    // built-in fallback chain still tries the next src on load-error, but
    // for the modern-Chrome/Firefox/Edge/Safari-17+ path we skip listing
    // the .wav entirely so even a transient load-failure doesn't fall
    // through to fetching 8-15MB of PCM. Safari < 17 (no Opus) keeps the
    // wav fallback for compatibility.
    //
    // The opus files (~7MB total) live in /public/audio/. The wav files
    // (~98MB total) are retained in /public/audio/ for the legacy-Safari
    // fallback path; modern browsers never request them.
    const srcsFor = (stem: string): string[] => {
      const opus = `${BASE_PATH}/${stem}.opus`;
      const wav  = `${BASE_PATH}/${stem}.wav`;
      return supportsOpus ? [opus] : [opus, wav];
    };
    this.layers = {
      base:  new Howl({ src: srcsFor('base-loop'),  loop: true, volume: 0, html5: true }),
      combo: new Howl({ src: srcsFor('combo-loop'), loop: true, volume: 0, html5: true }),
      peak:  new Howl({ src: srcsFor('peak-loop'),  loop: true, volume: 0, html5: true }),
      fail:  new Howl({ src: srcsFor('fail-loop'),  loop: true, volume: 0, html5: true }),
    };

    this.layers.base.play();
    this.layers.combo.play();
    this.layers.peak.play();
    this.layers.fail.play();

    // iOS Safari historically ignored the `volume: 0` constructor option for
    // html5:false Howls and played the first frames at full volume — pin each
    // gain to 0 here so the tick() lerp ramps up from silence. Belt-and-
    // suspenders that survives the html5 toggle above.
    this.layers.base.volume(0);
    this.layers.combo.volume(0);
    this.layers.peak.volume(0);
    this.layers.fail.volume(0);

    try {
      const ctx = Howler.ctx as AudioContext | null;
      const masterGain = (Howler as unknown as { masterGain?: GainNode }).masterGain;
      if (ctx && masterGain) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 18000;
        filter.Q.value = 0.7;
        masterGain.disconnect();
        masterGain.connect(filter);
        filter.connect(ctx.destination);
        this.filter = filter;
      }
    } catch (e) {
      console.warn('[audio] biquad insert failed:', e);
    }

    this.lastTick = performance.now();
    this.tick();
    this.audioSettingsUnsub = audioSettings.subscribe(() => this.applyVolumes());

    // Track the visibility handler so dispose() can remove it on HMR.
    // Otherwise each replaced module instance leaks a fresh listener and
    // tab-toggles fire pause/resume on N stale engines.
    this.visibilityHandler = () => {
      if (document.hidden) this.pause();
      else this.resume();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  pause(): void {
    if (!this.layers || this.paused) return;
    this.paused = true;
    const ctx = Howler.ctx as AudioContext | null;
    if (ctx && ctx.state === 'running') ctx.suspend();
  }

  resume(): void {
    if (!this.layers || !this.paused) return;
    this.paused = false;
    const ctx = Howler.ctx as AudioContext | null;
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  setTension(t: number): void {
    this.tension = Math.max(0, Math.min(1, t));
  }

  getTension(): number {
    return this.tension;
  }

  setActive(active: boolean): void {
    this.active = active;
  }

  isActive(): boolean {
    return this.active;
  }

  setProgress(p: number): void {
    this.progress = Math.max(0, Math.min(1, p));
  }

  getProgress(): number {
    return this.progress;
  }

  // Wave T Scoring Theater (Batch I, 2026-05-19) — crescendo filter
  // override. When non-null, the rAF loop forces the music filter
  // cutoff toward this Hz value instead of the heat/tension-driven
  // computation, producing a sustained low-pass sweep. Cleared on
  // crescendoEnd() — the cutoff snaps back to the normal model so
  // the boom hits with the bass + highs returning.
  private crescendoCutoffHz: number | null = null;

  crescendoBegin(targetHz: number = 2400): void {
    this.crescendoCutoffHz = Math.max(200, targetHz);
  }

  crescendoEnd(): void {
    this.crescendoCutoffHz = null;
  }

  // Schedule a duck envelope on the music bus. The envelope ramps the
  // music multiplier 1 → depth → 1 over (attack + hold + release) ms.
  // Calling again replaces any in-flight envelope.
  duck(opts: { attackMs: number; holdMs: number; releaseMs: number; depth: number }): void {
    this.duckPhase = {
      startMs: performance.now(),
      attackMs: Math.max(0, opts.attackMs),
      holdMs: Math.max(0, opts.holdMs),
      releaseMs: Math.max(0, opts.releaseMs),
      depth: Math.max(0, Math.min(1, opts.depth)),
    };
  }

  getDuckEnvelope(): number {
    return this.duckEnvelope;
  }

  bumpHeat(delta: number): void {
    if (delta <= 0) return;
    this.state.heat = Math.min(1, this.state.heat + delta);
    if (this.state.heat > 0.3) this.state.mode = this.state.mode === 'fail' ? this.state.mode : 'active';
    this.scheduleSave();
  }

  bumpHeatFromScore(scoreDelta: number, target: number): void {
    this.bumpHeat(deltaToHeat(scoreDelta, target));
  }

  bumpCombo(mult: number): void {
    const c = multiplierToCombo(mult);
    if (c > this.state.combo) this.state.combo = c;
    this.scheduleSave();
  }

  bumpComboFromTier(tier: number): void {
    const c = tierToCombo(tier);
    if (c > this.state.combo) this.state.combo = c;
    this.scheduleSave();
  }

  noteStability(amount: number): void {
    this.state.stability = Math.min(1, this.state.stability + amount);
    this.scheduleSave();
  }

  setMode(mode: Mode): void {
    this.state.mode = mode;
  }

  enterFail(): void {
    this.state.mode = 'fail';
    this.state.fail = 1;
  }

  exitFail(): void {
    this.state.mode = 'idle';
    this.state.fail = 0;
  }

  triggerBigScore(): void {
    this.state.bigScoreTimer = 2200;
    this.bigScoreStart = performance.now();
    this.state.mode = 'peak';
  }

  getState(): Readonly<State & { actual: ActualLayers; master: number }> {
    return { ...this.state, actual: { ...this.actual }, master: audioSettings.getMaster() };
  }

  private applyVolumes(): void {
    if (!this.layers) return;
    const m = audioSettings.getMaster() * audioSettings.getMusic() * (this.paused ? 0 : 1) * this.duckEnvelope;
    this.layers.base.volume(this.actual.base * m);
    this.layers.combo.volume(this.actual.combo * m);
    this.layers.peak.volume(this.actual.peak * m);
    this.layers.fail.volume(this.actual.fail * m);
  }

  dispose(): void {
    this.audioSettingsUnsub?.();
    this.audioSettingsUnsub = null;
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.rafHandle != null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
    // Unload every Howl so HMR (in dev) or repeated start() (in test)
    // doesn't leave the old streaming loops alive in the audio context.
    // Without this, a long dev session compounds 4 fresh howls per HMR
    // until the music sounds like a tape collage.
    if (this.layers) {
      try { this.layers.base.unload(); } catch { /* ignore */ }
      try { this.layers.combo.unload(); } catch { /* ignore */ }
      try { this.layers.peak.unload(); } catch { /* ignore */ }
      try { this.layers.fail.unload(); } catch { /* ignore */ }
      this.layers = null;
    }
    this.started = false;
  }

  private scheduleSave(): void {
    if (this.saveTimer != null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      const m: AudioMemory = {
        heat: this.state.heat,
        combo: this.state.combo,
        stability: this.state.stability,
      };
      saveMemory(m);
    }, 1000);
  }

  private tick = () => {
    if (!this.started) return;
    this.rafHandle = requestAnimationFrame(this.tick);
    if (!this.layers) return;
    const now = performance.now();
    const dt = Math.min(64, now - this.lastTick);
    this.lastTick = now;

    const decayScale = dt / 16;
    this.state.heat = Math.max(0, this.state.heat - 0.003 * decayScale);
    this.state.combo = Math.max(0, this.state.combo - 0.006 * decayScale);
    this.state.stability = Math.max(0, this.state.stability - 0.0005 * decayScale);

    if (this.state.mode === 'fail') {
      this.state.fail = Math.min(1, this.state.fail + 0.02 * decayScale);
    } else {
      this.state.fail = Math.max(0, this.state.fail - 0.01 * decayScale);
    }

    // Layer mix is driven by round progress (score/target). Heat from scoring events adds a
    // small transient nudge so each cast still feels reactive. Tension narrows the master
    // filter (see below) but no longer pushes the layer mix.
    const p = this.progress;
    const heatNudge = this.state.heat * 0.10;
    let baseTarget = 0.55 + 0.20 * p + heatNudge;
    let comboTarget = smoothstep(p, 0.30, 0.60) * 0.85 + heatNudge;
    let peakTarget = smoothstep(p, 0.70, 0.95) * 0.85;
    let failTarget = this.state.fail * 0.7;

    if (this.state.bigScoreTimer > 0) {
      const elapsed = now - this.bigScoreStart;
      this.state.bigScoreTimer = Math.max(0, 2200 - elapsed);
      if (elapsed < 200) {
        baseTarget = 0.10;
        comboTarget = 0.10;
        peakTarget = 0.0;
      } else if (elapsed < 300) {
        baseTarget = 0.04;
        comboTarget = 0.04;
        peakTarget = 0.0;
      } else if (elapsed < 350) {
        baseTarget = 0.0;
        comboTarget = 0.0;
        peakTarget = 0.95;
      } else if (elapsed < 900) {
        baseTarget = 0.0;
        comboTarget = 0.0;
        peakTarget = 0.95;
      } else if (elapsed < 2200) {
        const k = (elapsed - 900) / 1300;
        baseTarget = 0.0 + 0.7 * k;
        comboTarget = 0.0 + 0.5 * k;
        peakTarget = 0.95 - 0.45 * k;
      }
      if (elapsed >= 2200 && !this.bigScoreReleased) {
        this.bigScoreReleased = true;
        this.state.heat = Math.min(1, this.state.heat + 0.2);
      }
    } else if (this.bigScoreReleased) {
      this.bigScoreReleased = false;
    }

    if (this.state.fail > 0.4) {
      baseTarget *= 0.4;
      comboTarget *= 0.2;
      peakTarget *= 0.0;
    }

    if (!this.active) {
      baseTarget = 0;
      comboTarget = 0;
      peakTarget = 0;
      failTarget = 0;
    }

    const lerpK = 0.12;
    this.actual.base += (baseTarget - this.actual.base) * lerpK;
    this.actual.combo += (comboTarget - this.actual.combo) * lerpK;
    this.actual.peak += (peakTarget - this.actual.peak) * lerpK;
    this.actual.fail += (failTarget - this.actual.fail) * lerpK;

    if (this.duckPhase) {
      this.duckEnvelope = evalDuck(this.duckPhase, now);
      if (isDuckComplete(this.duckPhase, now)) {
        this.duckPhase = null;
        this.duckEnvelope = 1;
      }
    } else if (this.duckEnvelope !== 1) {
      this.duckEnvelope = 1;
    }

    this.applyVolumes();

    if (this.filter) {
      // tension narrows the filter further; mode=fail still hard-overrides to 800Hz.
      // tension=0 → tensionFloor=16000 (no extra narrowing); tension=1 → tensionFloor=2000.
      const heatCutoff = 600 + this.state.heat * 15000;
      const tensionFloor = 16000 - this.tension * 14000;
      // Wave T (Batch I) — crescendoCutoffHz overrides the heat/tension
      // model with a slow sweep toward the target so the music feels
      // sustained-pressing-down during the big-combo build. Time
      // constant 0.18s gives a noticeable but not jarring ramp.
      let cutoff: number;
      let timeConstant = 0.05;
      if (this.state.mode === 'fail') {
        cutoff = 800;
      } else if (this.crescendoCutoffHz != null) {
        cutoff = this.crescendoCutoffHz;
        timeConstant = 0.18;
      } else {
        cutoff = Math.min(heatCutoff, tensionFloor);
      }
      this.filter.frequency.setTargetAtTime(cutoff, this.filter.context.currentTime, timeConstant);
    }
  };
}

export const audioEngine = new AudioEngineImpl();

export function ensureAudioAfterGesture(): void {
  if (audioEngine.getState().master >= 0 && (audioEngine as unknown as { started: boolean }).started) return;
  const events = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
  const handler = () => {
    audioEngine.start();
    for (const e of events) document.removeEventListener(e, handler);
  };
  for (const e of events) document.addEventListener(e, handler);
}

import.meta.hot?.dispose(() => {
  audioEngine.dispose();
});
