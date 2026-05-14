import { Howl } from 'howler';
import * as audioSettings from './audioSettings';

export type ScreenId = 'title' | 'hub' | 'shop' | 'forge' | 'boss';

const BASE_PATH = '/FortuneFallacy/audio';
const CROSSFADE_MS = 1500;

const TRACK_FILES: Record<ScreenId, string> = {
  title: 'title-loop.wav',
  hub:   'hub-loop.wav',
  shop:  'shop-loop.wav',
  forge: 'forge-loop.wav',
  boss:  'boss-loop.wav',
};

class ScreenMusicImpl {
  private howls = new Map<ScreenId, Howl>();
  private active: ScreenId | null = null;
  private paused = false;
  private audioSettingsUnsub: (() => void) | null = null;
  // Per-screen pending pause-after-fade timeouts. Keyed so a rapid
  // re-entry into the same screen can cancel its own pending pause
  // before scheduling a fresh one — otherwise the previous timeout
  // pauses the howl mid-fade-up.
  private pendingPauses = new Map<ScreenId, number>();

  constructor() {
    this.audioSettingsUnsub = audioSettings.subscribe(() => this.applyVolume());
  }

  private currentTarget(): number {
    return audioSettings.getMaster() * audioSettings.getMusic() * (this.paused ? 0 : 1);
  }

  private applyVolume(): void {
    if (!this.active) return;
    const cur = this.howls.get(this.active);
    if (!cur) return;
    cur.fade(cur.volume(), this.currentTarget(), 200);
  }

  private getOrCreate(screen: ScreenId): Howl {
    let h = this.howls.get(screen);
    if (!h) {
      // Music beds stream via <audio> (html5:true) — see AudioEngine.ts for
      // the rationale. Source array prefers .opus when present, .wav fallback.
      const baseFile = TRACK_FILES[screen];
      const opusFile = baseFile.replace(/\.wav$/, '.opus');
      h = new Howl({
        src: [`${BASE_PATH}/${opusFile}`, `${BASE_PATH}/${baseFile}`],
        loop: true,
        volume: 0,
        html5: true,
      });
      this.howls.set(screen, h);
    }
    return h;
  }

  private clearPendingPause(screen: ScreenId): void {
    const id = this.pendingPauses.get(screen);
    if (id != null) {
      window.clearTimeout(id);
      this.pendingPauses.delete(screen);
    }
  }

  start(screen: ScreenId): void {
    if (this.active === screen) return;
    const target = this.currentTarget();

    if (this.active) {
      const oldScreen = this.active;
      const oldRef = this.howls.get(oldScreen);
      if (oldRef) {
        oldRef.fade(oldRef.volume(), 0, CROSSFADE_MS);
        // Cancel any prior pending pause for this screen first so they
        // don't compound — rapid hub→shop→hub→shop transitions otherwise
        // stack 4 setTimeouts that all fire and confuse each other.
        this.clearPendingPause(oldScreen);
        const pauseId = window.setTimeout(() => {
          this.pendingPauses.delete(oldScreen);
          try { oldRef.pause(); } catch { /* ignore */ }
        }, CROSSFADE_MS + 50);
        this.pendingPauses.set(oldScreen, pauseId);
      }
    }

    const next = this.getOrCreate(screen);
    // Cancel any pending pause for THIS screen so we don't pause it
    // mid-fade-up if the player just bounced through screens.
    this.clearPendingPause(screen);
    // Hard-stop any in-flight playback so the upcoming .play() doesn't
    // layer a new sound instance on top of one that's still fading
    // down from a prior start(). Howler's .play() on an already-playing
    // Howl creates a SECOND simultaneous playback — without this stop()
    // call, rapid screen transitions accumulated overlapping loops.
    try { next.stop(); } catch { /* ignore */ }
    next.volume(0);
    next.play();
    next.fade(0, target, CROSSFADE_MS);

    this.active = screen;
  }

  stop(durationMs: number = CROSSFADE_MS): void {
    if (!this.active) return;
    const cur = this.howls.get(this.active);
    if (cur) cur.fade(cur.volume(), 0, durationMs);
    this.active = null;
  }

  setMaster(v: number): void {
    audioSettings.setMusic(v);
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    if (this.active) {
      const cur = this.howls.get(this.active);
      if (cur) {
        cur.fade(cur.volume(), 0, 200);
        // Hard-pause after the short fade so the loop stops consuming resources
        // while the tab is hidden.
        window.setTimeout(() => {
          try { cur.pause(); } catch { /* ignore */ }
        }, 250);
      }
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.active) {
      const cur = this.howls.get(this.active);
      if (cur) {
        // Only call play() if the howl is actually paused/stopped; calling
        // .play() on an already-playing howl creates a second simultaneous
        // playback instance, which is the layering bug we hit on rapid
        // visibility toggles.
        if (!cur.playing()) {
          try { cur.play(); } catch { /* ignore */ }
        }
        cur.fade(cur.volume(), this.currentTarget(), 200);
      }
    }
  }

  reset(): void {
    this.pendingPauses.forEach((id) => window.clearTimeout(id));
    this.pendingPauses.clear();
    this.howls.forEach((h) => { try { h.unload(); } catch { /* ignore */ } });
    this.howls.clear();
    this.active = null;
    this.paused = false;
  }

  dispose(): void {
    this.audioSettingsUnsub?.();
    this.audioSettingsUnsub = null;
    this.reset();
  }
}

export const screenMusic = new ScreenMusicImpl();

let visibilityHandler: (() => void) | null = null;
if (typeof document !== 'undefined') {
  visibilityHandler = () => {
    if (document.hidden) screenMusic.pause();
    else screenMusic.resume();
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}

import.meta.hot?.dispose(() => {
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
  screenMusic.dispose();
});
