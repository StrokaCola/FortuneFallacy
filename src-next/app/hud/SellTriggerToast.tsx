// Celebration toast for on-sell catalyst triggers (Stipend, Audit,
// Compounding Bias). Migrated to the central toast queue 2026-05-14
// — the listener + per-fire descriptor stays here; rendering now
// runs through `app/hud/toastQueue/ToastHost`.

import { useEffect } from 'react';
import { bus } from '../../events/bus';
import { lookupCatalyst } from '../../data/catalysts';
import { pushToast } from './toastQueue';

const HOLD_MS = 2400;

type SellTriggerData = {
  catalystId: string;
  catalystName: string;
  label: string;
  delta: number;
  color: string;
};

function renderSellTrigger({ catalystName, label, delta, color }: SellTriggerData) {
  return (
    <div
      className="mat-crystal sell-trigger-toast"
      style={{
        padding: '8px 18px',
        borderRadius: 10,
        border: `1px solid ${color}aa`,
        boxShadow: `0 0 24px ${color}55, 0 8px 18px rgba(0,0,0,0.4)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        minWidth: 200,
      }}
    >
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.36em',
        color, textShadow: `0 0 8px ${color}55`,
      }}>
        ◇ {catalystName} on sell ◇
      </div>
      <div className="f-mono" style={{ fontSize: 12, color: '#f5c451' }}>
        {label}
      </div>
      {delta > 0 && (
        <div className="f-mono num" style={{ fontSize: 11, color: '#f3f0ff' }}>
          +{delta} ◇
        </div>
      )}
    </div>
  );
}

export function SellTriggerToast() {
  useEffect(() => {
    const off = bus.on('onSellTrigger', (payload) => {
      const meta = lookupCatalyst(payload.catalystId);
      pushToast<SellTriggerData>({
        id: `sell-${payload.catalystId}-${Date.now()}`,
        // No grouping key — each on-sell fire is its own beat the
        // player wants to read individually (different catalyst, or
        // same catalyst sold twice).
        priority: 'normal',
        durationMs: HOLD_MS,
        data: {
          catalystId: payload.catalystId,
          catalystName: meta?.name ?? payload.catalystId,
          label: payload.label,
          delta: payload.shardsAfter - payload.shardsBefore,
          color: meta?.color ?? '#f5c451',
        },
        render: renderSellTrigger,
      });
    });
    return () => off();
  }, []);

  return null;
}
