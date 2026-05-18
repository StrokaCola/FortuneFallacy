// Aliveness pass (2026-05-18). First-encounter discovery moment.
// Mounts a self-contained overlay that plays a brief slow-pan +
// sparkle + name flourish the first time the player sees a
// catalyst. Rare editions (poly/holo/foil/void) get an extra
// slo-mo zoom on top.
//
// Self-contained: takes catalyst name + optional edition, runs a
// CSS keyframe sequence on mount, then fades. No state coupling —
// OfferCard mounts this exactly when the discovery moment should
// fire. The dispatch into meta.discovered happens via the
// onCatalystDiscovered bus event the parent emits.

import { useEffect, useState } from 'react';

const RARE_EDITIONS = new Set(['poly', 'holo', 'void']);

export function RevealAnimation({
  name,
  edition,
}: {
  name: string;
  edition?: 'foil' | 'holo' | 'poly' | 'void' | null;
}) {
  const [visible, setVisible] = useState(true);
  const slowMo = edition != null && RARE_EDITIONS.has(edition);
  const durationMs = slowMo ? 2000 : 1200;

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes ffReveal-pan {
          0%   { transform: translateX(-40%) scale(0.6); opacity: 0; }
          25%  { opacity: 1; }
          75%  { transform: translateX(0%)   scale(1.0); opacity: 1; }
          100% { transform: translateX(0%)   scale(1.0); opacity: 0; }
        }
        @keyframes ffReveal-sparkle {
          0%   { opacity: 0; transform: scale(0.4); }
          30%  { opacity: 1; transform: scale(1.0); }
          70%  { opacity: 1; transform: scale(1.6); }
          100% { opacity: 0; transform: scale(2.4); }
        }
        @keyframes ffReveal-banner {
          0%   { opacity: 0; transform: translateY(8px); letter-spacing: 0.08em; }
          25%  { opacity: 1; transform: translateY(0);   letter-spacing: 0.24em; }
          75%  { opacity: 1; transform: translateY(0);   letter-spacing: 0.24em; }
          100% { opacity: 0; transform: translateY(-4px); letter-spacing: 0.32em; }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 5,
          animation: `ffReveal-pan ${durationMs}ms cubic-bezier(0.2,0.8,0.2,1) both`,
          background: slowMo
            ? 'radial-gradient(circle at 30% 50%, rgba(255,217,122,0.32) 0%, rgba(149,119,255,0.18) 35%, transparent 70%)'
            : 'radial-gradient(circle at 30% 50%, rgba(149,119,255,0.22) 0%, transparent 60%)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '38%', left: '50%',
          width: 14, height: 14,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 6,
          background: slowMo
            ? 'radial-gradient(circle, #ffd97a 0%, rgba(255,217,122,0.5) 50%, transparent 100%)'
            : 'radial-gradient(circle, #b7a5ff 0%, rgba(123,227,255,0.4) 50%, transparent 100%)',
          animation: `ffReveal-sparkle ${durationMs}ms ease-out both`,
        }}
      />
      <div
        className="f-mono uc"
        style={{
          position: 'absolute',
          bottom: '20%', left: 0, right: 0,
          textAlign: 'center',
          fontSize: 10,
          color: slowMo ? '#ffd97a' : '#b7a5ff',
          textShadow: slowMo
            ? '0 0 10px rgba(255,217,122,0.6), 0 0 24px rgba(255,217,122,0.3)'
            : '0 0 8px rgba(149,119,255,0.6)',
          pointerEvents: 'none',
          zIndex: 6,
          animation: `ffReveal-banner ${durationMs}ms ease-out both`,
        }}
      >
        {slowMo ? `◆ ${edition?.toUpperCase()} · NEW ◆` : '✦ new ✦'}
        <div style={{ fontSize: 11, marginTop: 4, letterSpacing: '0.18em', color: '#f3f0ff' }}>
          {name}
        </div>
      </div>
    </>
  );
}
