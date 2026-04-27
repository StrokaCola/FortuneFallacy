// Scoring FX — celestial pass.
// Constellation theme pushed further: 4-pt sparkle stars, sigil geometry,
// slow zodiac wheels, prismatic auras, twinkle + shimmer over particle pop.

const { useState: fxUseState, useEffect: fxUseEffect, useMemo: fxUseMemo, useRef: fxUseRef } = React;

// ---- palette ----------------------------------------------------------------
const FX_PALETTE = {
  astral: '#7be3ff',
  gold:   '#f5c451',
  violet: '#9577ff',
  ember:  '#ff7847',
  white:  '#f3f0ff',
  pink:   '#ff7adf',
  cosmos: '#bba8ff',
};

const rnd = (a, b) => a + Math.random() * (b - a);

// ---- shared keyframes -------------------------------------------------------
const FX_CSS = `
@keyframes fx-die-pop {
  0%   { transform: scale(1)    rotate(0deg);  filter: brightness(1); }
  20%  { transform: scale(1.12) rotate(-2deg); filter: brightness(1.5) drop-shadow(0 0 12px var(--astral)); }
  60%  { transform: scale(1.03) rotate(1deg);  filter: brightness(1.15); }
  100% { transform: scale(1)    rotate(0deg);  filter: brightness(1); }
}
@keyframes fx-shockring {
  0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0; }
  18%  { opacity: 1; }
  100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
}
@keyframes fx-aura {
  0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0; }
  35%  { transform: translate(-50%,-50%) scale(1.1); opacity: 1; }
  100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0; }
}
@keyframes fx-twinkle {
  0%, 100% { opacity: var(--o, 0); transform: translate(-50%,-50%) scale(0.4) rotate(var(--rot,0deg)); }
  10%      { opacity: 1; }
  50%      { opacity: 1; transform: translate(-50%,-50%) scale(1) rotate(calc(var(--rot,0deg) + 90deg)); }
  90%      { opacity: 0.5; transform: translate(-50%,-50%) scale(0.8) rotate(calc(var(--rot,0deg) + 180deg)); }
}
@keyframes fx-drift-out {
  0%   { opacity: 0; transform: translate(-50%,-50%) translate(0,0) scale(0.3); }
  18%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(0.4); }
}
@keyframes fx-comet {
  0%   { opacity: 0; transform: translate(var(--sx), var(--sy)) rotate(var(--ang)); }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--ex), var(--ey)) rotate(var(--ang)); }
}
@keyframes fx-rise-slow {
  0%   { opacity: 0; transform: translate(-50%, 0)     scale(0.5) rotate(var(--rot,0deg)); }
  20%  { opacity: 1; transform: translate(-50%, -14px) scale(1.05) rotate(calc(var(--rot,0deg) + 30deg)); }
  80%  { opacity: 1; transform: translate(-50%, -68px) scale(0.95) rotate(calc(var(--rot,0deg) + 90deg)); }
  100% { opacity: 0; transform: translate(-50%, -110px) scale(0.85) rotate(calc(var(--rot,0deg) + 120deg)); }
}
@keyframes fx-orbit-arc {
  0%   { transform: rotate(var(--start)) translateX(var(--r)) rotate(calc(-1 * var(--start))); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: rotate(var(--end)) translateX(var(--r)) rotate(calc(-1 * var(--end))); opacity: 0; }
}
@keyframes fx-sigil-draw {
  0%   { stroke-dashoffset: var(--len); opacity: 0; }
  10%  { opacity: 1; }
  60%  { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
@keyframes fx-fade { 0% { opacity: 0; } 12% { opacity: 1; } 100% { opacity: 0; } }
@keyframes fx-fade-hold { 0% { opacity: 0; } 12% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
@keyframes fx-glyph-pulse {
  0%, 100% { transform: translate(-50%,-50%) scale(1)    rotate(var(--rot,0deg)); opacity: 0; }
  20%      { transform: translate(-50%,-50%) scale(1.06) rotate(var(--rot,0deg)); opacity: 1; }
  60%      { transform: translate(-50%,-50%) scale(1)    rotate(var(--rot,0deg)); opacity: 1; }
}
@keyframes fx-shimmer-band {
  0%   { transform: translate(-50%,-50%) translateX(-90px) skewX(-22deg); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translate(-50%,-50%) translateX(90px)  skewX(-22deg); opacity: 0; }
}
@keyframes fx-prism-rot {
  0%   { transform: translate(-50%,-50%) rotate(0deg)    scale(0.8); opacity: 0; }
  25%  { opacity: 1; }
  100% { transform: translate(-50%,-50%) rotate(180deg) scale(1.6);  opacity: 0; }
}
@keyframes fx-bigscore {
  0%   { opacity: 0; transform: translate(-50%, -10px) scale(0.6); }
  18%  { opacity: 1; transform: translate(-50%, -36px) scale(1.18); }
  40%  { opacity: 1; transform: translate(-50%, -42px) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -100px) scale(0.95); }
}
@keyframes fx-zodiac-spin {
  0%   { transform: translate(-50%,-50%) rotate(0deg)   scale(0.7); opacity: 0; }
  20%  { transform: translate(-50%,-50%) rotate(60deg)  scale(1);   opacity: 1; }
  80%  { transform: translate(-50%,-50%) rotate(280deg) scale(1.05); opacity: 1; }
  100% { transform: translate(-50%,-50%) rotate(360deg) scale(1.4); opacity: 0; }
}
@keyframes fx-shatter {
  0%   { opacity: 0; transform: translate(-50%,-50%) translate(0,0) rotate(0deg) scale(1); }
  10%  { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.4); }
}
.fx-die-pop  { animation: fx-die-pop 700ms cubic-bezier(.2,1.4,.3,1); transform-origin: center; }
`;

function injectFxCss() {
  if (document.getElementById('scoring-fx-css')) return;
  const tag = document.createElement('style');
  tag.id = 'scoring-fx-css';
  tag.textContent = FX_CSS;
  document.head.appendChild(tag);
}

// ---- celestial primitives ---------------------------------------------------

// 4-pointed sparkle star (the canonical "twinkle" shape)
function SparkleStar({ size = 12, color = '#fff', glow }) {
  const g = glow || color;
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`spk-${color.replace('#','')}`}>
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.5" stopColor={color} stopOpacity="0.9" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M 0 -10 Q 1 -1 10 0 Q 1 1 0 10 Q -1 1 -10 0 Q -1 -1 0 -10 Z"
            fill={`url(#spk-${color.replace('#','')})`}
            style={{ filter: `drop-shadow(0 0 4px ${g}) drop-shadow(0 0 8px ${g}88)` }} />
      <circle r="1.4" fill="#fff" />
    </svg>
  );
}

// 6-petal rosette / sigil core (used as central glyph)
function Rosette({ size = 80, color = '#7be3ff', strokeWidth = 0.8 }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ overflow: 'visible' }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * 360;
        return (
          <ellipse key={i} cx="0" cy="-22" rx="14" ry="32"
                   fill="none" stroke={color} strokeWidth={strokeWidth}
                   transform={`rotate(${a})`} opacity="0.85" />
        );
      })}
      <circle r="36" fill="none" stroke={color} strokeWidth={strokeWidth * 0.7} opacity="0.55" />
      <circle r="3"  fill={color} opacity="0.9" />
    </svg>
  );
}

// 12-house astrolabe ring with tick marks, slow rotation
function ZodiacRing({ size = 200, color = '#9577ff', accent = '#f5c451', strokeWidth = 0.8 }) {
  const r = size / 2 - 6;
  return (
    <svg width={size} height={size} viewBox={`-${size/2} -${size/2} ${size} ${size}`}
         style={{ overflow: 'visible' }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const x1 = Math.cos(a) * (r - 4),  y1 = Math.sin(a) * (r - 4);
        const x2 = Math.cos(a) * (r + 4),  y2 = Math.sin(a) * (r + 4);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={i % 3 === 0 ? accent : color}
                  strokeWidth={i % 3 === 0 ? strokeWidth * 1.6 : strokeWidth} />
            {i % 3 === 0 && (
              <circle cx={Math.cos(a) * (r + 8)} cy={Math.sin(a) * (r + 8)} r="1.2"
                      fill={accent} />
            )}
          </g>
        );
      })}
      <circle r={r}      fill="none" stroke={color}  strokeWidth={strokeWidth} opacity="0.6" />
      <circle r={r - 6}  fill="none" stroke={color}  strokeWidth={strokeWidth * 0.6} opacity="0.4"
              strokeDasharray="2 4" />
    </svg>
  );
}

// ============================================================================
// 1 — Constellation Bloom — celestial pass
// Triple shock ring tinted across astral/violet/gold;
// 8 four-pointed sparkle stars drift outward on cardinal+diagonal axes;
// soft prismatic aura; central glow holds.
// ============================================================================
function FX_ConstellationBloom({ playId, accent }) {
  const c = accent || FX_PALETTE.astral;
  const sparkles = fxUseMemo(() => {
    const arr = [];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rnd(-0.1, 0.1);
      const dist = rnd(115, 160);
      arr.push({
        dx: Math.cos(a) * dist, dy: Math.sin(a) * dist,
        size: rnd(10, 16),
        color: i % 3 === 0 ? FX_PALETTE.gold : (i % 3 === 1 ? c : FX_PALETTE.cosmos),
        delay: rnd(0, 120),
      });
    }
    return arr;
  }, [playId]);

  return (
    <React.Fragment key={playId}>
      {/* prismatic aura */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 180, height: 180, borderRadius: '50%',
        background: `conic-gradient(from 0deg, ${c}55, ${FX_PALETTE.violet}55, ${FX_PALETTE.gold}55, ${c}55)`,
        filter: 'blur(18px)',
        animation: 'fx-prism-rot 1100ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }} />
      {/* triple shock rings, varied tint */}
      {[
        { d: 0,   c: c },
        { d: 130, c: FX_PALETTE.gold },
        { d: 240, c: FX_PALETTE.violet },
      ].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 60, height: 60, borderRadius: '50%',
          border: `1.2px solid ${r.c}`,
          boxShadow: `0 0 16px ${r.c}aa, inset 0 0 12px ${r.c}55`,
          animation: `fx-shockring ${1100 + i * 80}ms cubic-bezier(.2,.7,.3,1) ${r.d}ms forwards`,
          opacity: 0, pointerEvents: 'none',
        }} />
      ))}
      {/* sparkle stars */}
      {sparkles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          ['--dx']: `${p.dx}px`, ['--dy']: `${p.dy}px`,
          animation: `fx-drift-out 1400ms cubic-bezier(.15,.7,.4,1) ${p.delay}ms forwards`,
          opacity: 0, pointerEvents: 'none',
        }}>
          <div style={{ transform: 'translate(-50%,-50%)' }}>
            <SparkleStar size={p.size} color={p.color} />
          </div>
        </div>
      ))}
      {/* center glow hold */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 130, height: 130, borderRadius: '50%',
        background: `radial-gradient(circle, ${c}77 0%, ${FX_PALETTE.violet}33 40%, transparent 75%)`,
        transform: 'translate(-50%,-50%)',
        animation: 'fx-fade-hold 1100ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }} />
    </React.Fragment>
  );
}

// ============================================================================
// 2 — Zodiac Sigil — celestial pass
// 12-house astrolabe ring rotates in; rosette sigil ignites at center;
// twelve tick stars twinkle one by one around the ring.
// ============================================================================
function FX_ZodiacSigil({ playId, accent }) {
  const c = accent || FX_PALETTE.violet;
  const ticks = fxUseMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(a) * 92, y: Math.sin(a) * 92, delay: 200 + i * 50,
               color: i % 3 === 0 ? FX_PALETTE.gold : c };
    });
  }, [playId]);

  return (
    <React.Fragment key={playId}>
      {/* outer zodiac ring */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        animation: 'fx-zodiac-spin 1700ms cubic-bezier(.25,.7,.3,1) forwards',
        opacity: 0, pointerEvents: 'none',
      }}>
        <div style={{ transform: 'translate(-50%,-50%)' }}>
          <ZodiacRing size={200} color={c} accent={FX_PALETTE.gold} />
        </div>
      </div>
      {/* inner counter-rotating ring */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        animation: 'fx-fade-hold 1700ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }}>
        <div style={{ animation: 'orbit 8s linear infinite reverse' }}>
          <ZodiacRing size={140} color={FX_PALETTE.cosmos} accent={c} strokeWidth={0.6} />
        </div>
      </div>
      {/* center rosette ignite */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        animation: 'fx-glyph-pulse 1700ms 200ms ease-out forwards',
        opacity: 0, pointerEvents: 'none',
        filter: `drop-shadow(0 0 8px ${c}) drop-shadow(0 0 18px ${c}77)`,
      }}>
        <Rosette size={90} color={FX_PALETTE.gold} strokeWidth={1} />
      </div>
      {/* twelve twinkling ticks */}
      {ticks.map((t, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `calc(50% + ${t.x}px)`, top: `calc(50% + ${t.y}px)`,
          animation: `fx-twinkle 1100ms ${t.delay}ms ease-in-out forwards`,
          ['--rot']: `${i * 30}deg`, ['--o']: 0,
          opacity: 0, pointerEvents: 'none',
        }}>
          <div style={{ transform: 'translate(-50%,-50%)' }}>
            <SparkleStar size={10} color={t.color} />
          </div>
        </div>
      ))}
      {/* outward shockring */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 80, height: 80, borderRadius: '50%',
        border: `1px solid ${c}`,
        animation: 'fx-shockring 1300ms 200ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }} />
    </React.Fragment>
  );
}

// ============================================================================
// 3 — Pip Liftoff — celestial pass
// Each pip rises as a 4-point sparkle star with a tapering trail;
// each star slowly rotates as it ascends; gold satellites trail behind.
// ============================================================================
function FX_PipLiftoff({ playId, accent, face = 5 }) {
  const c = accent || FX_PALETTE.astral;
  const PIPS_LOC = {
    1: [[0,0]],
    2: [[-22,-22],[22,22]],
    3: [[-22,-22],[0,0],[22,22]],
    4: [[-22,-22],[22,-22],[-22,22],[22,22]],
    5: [[-22,-22],[22,-22],[0,0],[-22,22],[22,22]],
    6: [[-22,-26],[22,-26],[-22,0],[22,0],[-22,26],[22,26]],
  };
  const pips = PIPS_LOC[face] || PIPS_LOC[5];

  return (
    <React.Fragment key={playId}>
      {pips.map((p, i) => {
        const isGold = i % 2 === 1;
        const col = isGold ? FX_PALETTE.gold : c;
        return (
          <React.Fragment key={i}>
            {/* tapering trail */}
            <div style={{
              position: 'absolute', left: `calc(50% + ${p[0]}px)`, top: `calc(50% + ${p[1]}px)`,
              width: 3, height: 70,
              background: `linear-gradient(180deg, transparent, ${col}cc 70%, ${col})`,
              transform: 'translate(-50%, 0)',
              opacity: 0,
              filter: `blur(0.5px) drop-shadow(0 0 4px ${col})`,
              animation: `fx-rise-slow 1400ms ${i * 80}ms cubic-bezier(.3,.7,.3,1) forwards`,
              pointerEvents: 'none',
              borderRadius: 2,
            }} />
            {/* sparkle head */}
            <div style={{
              position: 'absolute', left: `calc(50% + ${p[0]}px)`, top: `calc(50% + ${p[1]}px)`,
              animation: `fx-rise-slow 1400ms ${i * 80}ms cubic-bezier(.3,.7,.3,1) forwards`,
              ['--rot']: `${i * 20}deg`,
              opacity: 0,
              pointerEvents: 'none',
            }}>
              <div style={{ transform: 'translate(-50%,-50%)' }}>
                <SparkleStar size={14} color={col} />
              </div>
            </div>
            {/* satellite micro-star */}
            <div style={{
              position: 'absolute', left: `calc(50% + ${p[0] + 6}px)`, top: `calc(50% + ${p[1]}px)`,
              animation: `fx-rise-slow 1400ms ${i * 80 + 100}ms cubic-bezier(.3,.7,.3,1) forwards`,
              ['--rot']: `${i * 20 + 45}deg`,
              opacity: 0,
              pointerEvents: 'none',
            }}>
              <div style={{ transform: 'translate(-50%,-50%)' }}>
                <SparkleStar size={6} color={FX_PALETTE.cosmos} />
              </div>
            </div>
          </React.Fragment>
        );
      })}
      {/* upward shimmer band */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 110, height: 14,
        background: `linear-gradient(90deg, transparent, ${c}aa 30%, ${FX_PALETTE.gold}aa 70%, transparent)`,
        transform: 'translate(-50%,-50%)',
        animation: 'fx-shimmer-band 900ms 100ms ease-out forwards',
        opacity: 0,
        pointerEvents: 'none',
        filter: 'blur(2px)',
      }} />
    </React.Fragment>
  );
}

// ============================================================================
// 4 — Comet Trail — celestial pass
// Long curving comet streak with prismatic core; sparkle-star sparks scatter;
// after-image afterglow holds; comet head leaves a 4-pt sparkle.
// ============================================================================
function FX_CometTrail({ playId, accent }) {
  const c = accent || FX_PALETTE.gold;
  const sparks = fxUseMemo(() => Array.from({ length: 9 }).map((_, i) => ({
    dx: rnd(-70, 70), dy: rnd(-60, 60),
    size: rnd(8, 14),
    color: i % 2 === 0 ? c : FX_PALETTE.astral,
    delay: rnd(320, 520),
  })), [playId]);

  return (
    <React.Fragment key={playId}>
      {/* curved comet trail (svg path) */}
      <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
                    pointerEvents: 'none', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`comet-grad-${playId}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0"    stopColor={c} stopOpacity="0" />
            <stop offset="0.55" stopColor={c} stopOpacity="0.9" />
            <stop offset="0.92" stopColor="#fff" stopOpacity="1" />
            <stop offset="1"    stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id={`comet-blur-${playId}`}><feGaussianBlur stdDeviation="1.4" /></filter>
        </defs>
        <path d="M 8% 18% Q 30% 42% 50% 50% T 92% 78%"
              fill="none" stroke={`url(#comet-grad-${playId})`} strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="600" strokeDashoffset="600"
              filter={`url(#comet-blur-${playId})`}
              style={{ ['--len']: 600, animation: 'fx-sigil-draw 900ms cubic-bezier(.4,.1,.6,1) forwards' }} />
        <path d="M 8% 18% Q 30% 42% 50% 50% T 92% 78%"
              fill="none" stroke="#fff" strokeWidth="0.9"
              strokeLinecap="round"
              strokeDasharray="600" strokeDashoffset="600"
              opacity="0.75"
              style={{ ['--len']: 600, animation: 'fx-sigil-draw 900ms 60ms cubic-bezier(.4,.1,.6,1) forwards' }} />
      </svg>
      {/* head burst */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        animation: 'fx-glyph-pulse 700ms 380ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
        filter: `drop-shadow(0 0 8px ${c}) drop-shadow(0 0 16px ${c})`,
      }}>
        <SparkleStar size={42} color={c} />
      </div>
      {/* afterglow */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 80, height: 80, borderRadius: '50%',
        background: `radial-gradient(circle, ${c}77, transparent 70%)`,
        transform: 'translate(-50%,-50%)',
        animation: 'fx-fade-hold 900ms 350ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }} />
      {/* impact sparkle scatter */}
      {sparks.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          ['--dx']: `${s.dx}px`, ['--dy']: `${s.dy}px`,
          animation: `fx-drift-out 900ms ${s.delay}ms ease-out forwards`,
          opacity: 0, pointerEvents: 'none',
        }}>
          <div style={{ transform: 'translate(-50%,-50%)' }}>
            <SparkleStar size={s.size} color={s.color} />
          </div>
        </div>
      ))}
    </React.Fragment>
  );
}

// ============================================================================
// 5 — Orbit Lock — celestial pass
// 12 stars trace ellipses (varied radii) around the die, then collapse into
// a halo that holds; central rosette ignites on collapse.
// ============================================================================
function FX_OrbitLock({ playId, accent }) {
  const c = accent || FX_PALETTE.violet;
  const orbiters = fxUseMemo(() => Array.from({ length: 12 }).map((_, i) => ({
    start: rnd(0, 360), end: rnd(360, 600), r: rnd(50, 78), size: rnd(8, 12), delay: i * 35,
    color: i % 4 === 0 ? FX_PALETTE.gold : (i % 4 === 1 ? FX_PALETTE.astral : c),
  })), [playId]);

  return (
    <React.Fragment key={playId}>
      {/* halo ring */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 140, height: 140, borderRadius: '50%',
        border: `1px solid ${c}77`,
        boxShadow: `0 0 16px ${c}88, inset 0 0 14px ${c}33`,
        transform: 'translate(-50%,-50%)',
        animation: 'fx-fade-hold 1500ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }} />
      {/* secondary halo, dashed */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 170, height: 170, borderRadius: '50%',
        border: `0.8px dashed ${FX_PALETTE.gold}88`,
        transform: 'translate(-50%,-50%)',
        animation: 'fx-fade-hold 1500ms 100ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }} />
      {orbiters.map((o, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 0, height: 0,
          ['--start']: `${o.start}deg`, ['--end']: `${o.end}deg`, ['--r']: `${o.r}px`,
          animation: `fx-orbit-arc 1400ms ${o.delay}ms cubic-bezier(.4,.1,.5,1) forwards`,
          opacity: 0,
          pointerEvents: 'none',
        }}>
          <div style={{ transform: 'translate(-50%,-50%)' }}>
            <SparkleStar size={o.size} color={o.color} />
          </div>
        </div>
      ))}
      {/* center rosette ignite on collapse */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        animation: 'fx-glyph-pulse 800ms 1100ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
        filter: `drop-shadow(0 0 8px ${c}) drop-shadow(0 0 16px ${c})`,
      }}>
        <Rosette size={70} color={FX_PALETTE.gold} strokeWidth={0.8} />
      </div>
    </React.Fragment>
  );
}

// ============================================================================
// 6 — Score Vault — celestial pass
// "+chips" numeral rises on a column of sparkle stars; ×mult orbits in;
// gold dust shower drifts down beneath the die.
// ============================================================================
function FX_ScoreVault({ playId, accent, value = 35, mult = 5 }) {
  const c = accent || FX_PALETTE.astral;
  const dust = fxUseMemo(() => Array.from({ length: 10 }).map((_, i) => ({
    x: rnd(-50, 50), size: rnd(4, 8), delay: i * 60,
    color: i % 2 === 0 ? FX_PALETTE.gold : FX_PALETTE.cosmos,
  })), [playId]);

  return (
    <React.Fragment key={playId}>
      {/* rising sparkle column */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: `calc(50% + ${rnd(-22, 22)}px)`, top: '50%',
          animation: `fx-rise-slow 1200ms ${i * 40}ms ease-out forwards`,
          ['--rot']: `${i * 30}deg`,
          opacity: 0, pointerEvents: 'none',
        }}>
          <div style={{ transform: 'translate(-50%,-50%)' }}>
            <SparkleStar size={i % 3 === 0 ? 10 : 6}
                         color={i % 3 === 0 ? FX_PALETTE.gold : c} />
          </div>
        </div>
      ))}
      {/* dust shower below */}
      {dust.map((d, i) => (
        <div key={i} style={{
          position: 'absolute', left: `calc(50% + ${d.x}px)`, top: 'calc(50% + 8px)',
          ['--dx']: '0px', ['--dy']: `${rnd(40, 60)}px`,
          animation: `fx-drift-out 1100ms ${d.delay}ms ease-in forwards`,
          opacity: 0, pointerEvents: 'none',
        }}>
          <div style={{ transform: 'translate(-50%,-50%)' }}>
            <SparkleStar size={d.size} color={d.color} />
          </div>
        </div>
      ))}
      {/* chips number */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        color: c, fontSize: 38, fontWeight: 800,
        textShadow: `0 0 14px ${c}, 0 0 4px ${c}, 0 0 24px ${c}55`,
        animation: 'fx-bigscore 1500ms cubic-bezier(.2,.9,.3,1) forwards',
        opacity: 0,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        fontFamily: 'Cinzel Decorative, serif',
      }}>+{value}</div>
      {/* satellite mult tag */}
      <div style={{
        position: 'absolute', left: 'calc(50% + 56px)', top: 'calc(50% - 30px)',
        color: FX_PALETTE.ember, fontSize: 16,
        textShadow: `0 0 8px ${FX_PALETTE.ember}, 0 0 16px ${FX_PALETTE.ember}66`,
        animation: 'fx-bigscore 1500ms 140ms cubic-bezier(.2,.9,.3,1) forwards',
        opacity: 0,
        pointerEvents: 'none',
        transform: 'translate(-50%, 0)',
        fontFamily: 'JetBrains Mono, monospace',
      }}>×{mult}</div>
      {/* baseline gold shimmer */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 110, height: 8, borderRadius: 4,
        background: `radial-gradient(ellipse, ${FX_PALETTE.gold}cc, transparent 70%)`,
        transform: 'translate(-50%, 30px)',
        animation: 'fx-fade 800ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }} />
    </React.Fragment>
  );
}

// ============================================================================
// 7 — Astral Shatter — celestial pass
// Die fractures into 4-pointed sparkle shards (not diamonds); two shock rings;
// sigil rosette ignites at the moment of fracture; gold flecks drift after.
// ============================================================================
function FX_AstralShatter({ playId, accent }) {
  const c = accent || FX_PALETTE.ember;
  const shards = fxUseMemo(() => Array.from({ length: 14 }).map((_, i) => ({
    dx: rnd(-110, 110), dy: rnd(-110, 110),
    rot: rnd(-180, 180),
    size: rnd(12, 22),
    color: i % 3 === 0 ? c : (i % 3 === 1 ? FX_PALETTE.gold : FX_PALETTE.astral),
    delay: rnd(0, 100),
  })), [playId]);
  const dust = fxUseMemo(() => Array.from({ length: 14 }).map(() => ({
    dx: rnd(-130, 130), dy: rnd(-130, 130), size: rnd(4, 8),
    color: Math.random() < 0.5 ? FX_PALETTE.gold : FX_PALETTE.cosmos,
    delay: rnd(280, 600),
  })), [playId]);

  return (
    <React.Fragment key={playId}>
      {/* sigil ignite at impact */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        animation: 'fx-glyph-pulse 900ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
        filter: `drop-shadow(0 0 12px ${c}) drop-shadow(0 0 24px ${c}88)`,
      }}>
        <Rosette size={120} color={c} strokeWidth={1.2} />
      </div>
      {/* big shards */}
      {shards.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          ['--dx']: `${s.dx}px`, ['--dy']: `${s.dy}px`, ['--rot']: `${s.rot}deg`,
          animation: `fx-shatter 1100ms ${s.delay}ms cubic-bezier(.2,.6,.4,1) forwards`,
          opacity: 0,
          pointerEvents: 'none',
        }}>
          <div style={{ transform: 'translate(-50%,-50%)' }}>
            <SparkleStar size={s.size} color={s.color} />
          </div>
        </div>
      ))}
      {/* dust */}
      {dust.map((d, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          ['--dx']: `${d.dx}px`, ['--dy']: `${d.dy}px`,
          animation: `fx-drift-out 1000ms ${d.delay}ms ease-out forwards`,
          opacity: 0, pointerEvents: 'none',
        }}>
          <div style={{ transform: 'translate(-50%,-50%)' }}>
            <SparkleStar size={d.size} color={d.color} />
          </div>
        </div>
      ))}
      {/* impact rings */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 80, height: 80, borderRadius: '50%',
        border: `1.6px solid ${c}`,
        boxShadow: `0 0 24px ${c}`,
        animation: 'fx-shockring 800ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 80, height: 80, borderRadius: '50%',
        border: `1.2px solid ${FX_PALETTE.gold}`,
        animation: 'fx-shockring 1000ms 100ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }} />
    </React.Fragment>
  );
}

// ============================================================================
// 8 — Constellation Stamp — celestial pass
// Faint zodiac wheel + 7-star constellation pattern draws line by line;
// each node twinkles once it lights up; subtle, ambient, holds longer.
// ============================================================================
function FX_ConstellationStamp({ playId, accent }) {
  const c = accent || FX_PALETTE.astral;
  const pattern = fxUseMemo(() => {
    const N = 7;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rnd(-0.25, 0.25);
      const r = rnd(46, 80);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }, [playId]);
  const path = 'M ' + pattern.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ');
  let len = 0;
  for (let i = 1; i < pattern.length; i++) {
    const a = pattern[i], b = pattern[i-1];
    len += Math.hypot(a[0]-b[0], a[1]-b[1]);
  }

  return (
    <React.Fragment key={playId}>
      {/* faint zodiac wheel underneath, slow */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        animation: 'fx-fade-hold 2000ms ease-out forwards', opacity: 0,
        pointerEvents: 'none',
      }}>
        <div style={{ animation: 'orbit 30s linear infinite' }}>
          <ZodiacRing size={210} color={FX_PALETTE.cosmos} accent={c} strokeWidth={0.6} />
        </div>
      </div>
      {/* constellation lines + nodes */}
      <svg style={{ position: 'absolute', left: '50%', top: '50%', width: 220, height: 220,
                    transform: 'translate(-50%,-50%)', overflow: 'visible', pointerEvents: 'none' }}
           viewBox="-110 -110 220 220">
        {/* halo path */}
        <path d={path} fill="none" stroke={c} strokeWidth="3" strokeLinecap="round"
              opacity="0.2" filter="blur(2px)" />
        <path d={path} fill="none" stroke={c} strokeWidth="0.9" strokeLinecap="round"
              strokeDasharray={len}
              style={{ ['--len']: len, animation: `fx-sigil-draw 1900ms cubic-bezier(.3,.7,.3,1) forwards` }} />
      </svg>
      {/* node sparkles */}
      {pattern.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `calc(50% + ${p[0]}px)`, top: `calc(50% + ${p[1]}px)`,
          animation: `fx-twinkle 1700ms ${200 + i * 110}ms ease-in-out forwards`,
          ['--rot']: `${i * 25}deg`, ['--o']: 0,
          opacity: 0, pointerEvents: 'none',
        }}>
          <div style={{ transform: 'translate(-50%,-50%)' }}>
            <SparkleStar size={i === 0 ? 14 : 10}
                         color={i === 0 ? FX_PALETTE.gold : c} />
          </div>
        </div>
      ))}
    </React.Fragment>
  );
}

// ============================================================================
// catalog
// ============================================================================
const SCORING_FX = [
  { id: 'constellation_bloom', name: 'Constellation Bloom',
    tagline: 'prismatic aura + drifting sparkle stars',
    use: 'default per-die scoring pulse',
    intensity: 'medium', accent: FX_PALETTE.astral, Comp: FX_ConstellationBloom },
  { id: 'zodiac_sigil', name: 'Zodiac Sigil',
    tagline: '12-house astrolabe ignites a rosette core',
    use: 'rune-marked dice scoring',
    intensity: 'medium', accent: FX_PALETTE.violet, Comp: FX_ZodiacSigil },
  { id: 'pip_liftoff', name: 'Pip Liftoff',
    tagline: 'pips ascend as rotating sparkle stars',
    use: 'showing per-pip chip contribution',
    intensity: 'medium', accent: FX_PALETTE.astral, Comp: FX_PipLiftoff },
  { id: 'comet_trail', name: 'Comet Trail',
    tagline: 'curved comet leaves a four-point sparkle',
    use: 'oracle / consumable triggered scoring',
    intensity: 'high', accent: FX_PALETTE.gold, Comp: FX_CometTrail },
  { id: 'orbit_lock', name: 'Orbit Lock',
    tagline: 'twelve stars orbit then ignite a rosette',
    use: 'die locked into scoring constellation',
    intensity: 'medium', accent: FX_PALETTE.violet, Comp: FX_OrbitLock },
  { id: 'score_vault', name: 'Score Vault',
    tagline: 'sparkle column lifts +chips, gold dust falls',
    use: 'final per-die score contribution',
    intensity: 'low', accent: FX_PALETTE.astral, Comp: FX_ScoreVault },
  { id: 'astral_shatter', name: 'Astral Shatter',
    tagline: 'sparkle shards burst from a rosette ignition',
    use: 'big combo (5-of-a-kind, large straight)',
    intensity: 'high', accent: FX_PALETTE.ember, Comp: FX_AstralShatter },
  { id: 'constellation_stamp', name: 'Constellation Stamp',
    tagline: 'zodiac wheel + 7-star constellation draws in',
    use: 'ambient — every scoring die, no spam',
    intensity: 'low', accent: FX_PALETTE.astral, Comp: FX_ConstellationStamp },
];

Object.assign(window, {
  injectFxCss,
  SCORING_FX,
  FX_PALETTE,
  SparkleStar, Rosette, ZodiacRing,
});
