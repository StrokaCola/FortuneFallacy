/* global React */
// React hooks accessed via React.useX inside components to avoid Babel global scope collisions.

/* ============================================================
   Die3D — CSS-3D die with idle tumble, lock thunk,
   reroll spin, and scoring pop-up.
   ============================================================ */

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
    border: '1px solid rgba(187, 168, 255, 0.5)',
    pip: '#dcd4ff',
    accent: '#7be3ff',
    glow: '0 0 18px rgba(149,119,255,0.4), inset 0 0 10px rgba(123,227,255,0.18)',
  },
  obsidian: {
    bg: 'linear-gradient(135deg, #1a0f2e, #07051a)',
    border: '1px solid rgba(245, 196, 81, 0.45)',
    pip: '#f5c451',
    accent: '#f5c451',
    glow: '0 0 18px rgba(245,196,81,0.3), inset 0 0 10px rgba(255,255,255,0.06)',
  },
  ember: {
    bg: 'linear-gradient(135deg, #ff8a5e 0%, #c93a18 100%)',
    border: '1px solid rgba(255,231,200,0.55)',
    pip: '#fff7e8',
    accent: '#ffe9c8',
    glow: '0 0 22px rgba(255,120,71,0.55), inset 0 0 12px rgba(255,255,255,0.18)',
  },
  ivory: {
    bg: 'linear-gradient(135deg, #f5efe0, #d6c9aa)',
    border: '1px solid rgba(28,18,69,0.3)',
    pip: '#1c1245',
    accent: '#5c39c4',
    glow: '0 6px 18px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.6)',
  },
};

const FACE_ROT = {
  1: 'rotateX(0deg) rotateY(0deg)',
  6: 'rotateY(180deg)',
  2: 'rotateY(-90deg)',
  5: 'rotateY(90deg)',
  3: 'rotateX(-90deg)',
  4: 'rotateX(90deg)',
};

function Die3D({
  face = 1,
  size = 88,
  styleKey = 'celestial',
  locked = false,
  rolling = false,
  scoring = false,
  scoreValue = null,
  onClick,
  label,
  dim = false,
  mods = [],
}) {
  const s = DIE_STYLES[styleKey] || DIE_STYLES.celestial;
  const half = size / 2;
  const rot = FACE_ROT[Math.max(1, Math.min(6, face))] || FACE_ROT[1];

  const FACE_DEFS = [
    { id: 'front',  pips: 1, t: `translateZ(${half}px)` },
    { id: 'back',   pips: 6, t: `rotateY(180deg) translateZ(${half}px)` },
    { id: 'right',  pips: 2, t: `rotateY(90deg)  translateZ(${half}px)` },
    { id: 'left',   pips: 5, t: `rotateY(-90deg) translateZ(${half}px)` },
    { id: 'top',    pips: 3, t: `rotateX(90deg)  translateZ(${half}px)` },
    { id: 'bottom', pips: 4, t: `rotateX(-90deg) translateZ(${half}px)` },
  ];

  const wrapStyle = {
    width: size,
    height: size,
    position: 'relative',
    perspective: 800,
    cursor: onClick ? 'pointer' : 'default',
    opacity: dim ? 0.45 : 1,
    transformStyle: 'preserve-3d',
    animation: locked ? 'ff-die-lock 360ms var(--ease-spring) forwards' : undefined,
    transition: 'opacity 200ms ease',
  };

  const dieAnimation = rolling
    ? 'ff-die-reroll 600ms cubic-bezier(.4,1.4,.5,1)'
    : 'ff-die-tumble 6s ease-in-out infinite';

  return (
    <div onClick={onClick} style={wrapStyle}>
      <div
        style={{
          width: size,
          height: size,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: rot,
          animation: dieAnimation,
          ['--face-rot']: rot,
        }}
      >
        {FACE_DEFS.map((f) => {
          const pips = PIPS[f.pips] || [];
          return (
            <div
              key={f.id}
              style={{
                position: 'absolute',
                inset: 0,
                width: size,
                height: size,
                borderRadius: 12,
                backfaceVisibility: 'hidden',
                transform: f.t,
                background: s.bg,
                border: s.border,
                boxShadow: `inset 0 0 14px rgba(0,0,0,0.4), ${s.glow}`,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {/* highlight gloss */}
              <div style={{
                position: 'absolute', inset: 1, borderRadius: 11,
                background: 'linear-gradient(160deg, rgba(255,255,255,.10), transparent 55%)',
                pointerEvents: 'none',
              }} />
              <svg viewBox="0 0 100 100" width={size - 12} height={size - 12} style={{ position: 'absolute' }}>
                {pips.map(([x, y], i) => (
                  <g key={i}>
                    <circle cx={x * 100} cy={y * 100} r="7.5" fill="rgba(0,0,0,0.55)" />
                    <circle cx={x * 100} cy={y * 100} r="6.2" fill={s.pip}
                      style={{ filter: `drop-shadow(0 0 4px ${s.accent}80)` }} />
                    <circle cx={x * 100 - 1.5} cy={y * 100 - 1.8} r="1.6" fill="rgba(255,255,255,0.55)" />
                  </g>
                ))}
              </svg>
            </div>
          );
        })}
      </div>

      {/* Shadow */}
      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: locked ? -22 : -10,
        width: '70%',
        height: 12,
        transform: 'translateX(-50%)',
        background: 'radial-gradient(ellipse, rgba(0,0,0,.55), transparent 70%)',
        filter: 'blur(4px)',
        pointerEvents: 'none',
      }} />

      {/* Mods */}
      {mods.length > 0 && (
        <div style={{ position: 'absolute', top: -8, right: -8, display: 'flex', gap: 3, zIndex: 2 }}>
          {mods.slice(0, 2).map((m, i) => (
            <div key={i} title={m.name} style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'rgba(15,9,37,0.92)',
              border: `1px solid ${m.color}`,
              color: m.color,
              display: 'grid', placeItems: 'center',
              fontSize: 12,
              boxShadow: `0 0 8px ${m.color}80`,
            }}>{m.icon}</div>
          ))}
        </div>
      )}

      {/* Lock badge */}
      {locked && (
        <div style={{
          position: 'absolute', bottom: -36, left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, color: '#7be3ff',
          letterSpacing: '0.22em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          textShadow: '0 0 8px rgba(123,227,255,0.7)',
        }}>◆ locked</div>
      )}

      {/* Label */}
      {label && (
        <div style={{
          position: 'absolute', top: -18, left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 10, color: '#bba8ff',
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.18em',
        }}>{label}</div>
      )}

      {/* Per-die scoring pop */}
      {scoring && scoreValue != null && (
        <div
          key={`score-${scoreValue}-${Math.random()}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            fontFamily: 'Cinzel Decorative, serif',
            fontWeight: 700,
            fontSize: 28,
            color: '#7be3ff',
            textShadow: '0 0 12px #7be3ff, 0 0 24px rgba(123,227,255,0.6)',
            animation: 'ff-die-score 720ms var(--ease-spring-soft) forwards',
            pointerEvents: 'none',
            zIndex: 4,
            whiteSpace: 'nowrap',
          }}
        >
          +{scoreValue}
        </div>
      )}
    </div>
  );
}

window.Die3D = Die3D;
