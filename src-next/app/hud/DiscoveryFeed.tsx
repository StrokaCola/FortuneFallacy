// Aliveness pass (2026-05-18). Run discovery sidebar.
// Corner toast feed that surfaces "first time you saw this" moments
// during a run. Stacks up to 3 toasts in the bottom-right; each fades
// after 5s. Subscribes to onCatalystDiscovered and onEditionDiscovered;
// independent of the in-shop reveal animation (which fires within
// the offer card itself) — this is the run-level acknowledgement
// that builds the collection feeling.
//
// Mounted once near the app shell. Self-contained — no Zustand
// selectors, no animation libraries, just CSS keyframes.

import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { lookupCatalyst } from '../../data/catalysts';

type Toast = {
  id: number;
  label: string;
  detail: string;
  accent: 'common' | 'edition';
};

const STACK_LIMIT = 3;
const LIFETIME_MS = 5000;
let toastCounter = 0;

export function DiscoveryFeed() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const push = (toast: Omit<Toast, 'id'>) => {
      setToasts((cur) => {
        const next: Toast = { ...toast, id: ++toastCounter };
        const stacked = [...cur, next].slice(-STACK_LIMIT);
        return stacked;
      });
    };

    const offCatalyst = bus.on('onCatalystDiscovered', ({ catalystId, total }) => {
      const def = lookupCatalyst(catalystId);
      if (!def) return;
      push({
        label: def.name,
        detail: total > 0 ? `discovered · catalyst` : 'discovered · catalyst',
        accent: 'common',
      });
    });
    const offEdition = bus.on('onEditionDiscovered', ({ edition }) => {
      push({
        label: `${edition.toUpperCase()} edition`,
        detail: 'first encounter',
        accent: 'edition',
      });
    });
    return () => {
      offCatalyst();
      offEdition();
    };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    if (!oldest) return;
    const t = window.setTimeout(() => {
      setToasts((cur) => cur.filter((toast) => toast.id !== oldest.id));
    }, LIFETIME_MS);
    return () => window.clearTimeout(t);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 60,
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes ffDiscoveryToast-in {
          0%   { opacity: 0; transform: translateX(20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="panel-strong"
          style={{
            padding: '8px 12px',
            minWidth: 200,
            maxWidth: 280,
            borderLeft: `2px solid ${t.accent === 'edition' ? '#ffd97a' : '#b7a5ff'}`,
            animation: 'ffDiscoveryToast-in 280ms ease-out both',
            background: 'rgba(20,16,40,0.88)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            className="f-mono uc"
            style={{
              fontSize: 9,
              letterSpacing: '0.22em',
              color: t.accent === 'edition' ? '#ffd97a' : '#b7a5ff',
              marginBottom: 2,
            }}
          >
            ✦ {t.detail}
          </div>
          <div style={{ fontSize: 12, color: '#f3f0ff' }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}
