// Touch long-press controller for .has-tip elements.
//
// Existing CSS (styles/index.css) shows tooltips on hover (desktop) and
// :active (touch). The :active model only persists while the finger is
// still pressing — release and the tooltip vanishes before you finish
// reading. This controller upgrades touch behavior:
//
//   - touchstart on a .has-tip element starts a 450ms hold timer
//   - if movement exceeds MOVE_TOLERANCE_PX, the timer cancels and a
//     normal tap proceeds (so sell-buttons, lock-clicks, etc. still work)
//   - if the timer fires, the element gets `.tip-stuck` (forces the
//     tooltip visible) and the imminent click is suppressed
//   - any subsequent click/touchstart anywhere clears `.tip-stuck`
//
// install() is idempotent and safe to call multiple times — the second
// call returns the same disposer the first call returned. There is one
// global stuck element at a time; long-pressing a different element
// transfers stickiness.

// Exported so the 3D dice long-press handler (Dice3D.ts) shares the same hold
// duration and movement tolerance as the HTML `.has-tip` system — keeps the
// gesture feel consistent across React UI and the in-round dice canvas.
//
// The 450ms baseline is overridden at runtime by the player's a11y pref
// (Settings → Long-press hold). HOLD_MS stays exported as the *default*
// for tests and Dice3D's import; the controller below resolves the
// pref-aware value via getLongPressMs() on every touchstart.
export const HOLD_MS = 450;
export const MOVE_TOLERANCE_PX = 8;
import { getLongPressMs } from '../a11y/inputPrefs';
const STUCK_CLASS = 'tip-stuck';
// Min gap between a tooltip and the viewport edge after shifting. Larger
// than zero so the tip doesn't hug the screen edge under a notch / camera
// cutout. Matches the safe-area treatment used elsewhere on the HUD.
const VIEWPORT_MARGIN_PX = 8;

let installed: { dispose: () => void } | null = null;
let stuckEl: HTMLElement | null = null;

function findHasTip(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest('.has-tip') as HTMLElement | null;
}

// Nudge a tooltip horizontally so it stays inside the viewport. The CSS
// transform reads `--tip-shift` (default 0); we measure the rendered rect
// after resetting any prior shift, then write a new shift if either edge
// is clipped. Called on long-press stick AND on hover-in so the same fit
// logic works for touch and desktop. Catalyst tooltips on tight viewports
// would otherwise clip off-screen when the catalyst sits near a screen
// edge — the tooltip's `left: 50%; translateX(-50%)` anchor extends up
// to half its max-width (120px) past the card center.
export function fitTipInViewport(hasTipEl: HTMLElement): void {
  const tip = hasTipEl.querySelector<HTMLElement>(':scope > .tip');
  if (!tip) return;
  // Reset any prior shift so measurement reflects the unshifted layout.
  tip.style.setProperty('--tip-shift', '0px');
  // Defer measurement to the next frame so the browser has applied the
  // reset before getBoundingClientRect. Without this, back-to-back
  // adjustments compound when re-entering the same card quickly.
  const measure = () => {
    const rect = tip.getBoundingClientRect();
    if (rect.width === 0) return;
    const vw = window.innerWidth;
    let shift = 0;
    if (rect.left < VIEWPORT_MARGIN_PX) {
      shift = VIEWPORT_MARGIN_PX - rect.left;
    } else if (rect.right > vw - VIEWPORT_MARGIN_PX) {
      shift = vw - VIEWPORT_MARGIN_PX - rect.right;
    }
    tip.style.setProperty('--tip-shift', `${Math.round(shift)}px`);
  };
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(measure);
  } else {
    measure();
  }
}

function clearStuck(): void {
  if (stuckEl) {
    stuckEl.classList.remove(STUCK_CLASS);
    // Drop the shift so the next tooltip starts from a clean measurement.
    const tip = stuckEl.querySelector<HTMLElement>(':scope > .tip');
    if (tip) tip.style.removeProperty('--tip-shift');
    stuckEl = null;
  }
}

function setStuck(el: HTMLElement): void {
  if (stuckEl === el) return;
  if (stuckEl) stuckEl.classList.remove(STUCK_CLASS);
  el.classList.add(STUCK_CLASS);
  stuckEl = el;
  fitTipInViewport(el);
}

export function installLongPressTooltips(): { dispose: () => void } {
  if (installed) return installed;

  let timer: number | null = null;
  let armedEl: HTMLElement | null = null;
  let startX = 0;
  let startY = 0;
  let didTrigger = false;

  const cancelTimer = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    armedEl = null;
  };
  // Cancel only the timer; leaves armedEl in place. Used when re-arming
  // for a new hold (the previous touchstart's armedEl is about to be
  // overwritten anyway).
  const cancelTimerOnly = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const onTouchStart = (e: TouchEvent) => {
    // jsdom's TouchEvent prototype lacks `touches`; tests provide it via
    // Object.defineProperty on a base Event. Read defensively off either
    // a real TouchList or a plain Array.
    const touches = (e as unknown as { touches?: ArrayLike<Touch> }).touches;
    const len = touches?.length ?? 0;
    // Multi-finger gestures (pinch-zoom etc.) are not long-press intent.
    if (len !== 1) {
      cancelTimer();
      return;
    }
    const t = touches![0]!;
    const target = findHasTip(e.target);

    // Tap outside any has-tip dismisses the current sticky tooltip.
    if (!target) {
      clearStuck();
      return;
    }

    cancelTimerOnly();
    armedEl = target;
    startX = t.clientX;
    startY = t.clientY;
    didTrigger = false;
    timer = setTimeout(() => {
      // Hold completed without significant movement → mark sticky.
      if (armedEl) {
        setStuck(armedEl);
        didTrigger = true;
      }
      timer = null;
    }, getLongPressMs()) as unknown as number;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (timer == null || !armedEl) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) {
      cancelTimer();
    }
  };

  const onTouchEnd = () => {
    cancelTimer();
  };

  const onClick = (e: MouseEvent) => {
    // If the hold fired this gesture, swallow the synthesized click so
    // the press-and-hold doesn't also activate the underlying control.
    if (didTrigger) {
      e.stopPropagation();
      e.preventDefault();
      didTrigger = false;
      return;
    }
    // Otherwise, a normal click — clear any sticky tooltip from a
    // prior long-press so the player isn't stuck with stale UI.
    const target = findHasTip(e.target);
    if (!target || target !== stuckEl) {
      clearStuck();
    }
  };

  // Hover fit: when the mouse enters a .has-tip element on desktop, fit
  // the tooltip into the viewport BEFORE the CSS :hover transition makes
  // it visible. Uses mouseover (bubbles) rather than mouseenter (doesn't
  // bubble, needs per-element listeners). Cheap: the helper short-circuits
  // when the tip has no rendered width.
  const onMouseOver = (e: MouseEvent) => {
    const target = findHasTip(e.target);
    if (!target) return;
    fitTipInViewport(target);
  };

  // Capture phase so we see the click before the React handler claims it
  // when long-press triggered. Move/end stay in bubble phase — they're
  // benign.
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true });
  document.addEventListener('click', onClick, true);
  document.addEventListener('mouseover', onMouseOver);

  installed = {
    dispose() {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('mouseover', onMouseOver);
      cancelTimer();
      clearStuck();
      installed = null;
    },
  };
  return installed;
}

// Test-only helpers — exported so tests don't need to crank a clock.
export const __test__ = {
  HOLD_MS,
  MOVE_TOLERANCE_PX,
  STUCK_CLASS,
  reset() {
    if (installed) installed.dispose();
    clearStuck();
  },
  getStuck: () => stuckEl,
};

