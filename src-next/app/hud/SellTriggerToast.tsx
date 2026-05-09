// Celebration toast for on-sell catalyst triggers (Stipend, Audit,
// Compounding Bias). Mounts at the App level so it shows whether the
// player is in the shop, the postmortem, or anywhere else when the
// trigger fires. Auto-dismisses after 2.4s.

import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { lookupCatalyst } from '../../data/catalysts';
import { Z } from './zLayers';

const HOLD_MS = 2400;

type Toast = {
  key: number;
  catalystId: string;
  label: string;
  delta: number;
  color: string;
};

let toastKey = 1;

export function SellTriggerToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const off = bus.on('onSellTrigger', (payload) => {
      const meta = lookupCatalyst(payload.catalystId);
      const t: Toast = {
        key: toastKey++,
        catalystId: payload.catalystId,
        label: payload.label,
        delta: payload.shardsAfter - payload.shardsBefore,
        color: meta?.color ?? '#f5c451',
      };
      setToasts((cur) => [...cur, t]);
      window.setTimeout(() => {
        setToasts((cur) => cur.filter((x) => x.key !== t.key));
      }, HOLD_MS);
    });
    return () => off();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        left: '50%', top: '24%',
        transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', gap: 6,
        pointerEvents: 'none',
        zIndex: Z.bannerArrival,
      }}
    >
      {toasts.map((t, i) => {
        const meta = lookupCatalyst(t.catalystId);
        return (
          <div
            key={t.key}
            className="mat-crystal sell-trigger-toast"
            style={{
              padding: '8px 18px',
              borderRadius: 10,
              border: `1px solid ${t.color}aa`,
              boxShadow: `0 0 24px ${t.color}55, 0 8px 18px rgba(0,0,0,0.4)`,
              animation: `achievement-toast-in 380ms cubic-bezier(0.2, 1.2, 0.4, 1) ${i * 60}ms both`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              minWidth: 200,
            }}
          >
            <div className="f-mono uc" style={{
              fontSize: 9, letterSpacing: '0.36em',
              color: t.color,
              textShadow: `0 0 8px ${t.color}55`,
            }}>
              ◇ {meta?.name ?? t.catalystId} on sell ◇
            </div>
            <div className="f-mono" style={{
              fontSize: 12, color: '#f5c451',
            }}>
              {t.label}
            </div>
            {t.delta > 0 && (
              <div className="f-mono num" style={{
                fontSize: 11, color: '#f3f0ff',
              }}>
                +{t.delta} ◇
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
