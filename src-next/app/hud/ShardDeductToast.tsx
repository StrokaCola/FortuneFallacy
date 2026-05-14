import { useEffect } from 'react';
import { bus } from '../../events/bus';
import { pushToast } from './toastQueue';

// Listens for `shard_sink` upgrade fires and pushes a "−1 ◇"
// notification into the central toast queue. Migrated alongside
// ShardGainToast on 2026-05-14 — see `docs/design/toast-queue.md`.

type ShardDeductData = { amount: number };

const HOLD_MS = 700;
const SHARD_DEDUCT_KEY = 'shard-deduct';

function renderShardDeduct({ amount }: ShardDeductData) {
  return (
    <div style={{
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 14, fontWeight: 700,
      color: '#f5c451',
      textShadow: '0 0 10px #f5c451',
      padding: '3px 10px',
      borderRadius: 6,
      background: 'rgba(15,9,37,0.7)',
      border: '1px solid rgba(245,196,81,0.4)',
    }}>
      −{amount} ◇
    </div>
  );
}

export function ShardDeductToast() {
  useEffect(() => {
    const off = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      if (payload.id !== 'shard_sink') return;
      pushToast<ShardDeductData>({
        id: `shard-deduct-${Date.now()}`,
        key: SHARD_DEDUCT_KEY,
        priority: 'low',
        durationMs: HOLD_MS,
        data: { amount: 1 },
        render: renderShardDeduct,
        merge: (incoming, current) => ({ amount: current.amount + incoming.amount }),
      });
    });
    return () => off();
  }, []);

  return null;
}
