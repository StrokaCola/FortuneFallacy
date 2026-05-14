import { useEffect, useRef } from 'react';
import { store, type GameState } from '../../state/store';
import { sfxPlay } from '../../audio/sfx';
import { pushToast } from './toastQueue';

// Listens for shard gains during `round` / `hub` screens and pushes a
// "+N ◇" notification into the central toast queue. Same-key merging
// means a chain of small gains (mod shardsBonus, refinery, stipend)
// shows as a single coalesced "+8 ◇" rather than four overlapping
// "+2" pops at the same Y. The chipTick clink ladder is preserved —
// it never coalesces; each shard gets a per-coin click.
//
// Migrated to the toast queue 2026-05-14 — see `app/hud/toastQueue/`
// for the queue architecture and `docs/design/toast-queue.md` for the
// migration pattern.

type ShardGainData = { amount: number };

const HOLD_MS = 1100;
const SHARD_GAIN_KEY = 'shard-gain';

const selectShards = (s: GameState) => s.run.shards;
const selectScreen = (s: GameState) => s.ui.screen;

function renderShardGain({ amount }: ShardGainData) {
  return (
    <div style={{
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 16, fontWeight: 700,
      color: '#f5c451',
      textShadow: '0 0 14px #f5c451, 0 0 28px rgba(245,196,81,0.5)',
      padding: '4px 12px',
      borderRadius: 6,
      background: 'rgba(15,9,37,0.7)',
      border: '1px solid rgba(245,196,81,0.5)',
    }}>
      +{amount} ◇
    </div>
  );
}

export function ShardGainToast() {
  const lastShardsRef = useRef<number>(store.getState().run.shards);
  const clinkTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const unsub = store.subscribe((s) => {
      const cur = selectShards(s);
      const prev = lastShardsRef.current;
      const screen = selectScreen(s);
      lastShardsRef.current = cur;
      const delta = cur - prev;
      if (delta <= 0) return;
      if (screen !== 'round' && screen !== 'hub') return;

      // Per-coin clinks — discrete chipTick per shard with rising
      // pitch, capped at MAX_CLINKS so a +20 blind-clear bonus doesn't
      // burst the voice pool. Light pitch jitter + spacing variance
      // so the sequence sounds organic instead of a clean arpeggio.
      const MAX_CLINKS = 8;
      const clinkCount = Math.min(MAX_CLINKS, delta);
      const timers = clinkTimersRef.current;
      for (let i = 0; i < clinkCount; i++) {
        const baseHz = 540 + i * 28;
        const jitter = (Math.random() - 0.5) * 18;
        const t = setTimeout(() => {
          sfxPlay('chipTick', { freq: baseHz + jitter, gain: 0.55 });
          timers.delete(t);
        }, i * (32 + Math.random() * 14));
        timers.add(t);
      }

      // Push to the queue. Same-key merge means rapid back-to-back
      // gains coalesce into a single visible toast whose amount sums.
      pushToast<ShardGainData>({
        id: `shard-gain-${Date.now()}-${delta}`,
        key: SHARD_GAIN_KEY,
        priority: 'low',
        durationMs: HOLD_MS,
        data: { amount: delta },
        render: renderShardGain,
        merge: (incoming, current) => ({ amount: current.amount + incoming.amount }),
      });
    });
    return () => {
      unsub();
      clinkTimersRef.current.forEach((t) => clearTimeout(t));
      clinkTimersRef.current.clear();
    };
  }, []);

  // No JSX — the central ToastHost renders the queue.
  return null;
}
