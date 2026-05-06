import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { Z } from './zLayers';

type Toast = { id: number; ts: number };
let toastId = 1;

export function ShardDeductToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const off = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      if (payload.id !== 'shard_sink') return;
      const id = toastId++;
      setToasts((t) => [...t, { id, ts: Date.now() }]);
      const timer = setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
        timersRef.current.delete(timer);
      }, 600);
      timersRef.current.add(timer);
    });
    return () => {
      off();
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  return (
    <>
      {toasts.map((t) => (
        <div key={t.id} style={{
          position: 'absolute',
          // Anchored left of the treasury panel (see ShardGainToast).
          top: 32, right: 240,
          zIndex: Z.toast, pointerEvents: 'none',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 14, fontWeight: 700,
          color: '#f5c451',
          textShadow: '0 0 10px #f5c451',
          animation: 'shard-deduct-toast 600ms ease-out forwards',
        }}>
          −1 ◇
        </div>
      ))}
    </>
  );
}
