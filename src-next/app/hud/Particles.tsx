import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';

type Burst = { id: number; x: number; y: number; tier: number; color: string };
type FloatText = { id: number; text: string; x: number; y: number; color: string };
type Shock = { id: number; x: number; y: number; scale: number };
type FlyNum = { id: number; fromX: number; fromY: number; toX: number; toY: number; text: string; color: string };

const TIER_COLORS = ['#9577ff', '#7be3ff', '#dcd4ff', '#5be8a4', '#f5c451', '#ff7847', '#ff4d6d', '#ff8edc', '#ffe98a'];

let nextId = 1;

export function Particles() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [shocks, setShocks] = useState<Shock[]>([]);
  const [flies, setFlies] = useState<FlyNum[]>([]);
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
    const off4 = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'mult-slam') {
        const id = nextId++;
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 2;
        setShocks((s) => [...s, { id, x, y, scale: beat.ampScale }]);
        setTimeout(() => setShocks((s) => s.filter((v) => v.id !== id)), 600);
      }
      if (beat.kind === 'die-tick') {
        const id = nextId++;
        const counterEl = document.querySelector('[data-score-counter]') as HTMLElement | null;
        const r = counterEl?.getBoundingClientRect();
        const toX = r ? r.left + r.width / 2 : window.innerWidth / 2;
        const toY = r ? r.top + r.height / 2 : 80;
        const fromX = window.innerWidth * (0.2 + 0.15 * beat.dieIdx);
        const fromY = window.innerHeight * 0.65;
        setFlies((f) => [...f, { id, fromX, fromY, toX, toY, text: `+${beat.chipDelta}`, color: '#7be3ff' }]);
        setTimeout(() => setFlies((f) => f.filter((v) => v.id !== id)), 600);
      }
    });
    return () => { off1(); off2(); off3(); off4(); };
  }, []);

  return (
    <div ref={targetRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
      {bursts.map((b) => (
        <Ring key={b.id} x={b.x} y={b.y} color={b.color} tier={b.tier} />
      ))}
      {floats.map((f) => (
        <FloatPop key={f.id} x={f.x} y={f.y} text={f.text} color={f.color} />
      ))}
      {shocks.map((s) => (
        <Shockwave key={s.id} x={s.x} y={s.y} scale={s.scale} />
      ))}
      {flies.map((f) => (
        <FlyingNumber key={f.id} from={{ x: f.fromX, y: f.fromY }} to={{ x: f.toX, y: f.toY }} text={f.text} color={f.color} />
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

function Shockwave({ x, y, scale }: { x: number; y: number; scale: number }) {
  const size = 80 * scale;
  return (
    <div style={{
      position: 'absolute',
      left: x - size / 2, top: y - size / 2,
      width: size, height: size, borderRadius: '50%',
      border: '2px solid #ff7847', boxShadow: '0 0 32px #ff7847',
      animation: 'ringExpand 0.6s ease-out forwards',
    }} />
  );
}

function FlyingNumber({ from, to, text, color }: { from: { x: number; y: number }; to: { x: number; y: number }; text: string; color: string }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (
    <div style={{
      position: 'absolute',
      left: from.x, top: from.y,
      color, fontFamily: '"Cinzel Decorative", serif',
      fontSize: 24, fontWeight: 700,
      textShadow: `0 0 10px ${color}`,
      ['--dx' as never]: `${dx}px`,
      ['--dy' as never]: `${dy}px`,
      animation: 'flyToCounter 0.55s ease-in forwards',
    } as React.CSSProperties}>{text}</div>
  );
}
