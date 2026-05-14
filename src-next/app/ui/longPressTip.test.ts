import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installLongPressTooltips, __test__ } from './longPressTip';

const HOLD = __test__.HOLD_MS;
const STUCK = __test__.STUCK_CLASS;

function makeTip(label = 't'): HTMLElement {
  const el = document.createElement('button');
  el.className = 'has-tip';
  el.textContent = label;
  document.body.appendChild(el);
  return el;
}

// Dispatch on the actual element so `event.target` is set by the DOM
// (Object.defineProperty fights the Event prototype's getter in jsdom).
function fireTouchStart(target: EventTarget, x = 50, y = 50): void {
  const ev = new Event('touchstart', { bubbles: true }) as TouchEvent;
  Object.defineProperty(ev, 'touches', { value: [{ clientX: x, clientY: y }] });
  target.dispatchEvent(ev);
}
function fireTouchMove(target: EventTarget, x: number, y: number): void {
  const ev = new Event('touchmove', { bubbles: true }) as TouchEvent;
  Object.defineProperty(ev, 'touches', { value: [{ clientX: x, clientY: y }] });
  target.dispatchEvent(ev);
}
function fireTouchEnd(target: EventTarget): void {
  const ev = new Event('touchend', { bubbles: true });
  target.dispatchEvent(ev);
}
function fireClick(target: EventTarget): MouseEvent {
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
}

describe('longPressTip controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    __test__.reset();
  });

  afterEach(() => {
    __test__.reset();
    vi.useRealTimers();
  });

  it('marks element as stuck after holding past HOLD_MS', () => {
    installLongPressTooltips();
    const a = makeTip('a');

    fireTouchStart(a, 10, 10);
    expect(a.classList.contains(STUCK)).toBe(false);

    vi.advanceTimersByTime(HOLD + 1);
    expect(a.classList.contains(STUCK)).toBe(true);
    expect(__test__.getStuck()).toBe(a);
  });

  it('does not stick on a quick tap (release before HOLD_MS)', () => {
    installLongPressTooltips();
    const a = makeTip('a');

    fireTouchStart(a, 10, 10);
    vi.advanceTimersByTime(HOLD - 100);
    fireTouchEnd(a);
    vi.advanceTimersByTime(200); // would have fired without cancel

    expect(a.classList.contains(STUCK)).toBe(false);
  });

  it('cancels the timer when finger moves beyond tolerance', () => {
    installLongPressTooltips();
    const a = makeTip('a');

    fireTouchStart(a, 10, 10);
    fireTouchMove(a, 30, 30); // dx=20 — beyond 8px tolerance
    vi.advanceTimersByTime(HOLD + 50);

    expect(a.classList.contains(STUCK)).toBe(false);
  });

  it('stays armed when finger drifts within tolerance', () => {
    installLongPressTooltips();
    const a = makeTip('a');

    fireTouchStart(a, 10, 10);
    fireTouchMove(a, 12, 14); // small drift, dx²+dy²=20 < 64
    vi.advanceTimersByTime(HOLD + 5);

    expect(a.classList.contains(STUCK)).toBe(true);
  });

  it('clears stuck on click outside any has-tip', () => {
    installLongPressTooltips();
    const a = makeTip('a');
    const outside = document.createElement('div');
    document.body.appendChild(outside);

    fireTouchStart(a, 10, 10);
    vi.advanceTimersByTime(HOLD + 5);
    expect(a.classList.contains(STUCK)).toBe(true);

    // Outside-touch dismisses the sticky tip on touch devices.
    fireTouchStart(outside, 200, 200);
    expect(a.classList.contains(STUCK)).toBe(false);
  });

  it('transfers stickiness when long-pressing a different has-tip', () => {
    installLongPressTooltips();
    const a = makeTip('a');
    const b = makeTip('b');

    fireTouchStart(a, 10, 10);
    vi.advanceTimersByTime(HOLD + 5);
    expect(a.classList.contains(STUCK)).toBe(true);

    fireTouchStart(b, 80, 80);
    vi.advanceTimersByTime(HOLD + 5);
    expect(a.classList.contains(STUCK)).toBe(false);
    expect(b.classList.contains(STUCK)).toBe(true);
  });

  it('suppresses the synthesized click after a triggered hold', () => {
    installLongPressTooltips();
    const a = makeTip('a');
    let clickFired = false;
    a.addEventListener('click', () => { clickFired = true; });

    fireTouchStart(a, 10, 10);
    vi.advanceTimersByTime(HOLD + 5);
    const ev = fireClick(a);
    expect(ev.defaultPrevented).toBe(true);
    // The click fires (we dispatched it) but its default is suppressed
    // and stopPropagation is called — confirming the controller acted.
    expect(clickFired).toBe(false);
  });

  it('install() is idempotent', () => {
    const h1 = installLongPressTooltips();
    const h2 = installLongPressTooltips();
    expect(h1).toBe(h2);
    h1.dispose();
  });

  it('multi-finger touch cancels the hold (pinch-zoom intent)', () => {
    installLongPressTooltips();
    const a = makeTip('a');

    // Single-finger touch first.
    fireTouchStart(a, 10, 10);
    // Then a multi-touch event arrives.
    const ev = new Event('touchstart', { bubbles: true }) as TouchEvent;
    Object.defineProperty(ev, 'touches', {
      value: [{ clientX: 10, clientY: 10 }, { clientX: 80, clientY: 80 }],
    });
    a.dispatchEvent(ev);
    vi.advanceTimersByTime(HOLD + 5);

    expect(a.classList.contains(STUCK)).toBe(false);
  });

  // 2026-05-14 — body-level state mirror so the suppression CSS in
  // styles/index.css can hide hover tooltips on other elements while
  // one is pinned. Belt-and-suspenders against the
  // "stuck-tip + hover-tip" overlap on desktops with a touchscreen.
  describe('body[data-tip-stuck] mirror', () => {
    it('sets data-tip-stuck on body when a tip becomes stuck', () => {
      installLongPressTooltips();
      const a = makeTip('a');

      expect(document.body.dataset.tipStuck).toBeUndefined();
      fireTouchStart(a, 10, 10);
      vi.advanceTimersByTime(HOLD + 1);
      expect(document.body.dataset.tipStuck).toBe('true');
    });

    it('keeps data-tip-stuck set when long-press transfers stickiness', () => {
      installLongPressTooltips();
      const a = makeTip('a');
      const b = makeTip('b');

      fireTouchStart(a, 10, 10);
      vi.advanceTimersByTime(HOLD + 1);
      expect(document.body.dataset.tipStuck).toBe('true');
      // Tap-elsewhere would clear the stuck (covered by other tests);
      // but a fresh long-press on b should TRANSFER the stuckness, so
      // the body flag stays set throughout.
      fireTouchStart(b, 10, 10);
      vi.advanceTimersByTime(HOLD + 1);
      expect(document.body.dataset.tipStuck).toBe('true');
      expect(__test__.getStuck()).toBe(b);
    });

    it('removes data-tip-stuck on body via __test__.reset()', () => {
      installLongPressTooltips();
      const a = makeTip('a');
      fireTouchStart(a, 10, 10);
      vi.advanceTimersByTime(HOLD + 1);
      expect(document.body.dataset.tipStuck).toBe('true');
      __test__.reset();
      expect(document.body.dataset.tipStuck).toBeUndefined();
    });
  });
});
