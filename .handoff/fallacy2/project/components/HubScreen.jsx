/* global React */
// hooks via React.* below (avoid global redeclare across babel scripts)

/* ============================================================
   Hub screen — Tribunal of Stars (trial select).
   - 3 trial cards: cleared / current / locked
   - Parallax tilt on hover
   - Wax seal on cleared
   - Pulsing aura on current
   - Boss card uses crimson velvet, dot-pattern boss sigil
   ============================================================ */

// --- Tilt host: parallax tilt that follows pointer ----------------------

function TiltCard({ children, max = 8, style, onClick, glowColor = '#7be3ff' }) {
  const ref = React.useRef(null);
  const [tilt, setTilt] = React.useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const [hover, setHover] = React.useState(false);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setTilt({
      ry: (x - 0.5) * 2 * max,
      rx: -(y - 0.5) * 2 * max,
      mx: x * 100,
      my: y * 100,
    });
  };
  const onLeave = () => {
    setHover(false);
    setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });
  };
  const onEnter = () => setHover(true);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      className="ff-tilt-host"
      style={{ ...style, perspective: 900 }}
    >
      <div
        className="ff-tilt"
        style={{
          width: '100%', height: '100%',
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(0) ${hover ? 'translateY(-8px) scale(1.025)' : ''}`,
          boxShadow: hover ? `0 24px 60px rgba(0,0,0,0.55), 0 0 32px ${glowColor}55` : '0 12px 30px rgba(0,0,0,0.4)',
          borderRadius: 16,
          position: 'relative',
        }}
      >
        {children}
        {hover && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16,
            background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, ${glowColor}30 0%, transparent 60%)`,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
            transition: 'opacity 200ms',
          }} />
        )}
      </div>
    </div>
  );
}

// --- TierSigil: stylized icon for each trial tier ----------------------

function TierSigil({ tier, size = 96, animate = false, color }) {
  const c = color || (tier === 0 ? '#9577ff' : tier === 1 ? '#7be3ff' : '#e2334a');
  const cx = size / 2, cy = size / 2;
  const points = tier === 2 ? 5 : tier === 1 ? 6 : 4;
  const stars = Array.from({ length: points }).map((_, i) => {
    const a = (i / points) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * (size * 0.32), y: cy + Math.sin(a) * (size * 0.32) };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{
      filter: `drop-shadow(0 0 12px ${c}80)`,
      animation: animate ? 'ff-twinkle 3.4s ease-in-out infinite' : undefined,
    }}>
      <circle cx={cx} cy={cy} r={size * 0.36} fill="none" stroke={`${c}55`} strokeWidth="0.6" strokeDasharray="2 4" />
      <circle cx={cx} cy={cy} r={size * 0.18} fill={`${c}22`} stroke={`${c}88`} strokeWidth="0.8" />
      {stars.map((p, i) => (
        <g key={i}>
          <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={`${c}55`} strokeWidth="0.5" strokeDasharray="1.5 2.5" />
          <circle cx={p.x} cy={p.y} r="3" fill={c} style={{ filter: `drop-shadow(0 0 4px ${c})` }} />
        </g>
      ))}
      {/* Boss tier: angry inner mark */}
      {tier === 2 && (
        <g transform={`translate(${cx} ${cy})`}>
          <path d="M -8 -8 L 8 8 M 8 -8 L -8 8" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
      {tier === 1 && (
        <circle cx={cx} cy={cy} r="4" fill={c} style={{ filter: `drop-shadow(0 0 6px ${c})` }} />
      )}
    </svg>
  );
}

// --- Constellation thread connecting trial cards ----------------------

function ConstellationThread({ blinds, accent, totalW }) {
  const cardW = 240;
  const gap = 28;
  const centers = blinds.map((_, i) => i * (cardW + gap) + cardW / 2);
  const cy = 16;

  return (
    <svg
      width={totalW}
      height={32}
      style={{
        position: 'absolute', left: '50%', top: 350,
        transform: 'translateX(-50%)',
        zIndex: 2, pointerEvents: 'none', overflow: 'visible',
      }}
    >
      {centers.slice(0, -1).map((x, i) => (
        <line
          key={i}
          x1={x} y1={cy} x2={centers[i + 1]} y2={cy}
          stroke={blinds[i].cleared && blinds[i + 1].cleared ? '#9577ff88'
                : blinds[i].cleared ? accent
                : '#bba8ff44'}
          strokeWidth="1.2"
          strokeDasharray="2 5"
          strokeLinecap="round"
          style={{
            strokeDashoffset: 0,
            animation: 'ff-twinkle 4s ease-in-out infinite',
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}
      {centers.map((x, i) => {
        const b = blinds[i];
        const r = b.current ? 4 : b.cleared ? 3 : 2.5;
        const fill = b.current ? accent : b.cleared ? '#9577ff' : '#bba8ff';
        return (
          <circle
            key={i}
            cx={x} cy={cy} r={r}
            fill={fill}
            opacity={b.current ? 1 : b.cleared ? 0.85 : 0.5}
            style={b.current ? { filter: `drop-shadow(0 0 8px ${accent})` } : undefined}
          />
        );
      })}
    </svg>
  );
}

// --- TrialCard ---------------------------------------------------------

function TrialCard({ blind, idx }) {
  const accent = blind.isBoss ? '#e2334a' : (blind.current ? '#7be3ff' : '#bba8ff');

  const baseStyle = {
    width: 240, height: 320, padding: 0, position: 'relative',
    border: blind.current ? `2px solid ${accent}` : `1px solid ${accent}55`,
    boxShadow: blind.current
      ? `0 0 30px ${accent}66, 0 12px 40px rgba(0,0,0,0.5)`
      : '0 8px 24px rgba(0,0,0,0.45)',
    opacity: blind.cleared ? 0.6 : 1,
    filter: blind.locked ? 'saturate(0.45) brightness(0.85)' : undefined,
  };

  // Material: parchment for normal, velvet for boss
  const matClass = blind.isBoss ? 'mat-velvet' : 'mat-parchment';

  // Pulsing aura for current card
  const pulseAura = blind.current ? (
    <div style={{
      position: 'absolute', inset: -8, borderRadius: 18,
      border: `1px solid ${accent}80`,
      animation: 'ff-twinkle 2.4s ease-in-out infinite',
      pointerEvents: 'none',
      opacity: 0.6,
    }} />
  ) : null;

  // idle float — staggered per card
  const floatStyle = blind.current ? {
    animation: 'ff-float 3.8s ease-in-out infinite',
    ['--ff-tilt']: '0deg',
    animationDelay: `${idx * 0.25}s`,
  } : {};

  return (
    <div style={{ position: 'relative', ...floatStyle }}>
      {pulseAura}
      <TiltCard
        max={blind.locked ? 0 : 6}
        glowColor={accent}
        style={{ width: 240, height: 320 }}
      >
        <div className={`${matClass}`} style={{ ...baseStyle, borderRadius: 16, overflow: 'hidden' }}>
          {/* Decorative corners */}
          <div className="flourish-corner tl" style={{ borderColor: `${accent}88` }} />
          <div className="flourish-corner tr" style={{ borderColor: `${accent}88` }} />
          <div className="flourish-corner bl" style={{ borderColor: `${accent}88` }} />
          <div className="flourish-corner br" style={{ borderColor: `${accent}88` }} />

          <div style={{
            position: 'absolute', inset: 0, padding: 22,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div className="f-mono uc" style={{
              fontSize: 9, letterSpacing: '0.3em',
              color: blind.current ? accent : (blind.locked ? '#7a6fa6' : '#bba8ff'),
            }}>
              trial {String(idx + 1).padStart(2, '0')} {blind.isBoss ? '· boss' : ''}
            </div>
            <div className="f-display" style={{
              fontSize: 18, color: '#f3f0ff', marginTop: 6, textAlign: 'center', lineHeight: 1.18,
              minHeight: '2.4em',
            }}>
              {blind.name}
            </div>
            <div style={{
              marginTop: 14, height: 96,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'translateZ(20px)',
            }}>
              <TierSigil tier={idx} size={96} animate={blind.current} color={accent} />
            </div>
            <div style={{ marginTop: 'auto', textAlign: 'center', width: '100%' }}>
              <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.2em', color: '#bba8ff' }}>target</div>
              <div className="f-display num" style={{
                fontSize: 26, color: '#f3f0ff',
                textShadow: blind.current ? `0 0 12px ${accent}80` : 'none',
              }}>{blind.target.toLocaleString()}</div>
              <div className="f-mono" style={{ fontSize: 10, color: accent, marginTop: 2 }}>
                ×{blind.mult.toFixed(1)} multiplier
              </div>
              <div className="f-mono" style={{ fontSize: 10, color: '#f5c451', marginTop: 6 }}>
                ◇ +{blind.reward} shards
              </div>
            </div>
          </div>

          {/* Wax seal for cleared */}
          {blind.cleared && (
            <div className="ff-seal ff-seal-on" style={{ animationFillMode: 'forwards' }}>
              ✓
            </div>
          )}

          {/* Lock chains for locked */}
          {blind.locked && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'grid', placeItems: 'center',
              background: 'rgba(7,5,26,0.45)',
              backdropFilter: 'blur(1px)',
              pointerEvents: 'none',
            }}>
              <div style={{
                fontSize: 36, color: 'rgba(187,168,255,0.5)',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
              }}>⛒</div>
            </div>
          )}
        </div>
      </TiltCard>

      {/* Begin button — only on current */}
      {blind.current && (
        <button
          className="ff-btn ff-btn-primary"
          style={{
            position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)',
            fontSize: 13, padding: '10px 22px',
            zIndex: 3,
          }}
        >Begin Trial</button>
      )}
      {blind.cleared && (
        <div style={{
          position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, color: '#9577ff',
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.2em',
        }}>✓ cleared</div>
      )}
    </div>
  );
}

// --- HubScreen ----------------------------------------------------------

function HubScreen() {
  const blinds = [
    { name: 'The Hollow Wager', target: 800, mult: 1.0, reward: 5, cleared: true,  current: false, locked: false, isBoss: false },
    { name: 'The Cracked Mirror', target: 2400, mult: 3.0, reward: 5, cleared: false, current: true,  locked: false, isBoss: false },
    { name: 'Hour of Ruin',       target: 6800, mult: 8.5, reward: 8, cleared: false, current: false, locked: true,  isBoss: true  },
  ];

  const totalW = blinds.length * 240 + (blinds.length - 1) * 28;

  return (
    <div className="ff-stage" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, padding: 18 }}>
        {/* Top breadcrumb / shards strip */}
        <div style={{
          position: 'absolute', top: 16, left: 16, right: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          zIndex: 5,
        }}>
          <div className="panel" style={{ padding: '10px 18px' }}>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff' }}>
              ante 03 · ascension iii
            </div>
            <div className="f-display" style={{ fontSize: 18, color: '#f3f0ff', marginTop: 2 }}>Tribunal of Stars</div>
          </div>
          <div className="panel" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#f5c451', fontSize: 16, filter: 'drop-shadow(0 0 4px #f5c451)' }}>◆</span>
              <span className="f-display num" style={{ fontSize: 22, color: '#f5c451' }}>17</span>
            </span>
            <span className="ff-pip" style={{ color: '#7be3ff' }}>catalysts 2/3</span>
            <span className="ff-pip" style={{ color: '#bba8ff' }}>vouchers 1</span>
          </div>
        </div>

        {/* Title */}
        <div style={{
          position: 'absolute', left: '50%', top: 110, transform: 'translateX(-50%)',
          textAlign: 'center', zIndex: 4,
        }}>
          <div className="f-mono uc" style={{ fontSize: 11, color: '#7be3ff', letterSpacing: '0.5em' }}>
            ◇ choose your trial ◇
          </div>
          <div className="f-display" style={{
            fontSize: 44, color: '#f3f0ff', marginTop: 10,
            textShadow: '0 0 40px rgba(123,227,255,0.4)',
          }}>
            Three Doors Bar Your Path
          </div>
          <div className="f-body" style={{
            fontSize: 13, color: '#bba8ff', marginTop: 8, maxWidth: 540, marginInline: 'auto',
          }}>
            Clear them in sequence for shards. The third door opens only after the second falls.
          </div>
          <div className="f-mono uc" style={{
            marginTop: 12, fontSize: 10, letterSpacing: '0.28em', color: '#f5c451',
          }}>
            ✦ Lyra · 5d6 (celestial)
          </div>
        </div>

        {/* Constellation thread */}
        <ConstellationThread blinds={blinds} accent="#7be3ff" totalW={totalW} />

        {/* Trial cards */}
        <div style={{
          position: 'absolute', left: '50%', top: 380, transform: 'translateX(-50%)',
          display: 'flex', gap: 28, zIndex: 4,
        }}>
          {blinds.map((b, i) => (
            <TrialCard key={i} blind={b} idx={i} />
          ))}
        </div>

        {/* Bottom buttons */}
        <div style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 12, zIndex: 5,
        }}>
          <button className="ff-btn ff-btn-ghost">⚒ Forge</button>
          <button className="ff-btn ff-btn-ghost">↪ Skip (+2 ◇)</button>
          <button className="ff-btn ff-btn-ghost">← Title</button>
        </div>
      </div>
    </div>
  );
}

window.HubScreen = HubScreen;
