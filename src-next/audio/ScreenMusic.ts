import { Howl } from 'howler';

export type ScreenId = 'title' | 'hub' | 'shop' | 'forge' | 'boss';

const BASE_PATH = '/FortuneFallacy/audio';
const VOLUME_KEY = 'ff_next_audioVol';
const CROSSFADE_MS = 1500;

const TRACK_FILES: Record<ScreenId, string> = {
  title: 'title-loop.wav',
  hub:   'hub-loop.wav',
  shop:  'shop-loop.wav',
  forge: 'forge-loop.wav',
  boss:  'boss-loop.wav',
};

function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (!raw) return 0.6;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.6;
  } catch { return 0.6; }
}

class ScreenMusicImpl {
  private howls = new Map<ScreenId, Howl>();
  private active: ScreenId | null = null;
  private master: number = loadVolume();
  private paused = false;

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
    const target = this.master * (this.paused ? 0 : 1);

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
    this.master = Math.max(0, Math.min(1, v));
    if (this.active) {
      const cur = this.howls.get(this.active);
      cur?.fade(cur.volume(), this.master, 200);
    }
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
        cur.fade(cur.volume(), this.master, 200);
      }
    }
  }

  reset(): void {
    this.howls.forEach((h) => { try { h.unload(); } catch { /* ignore */ } });
    this.howls.clear();
    this.active = null;
    this.master = loadVolume();
    this.paused = false;
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
    screenMusic.reset();
  });
}
