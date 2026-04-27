import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';

type Burst = { id: number; x: number; y: number; tier: number; color: string };
type FloatText = { id: number; text: string; x: number; y: number; color: string };

const TIER_COLORS = ['#9577ff', '#7be3ff', '#dcd4ff', '#5be8a4', '#f5c451', '#ff7847', '#ff4d6d', '#ff8edc', '#ffe98a'];

let nextId = 1;

export function Particles() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off1 = bus.on('onComboDetected', ({ tier }) => {
      const x = window.innerWidth / 2;
      const y = window.innerHeight / 2 - 80;
      const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)] ?? '#9577ff';
      const id = nextId++;
      setBursts((b) => [...b, { id, x, y, tier, color }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
    });
    const off2 = bus.on('onScoreCalculated', ({ total }) => {
      const id = nextId++;
      const x = window.innerWidth / 2;
      const y = window.innerHeight / 2 - 60;
      setFloats((f) => [...f, { id, text: `+${total.toLocaleString()}`, x, y, color: '#f5c451' }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1400);
    });
    const off3 = bus.on('onUpgradeTriggered', () => {
      const x = window.innerWidth * 0.2 + Math.random() * window.innerWidth * 0.6;
      const y = window.innerHeight * 0.4 + Math.random() * 80;
      const id = nextId++;
      setBursts((b) => [...b, { id, x, y, tier: 0, color: '#7be3ff' }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 700);
    });
    return () => { off1(); off2(); off3(); };
  }, []);

  return (
    <div ref={targetRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
      {bursts.map((b) => (
        <Ring key={b.id} x={b.x} y={b.y} color={b.color} tier={b.tier} />
      ))}
      {floats.map((f) => (
        <FloatPop key={f.id} x={f.x} y={f.y} text={f.text} color={f.color} />
      ))}
    </div>
  );
}

function Ring({ x, y, color, tier }: { x: number; y: number; color: string; tier: number }) {
  const size = 30 + tier * 14;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        border: `3px solid ${color}`,
        boxShadow: `0 0 32px ${color}`,
        animation: 'ringExpand 0.85s ease-out forwards',
        opacity: 0.95,
      }}
    />
  );
}

function FloatPop({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, 0)',
        color,
        fontFamily: '"Cinzel Decorative", serif',
        fontSize: 32,
        fontWeight: 700,
        textShadow: `0 0 16px ${color}`,
        animation: 'floatUp 1.4s ease-out forwards',
      }}>
      {text}
    </div>
  );
}
