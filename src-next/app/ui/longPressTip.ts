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

const HOLD_MS = 450;
const MOVE_TOLERANCE_PX = 8;
const STUCK_CLASS = 'tip-stuck';

let installed: { dispose: () => void } | null = null;
let stuckEl: HTMLElement | null = null;

function findHasTip(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest('.has-tip') as HTMLElement | null;
}

function clearStuck(): void {
  if (stuckEl) {
    stuckEl.classList.remove(STUCK_CLASS);
    stuckEl = null;
  }
}

function setStuck(el: HTMLElement): void {
  if (stuckEl === el) return;
  if (stuckEl) stuckEl.classList.remove(STUCK_CLASS);
  el.classList.add(STUCK_CLASS);
  stuckEl = el;
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
    }, HOLD_MS) as unknown as number;
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

  // Capture phase so we see the click before the React handler claims it
  // when long-press triggered. Move/end stay in bubble phase — they're
  // benign.
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true });
  document.addEventListener('click', onClick, true);

  installed = {
    dispose() {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('click', onClick, true);
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

