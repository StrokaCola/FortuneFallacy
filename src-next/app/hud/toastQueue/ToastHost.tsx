// Renders the queue's visible toasts. Mount once at the App root;
// every consumer pushes via `pushToast()` and gets a slot here.
//
// Layout: stack visible toasts vertically at the top-center of the
// viewport, newest on top. Each toast calls its own `render(data)`
// function so the queue stays content-agnostic — the host doesn't
// know whether a slot holds a "+5 shards" pill or an achievement
// banner.
//
// The host is intentionally minimal CSS — toasts can render their
// own borders, backgrounds, accent colors. The wrapper provides
// position + key + fade-in animation.

import { Z } from '../zLayers';
import { useToastQueue, useToastTicker } from './useToastQueue';

export function ToastHost() {
  // Drive the queue's TICK action on a steady cadence so visible
  // toasts expire and pending toasts promote without the consumer
  // having to schedule it themselves.
  useToastTicker();

  const { visible } = useToastQueue();
  if (visible.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      style={{
        position: 'absolute',
        // Below the TopBar so toasts read against the play surface,
        // above the catalyst strip + dice canvas via z-index. Anchored
        // top-center so they're glanceable but never block the score.
        top: 'calc(var(--hud-top-h, 134px) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: Z.toast,
      }}
    >
      {visible.map((t) => (
        <div
          key={t.id}
          // Wrapper provides the fade-in / slide-down entry. Toast
          // content controls its own internal styling. `pointerEvents`
          // re-enabled per-toast so individual notifications can be
          // dismissable if their renderer wants.
          style={{
            pointerEvents: 'auto',
            animation: 'toast-slide-in 220ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
          }}
        >
          {t.render(t.data)}
        </div>
      ))}
      {/* Keyframes — local to the host so the queue module doesn't
          require a CSS file. */}
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
