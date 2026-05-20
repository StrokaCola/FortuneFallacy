// Wave T+1 (2026-05-19) — lock-click ripple. Listens to
// onLockClickRipple (emitted by Dice3D on pointer-up that resolves to
// a lock toggle) and renders an expanding ring centered at the
// pointer coordinates. Reads as "the click did something here"
// without competing with the die's own scale-bounce, since the die
// pulse stays on the die and this lives on the cursor.

import { useEffect, useState } from 'react';
import type React from 'react';
import { bus } from '../../events/bus';
import { Z } from './zLayers';

type Ripple = {
  id: number;
  x: number;
  y: number;
  color: string;
};

const RIPPLE_MS = 520;
const COLOR_LOCK = '#7be3ff';
const COLOR_UNLOCK = '#bba8ff';

let nextId = 1;

function motionReduced(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
}

export function LockClickRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    const off = bus.on('onLockClickRipple', ({ x, y, locked }) => {
      if (motionReduced()) return;
      const id = nextId++;
      const color = locked ? COLOR_LOCK : COLOR_UNLOCK;
      setRipples((cur) => [...cur, { id, x, y, color }]);
      window.setTimeout(() => {
        setRipples((cur) => cur.filter((r) => r.id !== id));
      }, RIPPLE_MS + 40);
    });
    return () => off();
  }, []);

  if (ripples.length === 0) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0,
        pointerEvents: 'none',
        zIndex: Z.fx,
        overflow: 'hidden',
      }}
    >
      {ripples.map((r) => (
        <RippleRing key={r.id} r={r} />
      ))}
    </div>
  );
}

function RippleRing({ r }: { r: Ripple }) {
  const style: React.CSSProperties & Record<string, string | number> = {
    position: 'absolute',
    left: r.x,
    top: r.y,
    transform: 'translate(-50%, -50%)',
    width: 0,
    height: 0,
    borderRadius: '50%',
    border: `2px solid ${r.color}`,
    boxShadow: `0 0 18px ${r.color}77, 0 0 36px ${r.color}33`,
    pointerEvents: 'none',
    willChange: 'width, height, opacity',
    animation: `lock-click-ripple ${RIPPLE_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards`,
    ['--rip-color' as string]: r.color,
  };
  return <div style={style} />;
}
