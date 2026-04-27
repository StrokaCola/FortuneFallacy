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
      const old = this.howls.get(this.active);
      old?.fade(old.volume(), 0, CROSSFADE_MS);
    }

    const next = this.getOrCreate(screen);
    next.play();
    next.fade(next.volume(), target, CROSSFADE_MS);

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
      cur?.fade(cur.volume(), 0, 200);
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.active) {
      const cur = this.howls.get(this.active);
      cur?.fade(cur.volume(), this.master, 200);
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

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) screenMusic.pause();
    else screenMusic.resume();
  });
}
