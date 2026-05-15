import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';

// AfterglowOverlay — global golden tint fired by the boom catch
// pulse. Mounted at the App root so the glow persists across the
// round → shop screen swap that fires ~200ms after the catch.
// Listens to `onCelebrationAfterglow` (emitted from TopBar at the
// counter-fill tween end) and runs a one-shot fade for the
// requested duration.
//
// Anchored top-center because that's where the score counter lives
// on every responsive layout — the glow looks like it's radiating
// FROM the catch.
export function AfterglowOverlay() {
  const [key, setKey] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  useEffect(() => {
    const off = bus.on('onCelebrationAfterglow', (payload) => {
      // Skip the overlay entirely under reduce-motion — the catch
      // pulse on the counter is enough signal for those players.
      if (
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('reduce-motion')
      ) {
        return;
      }
      setDurationMs(payload.durationMs);
      setKey((k) => k + 1);
    });
    return off;
  }, []);

  if (key === 0) return null;
  return (
    <div
      key={key}
      aria-hidden="true"
      className="vfx-afterglow"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        // Sit above screen contents but below any modal — z 1000
        // matches the rough "overlay" band without colliding with
        // specific tokens. The radial gradient is the entire visual;
        // mix-blend-mode: screen brightens whatever's underneath
        // without flattening contrast.
        zIndex: 1000,
        background: 'radial-gradient(ellipse at 50% 26%, rgba(245,196,81,0.55) 0%, rgba(255,217,122,0.18) 30%, transparent 60%)',
        mixBlendMode: 'screen',
        animationDuration: `${durationMs}ms`,
      }}
    />
  );
}
