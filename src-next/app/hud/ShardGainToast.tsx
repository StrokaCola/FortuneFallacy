import { useEffect, useRef, useState } from 'react';
import { store, type GameState } from '../../state/store';
import { Z } from './zLayers';
import { sfxPlay } from '../../audio/sfx';

// Floating "+N ◇" toast triggered by any shard-gain during a round (mod
// shardsBonus, refinery, stipend, etc.). Watches the store so we don't have
// to thread events through every gain site. Only fires on `round`/`hub`
// screens; shop/forge purchases are silent here because those screens
// already give explicit feedback.

type Toast = { id: number; amount: number };
let toastId = 1;

const HOLD_MS = 900;

const selectShards = (s: GameState) => s.run.shards;
const selectScreen = (s: GameState) => s.ui.screen;

export function ShardGainToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastShardsRef = useRef<number>(store.getState().run.shards);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Track shards via the raw store subscription so we see every delta
  // (selector subscriptions debounce identical values but not transient ones).
  useEffect(() => {
    const unsub = store.subscribe((s) => {
      const cur = selectShards(s);
      const prev = lastShardsRef.current;
      const screen = selectScreen(s);
      lastShardsRef.current = cur;
      const delta = cur - prev;
      if (delta <= 0) return;
      if (screen !== 'round' && screen !== 'hub') return;
      const id = toastId++;
      setToasts((t) => [...t, { id, amount: delta }]);
      // Per-coin clinks — discrete chipTick per shard with rising pitch,
      // capped at MAX_CLINKS so a +20 blind-clear bonus doesn't burst
      // the voice pool. Light pitch jitter + spacing variance so the
      // sequence sounds organic instead of a clean arpeggio.
      const MAX_CLINKS = 8;
      const clinkCount = Math.min(MAX_CLINKS, delta);
      for (let i = 0; i < clinkCount; i++) {
        const baseHz = 540 + i * 28;
        const jitter = (Math.random() - 0.5) * 18;
        const t = setTimeout(() => {
          sfxPlay('chipTick', { freq: baseHz + jitter, gain: 0.55 });
          timersRef.current.delete(t);
        }, i * (32 + Math.random() * 14));
        timersRef.current.add(t);
      }
      const timer = setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
        timersRef.current.delete(timer);
      }, HOLD_MS);
      timersRef.current.add(timer);
    });
    return () => {
      unsub();
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  return (
    <>
      {toasts.map((t, i) => (
        <div key={t.id} style={{
          position: 'absolute',
          // Anchor to the LEFT of the TopBar treasury panel (right:18,
          // minWidth:200 → panel reaches right ~218). 232 puts the toast
          // just outside that panel so it never covers the shard count
          // it's celebrating. Stack vertically with a small step.
          top: 32 + i * 20, right: 240,
          zIndex: Z.toast, pointerEvents: 'none',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 16, fontWeight: 700,
          color: '#f5c451',
          textShadow: '0 0 14px #f5c451, 0 0 28px rgba(245,196,81,0.5)',
          animation: 'shard-gain-toast 900ms cubic-bezier(0.2, 1.2, 0.4, 1) forwards',
        }}>
          +{t.amount} ◇
        </div>
      ))}
    </>
  );
}
