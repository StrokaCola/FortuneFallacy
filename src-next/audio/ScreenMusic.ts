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
      h = new Howl({
        src: [`${BASE_PATH}/${TRACK_FILES[screen]}`],
        loop: true,
        volume: 0,
        html5: false,
      });
      this.howls.set(screen, h);
    }
    return h;
  }

  start(screen: ScreenId): void {
    if (this.active === screen) return;
    const target = this.currentTarget();

    if (this.active) {
      const oldRef = this.howls.get(this.active);
      if (oldRef) {
        oldRef.fade(oldRef.volume(), 0, CROSSFADE_MS);
        // Pause after the fade completes so the loop stops consuming the audio
        // graph. Pause (not unload) so re-entering this screen is fast.
        window.setTimeout(() => {
          try { oldRef.pause(); } catch { /* ignore */ }
        }, CROSSFADE_MS + 50);
      }
    }

    const next = this.getOrCreate(screen);
    // Reset volume to 0 first so crossfade-from is deterministic regardless of
    // any prior in-flight fade tween left over.
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
        try { cur.play(); } catch { /* ignore */ }
        cur.fade(cur.volume(), this.currentTarget(), 200);
      }
    }
  }

  reset(): void {
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

declare global {
  interface ImportMeta { hot?: { dispose: (cb: () => void) => void } }
}

if (typeof import.meta !== 'undefined' && (import.meta as ImportMeta).hot) {
  (import.meta as ImportMeta).hot!.dispose(() => {
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    screenMusic.dispose();
  });
}
