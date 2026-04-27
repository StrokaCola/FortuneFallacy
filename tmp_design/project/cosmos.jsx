// Cosmos atoms: starfield, nebula, dice, constellation, decorative bits.
// All exposed via window globals at file end.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ---- Theme presets ----------------------------------------------------------
const THEMES = {
  midnight: {
    bgFar: '#07051a', bgMid: '#0f0925', bgNear: '#1c1245',
    nebulaA: 'rgba(118, 71, 245, 0.35)',
    nebulaB: 'rgba(123, 227, 255, 0.18)',
    nebulaC: 'rgba(255, 120, 71, 0.12)',
    star: '#dcd4ff', accent: '#7be3ff'
  },
  voidlit: {
    bgFar: '#020108', bgMid: '#04031a', bgNear: '#0a0830',
    nebulaA: 'rgba(255, 71, 168, 0.22)',
    nebulaB: 'rgba(123, 227, 255, 0.20)',
    nebulaC: 'rgba(245, 196, 81, 0.10)',
    star: '#ffe7fb', accent: '#ff7adf'
  },
  sandstorm: {
    bgFar: '#1a0a05', bgMid: '#2c1408', bgNear: '#3d1d10',
    nebulaA: 'rgba(255, 138, 71, 0.30)',
    nebulaB: 'rgba(245, 196, 81, 0.22)',
    nebulaC: 'rgba(226, 51, 74, 0.14)',
    star: '#ffe9c8', accent: '#f5c451'
  },
  abyssal: {
    bgFar: '#02080d', bgMid: '#04141d', bgNear: '#072330',
    nebulaA: 'rgba(123, 227, 255, 0.32)',
    nebulaB: 'rgba(71, 245, 173, 0.18)',
    nebulaC: 'rgba(149, 119, 255, 0.12)',
    star: '#dff7ff', accent: '#7be3ff'
  },
};

// ---- Starfield --------------------------------------------------------------
function Starfield({ density = 1, theme = 'midnight', drift = true, parallax = true }) {
  const t = THEMES[theme] ?? THEMES.midnight;
  const layers = useMemo(() => {
    const make = (count, sizeMin, sizeMax, dist) => {
      const stars = [];
      for (let i = 0; i < count * density; i++) {
        stars.push({
          x: Math.random() * 100,
          y: Math.random() * 100,
          r: sizeMin + Math.random() * (sizeMax - sizeMin),
          o: 0.3 + Math.random() * 0.7,
          d: 1 + Math.random() * 4, // twinkle delay
          c: Math.random() < 0.06 ? '#7be3ff' : (Math.random() < 0.07 ? '#f5c451' : t.star),
        });
      }
      return { stars, dist };
    };
    return [
      make(60, 0.5, 1.2, 0.3),  // far
      make(40, 0.8, 1.8, 0.6),  // mid
      make(18, 1.4, 2.6, 1.0),  // near + bright
    ];
  }, [density, theme]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {layers.map((layer, li) => (
        <svg key={li}
             width="100%" height="100%"
             viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
             style={{
               position: 'absolute', inset: 0,
               animation: drift ? `drift ${180 / layer.dist}s linear infinite alternate` : 'none',
               opacity: 0.5 + layer.dist * 0.4,
             }}>
          {layer.stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.15}
                    fill={s.c}
                    opacity={s.o}
                    style={{ animation: `twinkle ${2 + s.d}s ${s.d}s ease-in-out infinite` }} />
          ))}
        </svg>
      ))}
    </div>
  );
}

// ---- Nebula gradient layer --------------------------------------------------
function Nebula({ theme = 'midnight', intensity = 1 }) {
  const t = THEMES[theme] ?? THEMES.midnight;
  if (intensity <= 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: intensity }}>
      <div style={{
        position: 'absolute', left: '-10%', top: '-15%', width: '70%', height: '70%',
        background: `radial-gradient(circle, ${t.nebulaA} 0%, transparent 65%)`,
        filter: 'blur(20px)',
      }} />
      <div style={{
        position: 'absolute', right: '-15%', top: '20%', width: '70%', height: '80%',
        background: `radial-gradient(circle, ${t.nebulaB} 0%, transparent 60%)`,
        filter: 'blur(28px)',
      }} />
      <div style={{
        position: 'absolute', left: '20%', bottom: '-20%', width: '70%', height: '60%',
        background: `radial-gradient(circle, ${t.nebulaC} 0%, transparent 60%)`,
        filter: 'blur(24px)',
      }} />
    </div>
  );
}

// ---- Background ------------------------------------------------------------
function CosmosBackground({ theme, density, nebula, drift }) {
  const t = THEMES[theme] ?? THEMES.midnight;
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `radial-gradient(ellipse at 50% 35%, ${t.bgNear} 0%, ${t.bgMid} 45%, ${t.bgFar} 100%)`
    }}>
      <Nebula theme={theme} intensity={nebula ? 1 : 0.3} />
      <Starfield density={density} theme={theme} drift={drift} />
    </div>
  );
}

// ---- Dice ------------------------------------------------------------------
// Pip patterns for faces 1..6
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.22], [0.75, 0.22], [0.25, 0.5], [0.75, 0.5], [0.25, 0.78], [0.75, 0.78]],
};

const DIE_STYLES = {
  celestial: {
    bg: 'radial-gradient(circle at 30% 25%, #2e1d6b, #0f0925 80%)',
    border: '1px solid rgba(187, 168, 255, 0.4)',
    pip: '#dcd4ff',
    accent: '#7be3ff',
    glow: '0 0 18px rgba(149,119,255,0.4), inset 0 0 10px rgba(123,227,255,0.15)',
  },
  obsidian: {
    bg: 'linear-gradient(135deg, #1a0f2e, #07051a)',
    border: '1px solid rgba(245, 196, 81, 0.35)',
    pip: '#f5c451',
    accent: '#f5c451',
    glow: '0 0 18px rgba(245,196,81,0.25), inset 0 0 10px rgba(255,255,255,0.04)',
  },
  ivory: {
    bg: 'linear-gradient(135deg, #f5efe0, #d6c9aa)',
    border: '1px solid rgba(28,18,69,0.25)',
    pip: '#1c1245',
    accent: '#5c39c4',
    glow: '0 6px 18px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.6)',
  },
  ember: {
    bg: 'linear-gradient(135deg, #ff8a5e 0%, #c93a18 100%)',
    border: '1px solid rgba(255,231,200,0.5)',
    pip: '#fff7e8',
    accent: '#ffe9c8',
    glow: '0 0 22px rgba(255,120,71,0.5), inset 0 0 12px rgba(255,255,255,0.15)',
  },
  glass: {
    bg: 'linear-gradient(135deg, rgba(123,227,255,0.18), rgba(149,119,255,0.10))',
    border: '1px solid rgba(123,227,255,0.55)',
    pip: '#f3f0ff',
    accent: '#7be3ff',
    glow: '0 0 24px rgba(123,227,255,0.4), inset 0 0 14px rgba(123,227,255,0.2)',
  },
};

function Die({ face = 1, size = 88, style = 'celestial', locked, scoring, runes = [], onClick, label, dim }) {
  const s = DIE_STYLES[style] ?? DIE_STYLES.celestial;
  const half = size / 2;

  // each face's outward translation + which pip-face it shows
  // Standard die: opposite faces sum to 7. front=1, back=6, right=2, left=5, top=3, bottom=4.
  const FACE_DEFS = [
    { id: 'front',  pips: 1, t: `translateZ(${half}px)` },
    { id: 'back',   pips: 6, t: `rotateY(180deg) translateZ(${half}px)` },
    { id: 'right',  pips: 2, t: `rotateY(90deg) translateZ(${half}px)` },
    { id: 'left',   pips: 5, t: `rotateY(-90deg) translateZ(${half}px)` },
    { id: 'top',    pips: 3, t: `rotateX(90deg) translateZ(${half}px)` },
    { id: 'bottom', pips: 4, t: `rotateX(-90deg) translateZ(${half}px)` },
  ];

  // rotation that brings face N to the front
  const FACE_ROT = {
    1: 'rotateX(0deg) rotateY(0deg)',
    6: 'rotateY(180deg)',
    2: 'rotateY(-90deg)',
    5: 'rotateY(90deg)',
    3: 'rotateX(-90deg)',
    4: 'rotateX(90deg)',
  };
  const rot = FACE_ROT[Math.max(1, Math.min(6, face))] || FACE_ROT[1];

  return (
    <div
      onClick={onClick}
      className={`die3d-wrap idle ${locked ? 'locked' : ''} ${scoring ? 'scoring' : ''}`}
      style={{
        width: size, height: size,
        cursor: onClick ? 'pointer' : 'default',
        opacity: dim ? 0.45 : 1,
        filter: `drop-shadow(${s.glow.split(',')[0].trim()})`,
      }}>
      <div className="die3d"
           style={{
             width: size, height: size,
             '--face-rot': rot,
             transform: rot,
           }}>
        {FACE_DEFS.map((f) => {
          const pips = PIPS[f.pips];
          return (
            <div key={f.id} className="die3d-face"
                 style={{
                   width: size, height: size,
                   transform: f.t,
                   background: s.bg,
                   border: s.border,
                   boxShadow: `inset 0 0 14px rgba(0,0,0,0.35), ${s.glow}`,
                 }}>
              <svg viewBox="0 0 100 100" width={size - 12} height={size - 12}
                   style={{ position: 'absolute' }}>
                {pips.map(([x,y], i) => (
                  <g key={i}>
                    {/* pip well shadow */}
                    <circle cx={x*100} cy={y*100} r="7.5" fill="rgba(0,0,0,0.55)" />
                    <circle cx={x*100} cy={y*100} r="6.2" fill={s.pip}
                            style={{ filter: `drop-shadow(0 0 4px ${s.accent}80)` }} />
                    <circle cx={x*100 - 1.5} cy={y*100 - 1.8} r="1.6" fill="rgba(255,255,255,0.55)" />
                  </g>
                ))}
              </svg>
            </div>
          );
        })}
      </div>

      <div className="die3d-shadow" />

      {/* rune badges */}
      {runes.length > 0 && (
        <div style={{ position: 'absolute', top: -6, right: -6, display: 'flex', gap: 2, zIndex: 2 }}>
          {runes.slice(0, 2).map((r, i) => (
            <div key={i} style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'rgba(15,9,37,0.92)',
              border: `1px solid ${r.color || '#7be3ff'}`,
              color: r.color || '#7be3ff',
              display: 'grid', placeItems: 'center',
              fontSize: 12,
              boxShadow: `0 0 8px ${r.color || '#7be3ff'}80`,
            }} title={r.name}>{r.icon}</div>
          ))}
        </div>
      )}

      {locked && (
        <div style={{
          position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)',
          fontSize: 9, color: '#7be3ff', letterSpacing: '0.2em',
          fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>◆ locked</div>
      )}

      {label && (
        <div style={{
          position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, color: '#bba8ff',
          fontFamily: 'JetBrains Mono, monospace',
        }}>{label}</div>
      )}
    </div>
  );
}

// ---- Constellation lines between scoring dice -------------------------------
function ConstellationLines({ points, color = '#7be3ff', show = true }) {
  if (!show || !points || points.length < 2) return null;
  const path = points.map((p, i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  // approximate length for animation
  let len = 0;
  for (let i=1; i<points.length; i++) {
    const dx = points[i].x - points[i-1].x, dy = points[i].y - points[i-1].y;
    len += Math.sqrt(dx*dx + dy*dy);
  }
  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
         width="100%" height="100%">
      <defs>
        <filter id="cglow"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>
      {/* glow halo */}
      <path d={path} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            opacity="0.25" filter="url(#cglow)" />
      {/* main line */}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={len}
            style={{ animation: `constellation-draw 900ms cubic-bezier(.3,.7,.4,1) forwards`, ['--len']: len }} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#fff" />
          <circle cx={p.x} cy={p.y} r="8" fill="none" stroke={color} strokeWidth="0.5" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

// ---- Astrolabe / decorative ring -------------------------------------------
function Astrolabe({ size = 120, score = 0, target = 0, accent = '#7be3ff' }) {
  const pct = target > 0 ? Math.min(1, score / target) : 0;
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* outer ring with tick marks */}
        <g style={{ transformOrigin: 'center', animation: 'orbit 80s linear infinite' }}>
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const x1 = size/2 + Math.cos(a) * (r + 2);
            const y1 = size/2 + Math.sin(a) * (r + 2);
            const x2 = size/2 + Math.cos(a) * (r + 6);
            const y2 = size/2 + Math.sin(a) * (r + 6);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                         stroke={i%6===0 ? accent : 'rgba(149,119,255,0.5)'}
                         strokeWidth={i%6===0 ? 1.4 : 0.8} />;
          })}
        </g>
        {/* base track */}
        <circle cx={size/2} cy={size/2} r={r}
                stroke="rgba(149,119,255,0.25)" strokeWidth="1.5" fill="none" />
        {/* progress arc */}
        <circle cx={size/2} cy={size/2} r={r}
                stroke={accent} strokeWidth="2.5" fill="none"
                strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
                strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`}
                style={{ filter: `drop-shadow(0 0 6px ${accent})`, transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)' }} />
        {/* inner sigil */}
        <circle cx={size/2} cy={size/2} r={r * 0.55}
                stroke="rgba(149,119,255,0.3)" strokeWidth="0.8" fill="none"
                strokeDasharray="2 4" />
      </svg>
    </div>
  );
}

// ---- Sigil glyphs (no fancy SVG) -------------------------------------------
const SIGILS = {
  serpent: '∞',
  fool:    '☉',
  tower:   '♅',
  devil:   '⛧',
  priestess: '⚜',
  empress: '♀',
  star: '✦',
  moon: '☽',
  sun:  '☀',
  comet: '☄',
};

function Sigil({ kind = 'star', size = 22, color = '#7be3ff' }) {
  return (
    <span className="f-display" style={{
      fontSize: size, color, lineHeight: 1,
      filter: `drop-shadow(0 0 6px ${color}80)`,
      display: 'inline-block',
    }}>{SIGILS[kind] || '✦'}</span>
  );
}

// ---- Frame: ornate corner flourish ------------------------------------------
function OrnateFrame({ children, style = {}, color = 'rgba(245,196,81,0.5)' }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <span className="flourish-corner tl" style={{ borderColor: color }} />
      <span className="flourish-corner tr" style={{ borderColor: color }} />
      <span className="flourish-corner bl" style={{ borderColor: color }} />
      <span className="flourish-corner br" style={{ borderColor: color }} />
      {children}
    </div>
  );
}

// ---- Combo / rune / consumable / voucher data (mirrors game) ----------------
const COMBOS = [
  { id: 'five_kind',   name: 'Five of a Kind',  tier: 8, chips: 100, mult: 20 },
  { id: 'four_kind',   name: 'Four of a Kind',  tier: 7, chips: 60,  mult: 12 },
  { id: 'lg_straight', name: 'Large Straight',  tier: 6, chips: 40,  mult: 7  },
  { id: 'full_house',  name: 'Full House',      tier: 5, chips: 35,  mult: 8  },
  { id: 'sm_straight', name: 'Small Straight',  tier: 4, chips: 30,  mult: 5  },
  { id: 'three_kind',  name: 'Three of a Kind', tier: 3, chips: 30,  mult: 5  },
  { id: 'two_pair',    name: 'Two Pair',        tier: 2, chips: 20,  mult: 3  },
  { id: 'one_pair',    name: 'One Pair',        tier: 1, chips: 10,  mult: 2  },
  { id: 'chance',      name: 'Chance',          tier: 0, chips: 0,   mult: 1  },
];

const RUNES = [
  { id: 'amplify',    name: 'Amplify',     icon: '⬆', desc: '+2 chips per scoring die', color: '#7be3ff' },
  { id: 'sharpened',  name: 'Sharpened',   icon: '▲', desc: '+1 mult per scoring die',  color: '#ff7847' },
  { id: 'gilded',     name: 'Gilded',      icon: '◆', desc: '+1 shard on score',        color: '#f5c451' },
  { id: 'loaded',     name: 'Loaded',      icon: '⚔', desc: '1s count as 6',            color: '#e2334a' },
  { id: 'snake_cult', name: 'Snake Cult',  icon: '①', desc: '+2 mult if face is 1',     color: '#9577ff' },
  { id: 'high_roller', name: 'High Roller',icon: '🎯', desc: '+1 mult if 5 or 6',        color: '#f5c451' },
  { id: 'blessed',    name: 'Blessed',     icon: '✦', desc: 'Scores at least 4',        color: '#bba8ff' },
];

const ORACLES = [
  { id: 'astrologer',  name: 'The Astrologer', icon: '✷', desc: '+5 chips per die ≥5',     rarity: 'common',    color: '#7be3ff' },
  { id: 'gemini',      name: 'Gemini',         icon: '♊', desc: '+2 mult on pairs',         rarity: 'common',    color: '#bba8ff' },
  { id: 'leo',         name: 'Leo',            icon: '♌', desc: '×1.25 mult on 6-faces',    rarity: 'uncommon',  color: '#f5c451' },
  { id: 'aquarius',    name: 'Aquarius',       icon: '♒', desc: '+1 reroll/round',          rarity: 'uncommon',  color: '#7be3ff' },
  { id: 'comet',       name: 'Comet Whisperer',icon: '☄', desc: 'First combo of round ×2', rarity: 'rare',      color: '#ff7847' },
  { id: 'eclipse',     name: 'Eclipse Sage',   icon: '◐', desc: 'Snake eyes give +50 chips',rarity: 'rare',      color: '#9577ff' },
];

const CONSUMABLES = [
  { id: 'the_moon',     type: 'tarot',    name: 'The Moon',    icon: '☽', desc: 'Set one die to face 6.', color: '#bba8ff' },
  { id: 'the_sun',      type: 'tarot',    name: 'The Sun',     icon: '☀', desc: 'Set one die to face 1.', color: '#f5c451' },
  { id: 'the_world',    type: 'spectral', name: 'The World',   icon: '◈', desc: '+1 hand.',               color: '#7be3ff' },
  { id: 'shard_strike', type: 'spectral', name: 'Shard Strike',icon: '◇', desc: '+5 shards.',             color: '#f5c451' },
];

const VOUCHERS = [
  { id: 'astral_plane', name: 'Astral Plane', desc: '+1 oracle slot',         price: 8 },
  { id: 'forged_links', name: 'Forged Links', desc: '+1 rune slot per die',   price: 8 },
  { id: 'shard_streak', name: 'Shard Streak', desc: '+1 shard per blind',     price: 6 },
];

const BOSSES = [
  { id: 'the_serpent',        name: 'The Serpent',       sigil: 'serpent',   color: '#44bb66',  desc: 'All 1s stay 1s.' },
  { id: 'the_fool',           name: 'The Fool',          sigil: 'fool',      color: '#ffaa44',  desc: 'Hand size capped to 4.' },
  { id: 'the_tower',          name: 'The Tower',         sigil: 'tower',     color: '#aa6644',  desc: 'No rerolls.' },
  { id: 'the_devil',          name: 'The Devil',         sigil: 'devil',     color: '#cc2244',  desc: 'Locks unlock after roll.' },
  { id: 'the_high_priestess', name: 'The High Priestess',sigil: 'priestess', color: '#aa66ff',  desc: 'Oracles disabled.' },
];

// ---- Score popup ------------------------------------------------------------
function ScorePopup({ value, x, y, color = '#7be3ff' }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: 'translate(-50%, -100%)',
      fontFamily: 'Cinzel Decorative, serif', fontWeight: 700,
      color, fontSize: 22,
      textShadow: `0 0 12px ${color}, 0 0 4px ${color}`,
      pointerEvents: 'none',
      animation: 'score-pop 1.1s cubic-bezier(.2,.9,.3,1) forwards',
    }}>{value}</div>
  );
}

// expose
Object.assign(window, {
  THEMES, COMBOS, RUNES, ORACLES, CONSUMABLES, VOUCHERS, BOSSES, SIGILS,
  CosmosBackground, Starfield, Nebula,
  Die, ConstellationLines, Astrolabe, Sigil, OrnateFrame, ScorePopup,
});
