// "Arrived from {portal}" pill that fires once on portal-entry.
// Migrated to the central toast queue 2026-05-14.

import { useEffect } from 'react';
import { pushToast, toastQueue } from './toastQueue';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';

const HOLD_MS = 5000;

type ArrivalData = { from: string; toastId: string };

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 24);
  }
}

function renderArrival({ from, toastId }: ArrivalData) {
  return (
    <div
      // Click-to-dismiss preserved from the pre-migration toast.
      onClick={() => toastQueue.dismiss(toastId)}
      onPointerDown={(e) => {
        sfxPlay('uiHoverSoft');
        if (e.pointerType === 'touch') playHaptic('tap');
      }}
      className="mat-crystal"
      style={{
        padding: '8px 16px', borderRadius: 10,
        cursor: 'pointer',
      }}>
      <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.28em', color: '#7be3ff' }}>
        ✦ arrived from <span style={{ color: '#f5c451' }}>{from}</span>
      </span>
    </div>
  );
}

export function ArrivalToast() {
  useEffect(() => {
    const params = window.Portal?.readPortalParams();
    if (!params?.fromPortal) return;
    const ref = params.ref;
    const from = ref ? extractDomain(ref) : 'the void';
    const toastId = `arrival-${Date.now()}`;
    pushToast<ArrivalData>({
      id: toastId,
      // Single-fire, low priority — the player gets it as a "by the
      // way" beat, not a celebration. Other toasts can preempt.
      priority: 'low',
      durationMs: HOLD_MS,
      data: { from, toastId },
      render: renderArrival,
    });
  }, []);

  return null;
}
