// Imperative screen-shake. Caller decides intensity ('tiny' | 'mid' | 'big').
// Adds a class to #stage-root, removes after the animation completes. Honors
// .reduce-motion (the CSS itself disables the shake; this helper still cycles
// the class so any callers checking can rely on consistent timing).

export type ShakeIntensity = 'tiny' | 'mid' | 'big';

const DURATIONS: Record<ShakeIntensity, number> = {
  tiny: 200,
  mid: 300,
  big: 440,
};

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let activeClass: string | null = null;

export function triggerShake(intensity: ShakeIntensity = 'mid'): void {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('stage-root');
  if (!root) return;

  // If a shake is already running, cancel and replay so back-to-back shakes
  // don't get swallowed by an in-flight animation.
  if (pendingTimer != null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  if (activeClass) {
    root.classList.remove(activeClass);
    // Force reflow so re-adding the class restarts the animation.
    void root.offsetWidth;
  }

  const cls = `shake-${intensity}`;
  root.classList.add(cls);
  activeClass = cls;
  pendingTimer = setTimeout(() => {
    root.classList.remove(cls);
    if (activeClass === cls) activeClass = null;
    pendingTimer = null;
  }, DURATIONS[intensity]);
}
