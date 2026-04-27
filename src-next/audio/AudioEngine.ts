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

const VOLUME_KEY = 'ff_next_audioVol';

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

const BASE_PATH = '/FortuneFallacy/audio';

function loadVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY);
  if (!raw) return 0.6;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.6;
}

class AudioEngineImpl {
  private layers: Layers | null = null;
  private state: State;
  private actual = { base: 0, combo: 0, peak: 0, fail: 0 };
  private master = loadVolume();
  private rafHandle: number | null = null;
  private lastTick = 0;
  private started = false;
  private paused = false;
  private bigScoreStart = 0;
  private filter: BiquadFilterNode | null = null;
  private saveTimer: number | null = null;
  private bigScoreReleased = false;
  private tension = 0;
  private active = true;

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

    this.layers = {
      base:  new Howl({ src: [`${BASE_PATH}/base-loop.wav`],  loop: true, volume: 0, html5: false }),
      combo: new Howl({ src: [`${BASE_PATH}/combo-loop.wav`], loop: true, volume: 0, html5: false }),
      peak:  new Howl({ src: [`${BASE_PATH}/peak-loop.wav`],  loop: true, volume: 0, html5: false }),
      fail:  new Howl({ src: [`${BASE_PATH}/fail-loop.wav`],  loop: true, volume: 0, html5: false }),
    };

    this.layers.base.play();
    this.layers.combo.play();
    this.layers.peak.play();
    this.layers.fail.play();

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

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      else this.resume();
    });
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

  setMaster(v: number): void {
    this.master = Math.max(0, Math.min(1, v));
    localStorage.setItem(VOLUME_KEY, String(this.master));
  }

  getMaster(): number {
    return this.master;
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

  getState(): Readonly<State & { actual: typeof this.actual; master: number }> {
    return { ...this.state, actual: { ...this.actual }, master: this.master };
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

    // Tension nudges combo + peak layer mix targets so a high-stakes baseline
    // sounds ominous before any cast. Cap nudge contribution at 0.2 of the layer.
    const tNudge = this.tension * 0.2;
    let baseTarget = 0.55 + 0.25 * this.state.stability + 0.15 * this.state.heat;
    let comboTarget = this.state.combo * (0.6 + 0.4 * this.state.heat) + tNudge * 0.6;
    let peakTarget = smoothstep(this.state.heat, 0.7, 1.0) * 0.85 + tNudge * 0.4;
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

    const m = this.master * (this.paused ? 0 : 1);
    this.layers.base.volume(this.actual.base * m);
    this.layers.combo.volume(this.actual.combo * m);
    this.layers.peak.volume(this.actual.peak * m);
    this.layers.fail.volume(this.actual.fail * m);

    if (this.filter) {
      // tension narrows the filter further; mode=fail still hard-overrides to 800Hz.
      // tension=0 → tensionFloor=16000 (no extra narrowing); tension=1 → tensionFloor=2000.
      const heatCutoff = 600 + this.state.heat * 15000;
      const tensionFloor = 16000 - this.tension * 14000;
      const cutoff = this.state.mode === 'fail' ? 800 : Math.min(heatCutoff, tensionFloor);
      this.filter.frequency.setTargetAtTime(cutoff, this.filter.context.currentTime, 0.05);
    }
  };
}

export const audioEngine = new AudioEngineImpl();

export function ensureAudioAfterGesture(): void {
  if (audioEngine.getState().master >= 0 && (audioEngine as unknown as { started: boolean }).started) return;
  const handler = () => {
    audioEngine.start();
    document.removeEventListener('click', handler);
    document.removeEventListener('keydown', handler);
  };
  document.addEventListener('click', handler);
  document.addEventListener('keydown', handler);
}
