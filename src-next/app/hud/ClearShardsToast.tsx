import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { Z } from './zLayers';

// Toast that breaks down the shard reward at blind clear: base / hands /
// interest / voucher / total. Replaces the silent jump in the treasury
// number with an explicit "+5 base / +2 hands / +3 interest" panel so the
// player can connect each clear to their efficiency and savings.
//
// Listens for `onBlindCleared.reward` (added in the shard rebalance) and
// renders for ~2.4s before fading. Auto-dismisses if the player navigates
// to the shop early — the unmount on screen change clears it.

type Reward = {
  base: number;
  voucher: number;
  hands: number;
  interest: number;
  total: number;
};

type Toast = { id: number; reward: Reward };
let toastId = 1;

const HOLD_MS = 2400;
const ROW = 'f-mono num';

export function ClearShardsToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = bus.on('onBlindCleared', ({ reward }) => {
      if (!reward) return;
      const id = toastId++;
      setToast({ id, reward });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setToast((cur) => (cur && cur.id === id ? null : cur));
        timerRef.current = null;
      }, HOLD_MS);
    });
    return () => {
      off();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  if (!toast) return null;
  const { reward } = toast;

  // Hide zero rows so a "no held shards / no hands left" clear stays clean.
  const rows: { label: string; amount: number; color: string }[] = [];
  rows.push({ label: 'base', amount: reward.base, color: '#f5c451' });
  if (reward.voucher > 0) rows.push({ label: 'voucher', amount: reward.voucher, color: '#bba8ff' });
  if (reward.hands > 0)   rows.push({ label: 'hands left', amount: reward.hands, color: '#7be3ff' });
  if (reward.interest > 0) rows.push({ label: 'interest', amount: reward.interest, color: '#9577ff' });

  return (
    <div
      key={toast.id}
      style={{
        position: 'absolute',
        left: '50%',
        // Center within play area (between TopBar and ActionBar).
        top: 'calc(var(--hud-top-h, 0px) + (var(--stage-h, 100vh) - var(--hud-top-h, 0px) - var(--hud-bottom-h, 0px)) * 0.38)',
        transform: 'translate(-50%, -50%)',
        zIndex: Z.toast,
        pointerEvents: 'none',
        background: 'rgba(15, 9, 37, 0.92)',
        border: '1px solid rgba(245, 196, 81, 0.55)',
        boxShadow: '0 0 32px rgba(245, 196, 81, 0.25), 0 8px 24px rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: '14px 22px',
        minWidth: 220,
        animation: 'fadein 0.3s ease-out',
      }}
    >
      <div className="f-mono uc" style={{
        fontSize: 10, letterSpacing: '0.32em',
        color: '#f5c451', textAlign: 'center', marginBottom: 8,
      }}>
        ◇ blind cleared ◇
      </div>
      {rows.map((r) => (
        <div key={r.label} style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline', gap: 16, marginTop: 2,
        }}>
          <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.18em', color: r.color }}>
            {r.label}
          </span>
          <span className={ROW} style={{ fontSize: 18, color: r.color, fontWeight: 600 }}>
            +{r.amount}
          </span>
        </div>
      ))}
      <div style={{
        marginTop: 8, paddingTop: 8,
        borderTop: '1px dashed rgba(245, 196, 81, 0.45)',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 16,
      }}>
        <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#dcd4ff' }}>
          shards
        </span>
        <span className={ROW} style={{
          fontSize: 26, color: '#f5c451', fontWeight: 700,
          textShadow: '0 0 12px rgba(245, 196, 81, 0.6)',
        }}>
          +{reward.total}
        </span>
      </div>
    </div>
  );
}
