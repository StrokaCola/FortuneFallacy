import { useEffect, useState } from 'react';
import type React from 'react';
import { bus } from '../../events/bus';
import { store } from '../../state/store';
import { getStageSize } from '../../render/stage';
import { Z } from './zLayers';
import { useInspectable } from '../../devtools/inspector/elementRegistry';
import { catalystIdFromEvent } from '../../core/upgrades/eventId';
import { lookupCatalyst } from '../../data/catalysts';
import { RARITY_COLORS } from '../visual/rarityStyles';

// Reduce-motion gate: read once at the start of each handler so the
// player's current preference is respected even if it changes mid-run.
// We bail before mutating state so React doesn't re-render for nothing.
function motionReduced(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
}

// Wave T Theater (Batch H) — resolve a die's current screen position
// via the global Dice3D instance. Returns null when the canvas isn't
// loaded or the index isn't currently among the locked/scoring dice.
function getDieScreenByIdxForSpark(dieIdx: number): { x: number; y: number } | null {
  if (typeof window === 'undefined') return null;
  const d3 = (window as unknown as {
    __dice3d?: { getScoringDieScreenPositions: () => Array<{ x: number; y: number }> };
  }).__dice3d;
  if (!d3 || typeof d3.getScoringDieScreenPositions !== 'function') return null;
  let positions: Array<{ x: number; y: number }>;
  try { positions = d3.getScoringDieScreenPositions(); } catch { return null; }
  if (positions.length === 0) return null;
  const scoringOrder = store.getState().round.scoringOrder ?? [];
  if (scoringOrder.length === 0) {
    return positions[0] ?? null;
  }
  let cursor = 0;
  for (const idx of scoringOrder) {
    if (idx === dieIdx) return positions[cursor] ?? null;
    cursor += 1;
  }
  return null;
}

type Burst = { id: number; x: number; y: number; tier: number; color: string; dim?: boolean };
type Shock = { id: number; x: number; y: number; scale: number };
type FlyNum = { id: number; x: number; y: number; text: string; color: string };
type Coin = { id: number; x0: number; y0: number; x1: number; y1: number };

const TIER_COLORS = ['#9577ff', '#7be3ff', '#dcd4ff', '#5be8a4', '#f5c451', '#ff7847', '#ff4d6d', '#ff8edc', '#ffe98a'];

let nextId = 1;

export function Particles() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [shocks, setShocks] = useState<Shock[]>([]);
  const [flies, setFlies] = useState<FlyNum[]>([]);
  const [coins, setCoins] = useState<Coin[]>([]);
  const targetRef = useInspectable<HTMLDivElement>('hud.particles', { label: 'Particles', zLayer: 'fx' });

  useEffect(() => {
    const off1 = bus.on('onComboDetected', ({ tier }) => {
      if (motionReduced()) return;
      const { w, h } = getStageSize();
      const x = w / 2;
      const y = h / 2 - 80;
      const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)] ?? '#9577ff';
      const id = nextId++;
      setBursts((b) => [...b, { id, x, y, tier, color }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
    });
    const off3 = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      if (motionReduced()) return;
      const { w, h } = getStageSize();
      // Wave T Theater (Batch H) — anchor mod sparks to the firing die.
      // Mod ids encode as `mod:<modId>@<dieIdx>`; project the die's
      // current screen position via the shared __dice3d global. Falls
      // back to the original random placement when the position can't
      // be resolved (e.g. canvas not visible).
      let x: number;
      let y: number;
      let sparkColor = '#7be3ff';
      if (payload.id.startsWith('mod:')) {
        const at = payload.id.indexOf('@');
        const dieIdx = at >= 0 ? Number.parseInt(payload.id.slice(at + 1), 10) : NaN;
        const diePos = Number.isFinite(dieIdx) ? getDieScreenByIdxForSpark(dieIdx) : null;
        if (diePos) {
          x = diePos.x;
          y = diePos.y;
        } else {
          x = w * 0.2 + Math.random() * w * 0.6;
          y = h * 0.4 + Math.random() * 80;
        }
        sparkColor = '#ff9d4a'; // mod spark distinct from catalyst tint
      } else {
        x = w * 0.2 + Math.random() * w * 0.6;
        y = h * 0.4 + Math.random() * 80;
        // Wave T (Batch D) — rarity-tinted spark. Cyan default (common /
        // non-catalyst upgrades like mods); uncommon=violet, rare=gold,
        // legendary=ember, mythic=magenta. Legendary keeps the
        // LegendaryFire screen-rim flash on top; this just colors the
        // confetti spark on every fire.
        const catalystId = catalystIdFromEvent(payload.id);
        const meta = catalystId ? lookupCatalyst(catalystId) : null;
        sparkColor = meta?.rarity ? RARITY_COLORS[meta.rarity] : '#7be3ff';
      }
      const id = nextId++;
      setBursts((b) => [...b, { id, x, y, tier: 0, color: sparkColor }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 700);
    });
    const off4 = bus.on('onScoreBeat', ({ beat }) => {
      if (motionReduced()) return;
      if (beat.kind === 'mult-slam') {
        const { w, h } = getStageSize();
        const id = nextId++;
        const x = w / 2;
        const y = h / 2;
        setShocks((s) => [...s, { id, x, y, scale: beat.ampScale }]);
        setTimeout(() => setShocks((s) => s.filter((v) => v.id !== id)), 600);
      }
      if (beat.kind === 'die-tick') {
        const { w, h } = getStageSize();
        const id = nextId++;
        const x = w * (0.2 + 0.15 * beat.dieIdx);
        const y = h * 0.65;
        setFlies((f) => [...f, { id, x, y, text: `+${beat.chipDelta}`, color: '#7be3ff' }]);
        setTimeout(() => setFlies((f) => f.filter((v) => v.id !== id)), 900);
      }
    });
    // Wave T (Batch F) — drag-to-slot feedback. Fires a cyan ring at
    // center when scoring order changes via a successful REORDER_HOLD.
    // Audit asked for per-frame drag enter/exit feedback; cheaper
    // equivalent: confirm the drop with a single ring so the player
    // sees the reorder land. Deeper enter/exit would require Dice3D
    // event plumbing — deferred.
    const off6 = bus.on('onReorderRejected', () => {
      // Already audio-only via audioBridge (uiDenied). No particle.
    });
    let lastScoringOrderKey = '';
    const offStore = (typeof window !== 'undefined')
      ? (() => {
        // Lightweight diff against module-level prev; no React import.
        let unsub = () => {};
        void import('../../state/store').then((mod) => {
          unsub = mod.store.subscribe((s) => {
            const order = s.round.scoringOrder ?? [];
            if (order.length === 0) return;
            const key = order.join(',');
            if (!lastScoringOrderKey) {
              lastScoringOrderKey = key;
              return;
            }
            if (key === lastScoringOrderKey) return;
            lastScoringOrderKey = key;
            if (motionReduced()) return;
            // Wave T+1 (2026-05-19) — center-screen confirmation ring
            // disabled. LockClickRipple at the pointer position now
            // owns lock-toggle feedback; a second ring at screen-
            // center (firing on every scoringOrder mutation including
            // lock/unlock) was redundant noise. Reorder still gets
            // audio + die-slide feedback through other paths.
          });
        });
        return () => unsub();
      })()
      : () => {};
    // Wave T — gold-shard payout on sell. Coin floats from the shop
    // surface (~30% down screen) up-left toward the TopBar shard
    // counter. Reads as a visible "you got paid" beat to pair with
    // the buy SFX that already fires on onUpgradeSold.
    const off5 = bus.on('onUpgradeSold', () => {
      if (motionReduced()) return;
      const { w, h } = getStageSize();
      const x0 = w * (0.4 + Math.random() * 0.2);
      const y0 = h * 0.42;
      // TopBar shard counter sits top-right; aim there.
      const x1 = w * 0.78;
      const y1 = h * 0.06;
      const id = nextId++;
      setCoins((c) => [...c, { id, x0, y0, x1, y1 }]);
      setTimeout(() => setCoins((c) => c.filter((v) => v.id !== id)), 950);
    });
    return () => { off1(); off3(); off4(); off5(); off6(); offStore(); };
  }, []);

  return (
    <div ref={targetRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: Z.fx }}>
      {bursts.map((b) => (
        <Ring key={b.id} x={b.x} y={b.y} color={b.color} tier={b.tier} dim={b.dim} />
      ))}
      {shocks.map((s) => (
        <Shockwave key={s.id} x={s.x} y={s.y} scale={s.scale} />
      ))}
      {flies.map((f) => (
        <PopFloatNumber key={f.id} x={f.x} y={f.y} text={f.text} color={f.color} />
      ))}
      {coins.map((c) => (
        <SellCoin key={c.id} x0={c.x0} y0={c.y0} x1={c.x1} y1={c.y1} />
      ))}
    </div>
  );
}

function Ring({ x, y, color, tier, dim }: { x: number; y: number; color: string; tier: number; dim?: boolean }) {
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
        // `dim` rings use a parallel keyframe that peaks at 0.5 opacity
        // — used for high-frequency confirmations (lock/unlock,
        // reorder) so the ring reads as a beat without dominating.
        animation: dim
          ? 'ringExpandDim 0.85s ease-out forwards'
          : 'ringExpand 0.85s ease-out forwards',
        opacity: dim ? 0.5 : 0.95,
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

function SellCoin({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const style: CSSPropertiesWithVars = {
    position: 'absolute',
    left: x0,
    top: y0,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 30%, #fff6c4 0%, #f5c451 35%, #b07b16 100%)',
    boxShadow: '0 0 18px rgba(245, 196, 81, 0.85), inset 0 0 6px rgba(255, 255, 255, 0.6)',
    border: '1px solid #f5c451',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
    animation: 'sellCoinFly 900ms cubic-bezier(0.4, 0.05, 0.2, 1) forwards',
    ['--sell-dx' as string]: `${dx}px`,
    ['--sell-dy' as string]: `${dy}px`,
  };
  return <div style={style} />;
}

type CSSPropertiesWithVars = React.CSSProperties & Record<string, string | number>;

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
