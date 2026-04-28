import { useEffect, useState } from 'react';

function isPhonePortrait(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (!coarse) return false;
  return window.innerWidth < window.innerHeight && window.innerWidth < 900;
}

export function OrientationGate() {
  const [locked, setLocked] = useState(isPhonePortrait);

  useEffect(() => {
    const update = () => setLocked(isPhonePortrait());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  useEffect(() => {
    const three = document.getElementById('three-next');
    if (!three) return;
    if (locked) three.classList.remove('active');
  }, [locked]);

  if (!locked) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
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
        FortuneFallacy plays in landscape.
      </div>
      <style>{`
        @keyframes rotateHint {
          0%, 40%, 100% { transform: rotate(0deg); }
          60%, 80% { transform: rotate(-90deg); }
        }
      `}</style>
    </div>
  );
}
