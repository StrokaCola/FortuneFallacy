import { useEffect, useState } from 'react';
import { Z } from './zLayers';
import { store } from '../../state/store';
import { getOrientationOverride, subscribeOrientationOverride } from '../a11y/inputPrefs';

// Phones now play in PORTRAIT (was landscape). Phone screens are designed
// for portrait usage, and the dice tray + HUD have plenty of room when
// the long axis is vertical. Coarse-pointer (touch) devices in landscape
// with a short viewport (height < 600 CSS) get the rotate prompt.
//
// Desktop (no coarse pointer) is unaffected — landscape continues to be
// the default and only orientation that matters there.
//
// Motor-a11y override: players who can only hold their device in a fixed
// orientation can disable this gate via Settings → Allow landscape on phone.
function isPhoneLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (!coarse) return false;
  // Wider than tall AND short viewport — typical phone landscape.
  return window.innerWidth > window.innerHeight && window.innerHeight < 600;
}

export function OrientationGate() {
  const [override, setOverride] = useState(getOrientationOverride);
  const [phoneLand, setPhoneLand] = useState(isPhoneLandscape);
  const locked = phoneLand && !override;

  useEffect(() => {
    const update = () => setPhoneLand(isPhoneLandscape());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  useEffect(() => subscribeOrientationOverride(() => setOverride(getOrientationOverride())), []);

  useEffect(() => {
    const three = document.getElementById('three-next');
    if (!three) return;
    if (locked) {
      three.classList.remove('active');
    } else {
      // Releasing the lock (user rotated to the supported orientation)
      // — re-sync the canvas's .active class with the current screen.
      // main.tsx only flips it on screen-change, so without this branch
      // the canvas stays display:none after a landscape→portrait rotate
      // mid-trial and the dice never reappear.
      const screen = store.getState().ui.screen;
      three.classList.toggle('active', screen === 'round');
    }
  }, [locked]);

  if (!locked) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z.orientation,
        background: 'rgba(7,5,26,0.96)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#dcd4ff',
        fontFamily: "'Cinzel', serif",
        textAlign: 'center',
        padding: 24,
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          // Portrait-shaped phone outline (was landscape: 64×100, swap
          // to 100×64 via aspect — actually keep the 64×100 portrait
          // shape and animate the existing landscape→portrait rotation
          // hint backward).
          width: 64,
          height: 100,
          border: '3px solid #9577ff',
          borderRadius: 10,
          marginBottom: 24,
          animation: 'rotateHint 2.4s ease-in-out infinite',
          boxShadow: '0 0 24px rgba(149,119,255,.45)',
        }}
      />
      <div style={{ fontSize: 22, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 8 }}>
        Rotate Device
      </div>
      <div style={{ fontSize: 14, opacity: 0.7, fontFamily: "'Exo 2', sans-serif", letterSpacing: 0 }}>
        FortuneFallacy plays in portrait on mobile.
      </div>
      <style>{`
        /* Hint goes from portrait → landscape → portrait, mirroring the
           rotation the user needs to perform (we're showing what
           they're currently holding, and how to rotate it). */
        @keyframes rotateHint {
          0%, 40%, 100% { transform: rotate(90deg); }
          60%, 80% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
