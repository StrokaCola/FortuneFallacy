export type GestureHandlers = {
  onTap?: (ev: PointerEvent) => void;
  onLongPress?: (ev: PointerEvent) => void;
  onSwipe?: (dir: 'up' | 'down' | 'left' | 'right', ev: PointerEvent) => void;
  onDragStart?: (ev: PointerEvent) => void;
  onDragMove?: (ev: PointerEvent, dx: number, dy: number) => void;
  onDragEnd?: (ev: PointerEvent) => void;
};

export type GestureClassification =
  | { kind: 'tap' }
  | { kind: 'longPress' }
  | { kind: 'swipe'; dir: 'up' | 'down' | 'left' | 'right' }
  | { kind: 'drag' }
  | { kind: 'none' };

const TAP_MAX_MS = 250;
const TAP_MAX_PX = 8;
const LONG_PRESS_MS = 450;
const SWIPE_MIN_PX = 32;

export function classifyPointerSequence(input: {
  durationMs: number;
  dx: number;
  dy: number;
  longPressFired: boolean;
}): GestureClassification {
  const { durationMs, dx, dy, longPressFired } = input;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (longPressFired) return { kind: 'longPress' };
  if (dist >= SWIPE_MIN_PX) {
    const dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
    return { kind: 'swipe', dir };
  }
  if (durationMs <= TAP_MAX_MS && dist <= TAP_MAX_PX) return { kind: 'tap' };
  return { kind: 'none' };
}

export function attachGestures(el: HTMLElement, handlers: GestureHandlers): () => void {
  let startX = 0, startY = 0, startT = 0;
  let lastX = 0, lastY = 0;
  let active = false;
  let dragging = false;
  let longPressTimer: number | null = null;
  let longPressFired = false;
  let pointerId: number | null = null;

  const clearLongPress = () => {
    if (longPressTimer != null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const onDown = (ev: PointerEvent) => {
    if (active) return;
    active = true;
    pointerId = ev.pointerId;
    startX = ev.clientX; startY = ev.clientY; startT = performance.now();
    lastX = startX; lastY = startY;
    longPressFired = false;
    dragging = false;
    longPressTimer = window.setTimeout(() => {
      longPressFired = true;
      handlers.onLongPress?.(ev);
    }, LONG_PRESS_MS);
  };

  const onMove = (ev: PointerEvent) => {
    if (!active || ev.pointerId !== pointerId) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > TAP_MAX_PX) clearLongPress();
    if (handlers.onDragMove || handlers.onDragStart || handlers.onDragEnd) {
      if (!dragging && dist > TAP_MAX_PX) {
        dragging = true;
        handlers.onDragStart?.(ev);
      }
      if (dragging) {
        handlers.onDragMove?.(ev, ev.clientX - lastX, ev.clientY - lastY);
      }
    }
    lastX = ev.clientX; lastY = ev.clientY;
  };

  const onUp = (ev: PointerEvent) => {
    if (!active || ev.pointerId !== pointerId) return;
    clearLongPress();
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const durationMs = performance.now() - startT;
    if (dragging) handlers.onDragEnd?.(ev);
    const cls = classifyPointerSequence({ durationMs, dx, dy, longPressFired });
    if (cls.kind === 'tap') handlers.onTap?.(ev);
    else if (cls.kind === 'swipe') handlers.onSwipe?.(cls.dir, ev);
    active = false;
    dragging = false;
    pointerId = null;
  };

  const onCancel = () => {
    clearLongPress();
    active = false;
    dragging = false;
    pointerId = null;
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);

  return () => {
    clearLongPress();
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
  };
}
