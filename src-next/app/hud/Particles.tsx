import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { STAGE_W, STAGE_H } from '../../render/stage';
import { Z } from './zLayers';

type Burst = { id: number; x: number; y: number; tier: number; color: string };
type Shock = { id: number; x: number; y: number; scale: number };
type FlyNum = { id: number; x: number; y: number; text: string; color: string };

const TIER_COLORS = ['#9577ff', '#7be3ff', '#dcd4ff', '#5be8a4', '#f5c451', '#ff7847', '#ff4d6d', '#ff8edc', '#ffe98a'];

let nextId = 1;

export function Particles() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [shocks, setShocks] = useState<Shock[]>([]);
  const [flies, setFlies] = useState<FlyNum[]>([]);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off1 = bus.on('onComboDetected', ({ tier }) => {
      const x = STAGE_W / 2;
      const y = STAGE_H / 2 - 80;
      const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)] ?? '#9577ff';
      const id = nextId++;
      setBursts((b) => [...b, { id, x, y, tier, color }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
    });
    const off3 = bus.on('onUpgradeTriggered', () => {
      const x = STAGE_W * 0.2 + Math.random() * STAGE_W * 0.6;
      const y = STAGE_H * 0.4 + Math.random() * 80;
      const id = nextId++;
      setBursts((b) => [...b, { id, x, y, tier: 0, color: '#7be3ff' }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 700);
    });
    const off4 = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'mult-slam') {
        const id = nextId++;
        const x = STAGE_W / 2;
        const y = STAGE_H / 2;
        setShocks((s) => [...s, { id, x, y, scale: beat.ampScale }]);
        setTimeout(() => setShocks((s) => s.filter((v) => v.id !== id)), 600);
      }
      if (beat.kind === 'die-tick') {
        const id = nextId++;
        const x = STAGE_W * (0.2 + 0.15 * beat.dieIdx);
        const y = STAGE_H * 0.65;
        setFlies((f) => [...f, { id, x, y, text: `+${beat.chipDelta}`, color: '#7be3ff' }]);
        setTimeout(() => setFlies((f) => f.filter((v) => v.id !== id)), 900);
      }
    });
    return () => { off1(); off3(); off4(); };
  }, []);

  return (
    <div ref={targetRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: Z.fx }}>
      {bursts.map((b) => (
        <Ring key={b.id} x={b.x} y={b.y} color={b.color} tier={b.tier} />
      ))}
      {shocks.map((s) => (
        <Shockwave key={s.id} x={s.x} y={s.y} scale={s.scale} />
      ))}
      {flies.map((f) => (
        <PopFloatNumber key={f.id} x={f.x} y={f.y} text={f.text} color={f.color} />
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

function PopFloatNumber({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      color, fontFamily: '"Cinzel Decorative", serif',
      fontSize: 26, fontWeight: 700,
      textShadow: `0 0 10px ${color}`,
      animation: 'scoreDiePop 850ms cubic-bezier(0.2, 1.2, 0.4, 1) forwards',
      willChange: 'transform, opacity',
      pointerEvents: 'none',
    }}>{text}</div>
  );
}
