import { useEffect, useState } from 'react';

const KEY = 'ff:hintSeen';

export function AstralHint() {
  const [show, setShow] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && !window.localStorage.getItem(KEY);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!show) return;
    const dismiss = () => {
      setShow(false);
      try { window.localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    };
    const t = setTimeout(dismiss, 8000);
    const onAny = () => dismiss();
    window.addEventListener('pointerdown', onAny, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', onAny);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 18,
        bottom: 18,
        zIndex: 4,
        maxWidth: 300,
        fontFamily: '"Exo 2", sans-serif',
        fontSize: 11,
        color: '#bba8ff',
        lineHeight: 1.5,
        pointerEvents: 'none',
        animation: 'fadein 0.6s ease-out',
      }}
    >
      <span
        className="f-mono uc"
        style={{ letterSpacing: '0.2em', color: '#7be3ff', display: 'block', marginBottom: 4 }}
      >
        ◇ tip
      </span>
      Click any die to lock for the next roll. Highlighted dice mark the scoring pattern — Lyra, Orion, etc.
    </div>
  );
}
