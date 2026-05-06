/* global React */
// hooks via React.*

/* ============================================================
   Transitions strip — three side-by-side mini stages, each
   demonstrating a different inter-screen transition style.
   1) Constellation draw  (lines extend, dots light up)
   2) Card-deal flip       (current screen flips off, new deals)
   3) Parallax push        (layers slide at different speeds)
   ============================================================ */

function MiniStage({ children, w = 360, h = 220 }) {
  return (
    <div className="mat-obsidian" style={{
      width: w, height: h, borderRadius: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      {children}
      <div className="flourish-corner tl" />
      <div className="flourish-corner tr" />
      <div className="flourish-corner bl" />
      <div className="flourish-corner br" />
    </div>
  );
}

// --- 1) Constellation Draw ----------------------------------------------

function ConstellationDraw() {
  const [phase, setPhase] = React.useState(0); // 0 idle, 1 drawing, 2 done
  React.useEffect(() => {
    const id = setInterval(() => {
      setPhase((p) => (p + 1) % 3);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Layout: scene A title left, scene B title right, threads connect them
  const points = [
    [60,  120], [120, 70], [180, 130], [240, 80], [300, 140],
  ];
  const drawn = phase >= 1;
  const lit   = phase >= 2;

  return (
    <MiniStage>
      <div style={{ position: 'absolute', inset: 0, padding: 12 }}>
        <div className="f-mono uc" style={{ fontSize: 9, color: '#7be3ff', letterSpacing: '0.3em' }}>
          ◇ transition · constellation draw
        </div>
        <div style={{ position: 'absolute', left: 12, top: 50 }}>
          <div className="f-mono uc" style={{ fontSize: 8, color: '#bba8ff', letterSpacing: '0.2em' }}>from</div>
          <div className="f-display" style={{ fontSize: 14, color: '#f3f0ff' }}>Hub</div>
        </div>
        <div style={{ position: 'absolute', right: 12, top: 50, textAlign: 'right' }}>
          <div className="f-mono uc" style={{ fontSize: 8, color: '#bba8ff', letterSpacing: '0.2em' }}>to</div>
          <div className="f-display" style={{ fontSize: 14, color: '#f3f0ff' }}>Round</div>
        </div>

        <svg width="100%" height="100%" viewBox="0 0 360 220" style={{ position: 'absolute', inset: 0 }}>
          {points.slice(0, -1).map((p, i) => {
            const q = points[i + 1];
            const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
            return (
              <line
                key={i}
                x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]}
                stroke={lit ? '#f5c451' : '#7be3ff'}
                strokeWidth="1.2"
                strokeDasharray={`${len} ${len}`}
                strokeDashoffset={drawn ? 0 : len}
                style={{
                  transition: `stroke-dashoffset 720ms cubic-bezier(0.34, 1.06, 0.64, 1) ${i * 120}ms, stroke 360ms ease`,
                  filter: `drop-shadow(0 0 4px ${lit ? '#f5c451' : '#7be3ff'})`,
                }}
              />
            );
          })}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p[0]} cy={p[1]}
                r={lit ? 4 : 2.8}
                fill={lit ? '#f5c451' : '#7be3ff'}
                style={{
                  filter: `drop-shadow(0 0 ${lit ? 8 : 5}px ${lit ? '#f5c451' : '#7be3ff'})`,
                  transition: `r 320ms var(--ease-spring), fill 360ms ease`,
                  opacity: drawn ? 1 : 0.3,
                }}
              />
            </g>
          ))}
        </svg>

        <div style={{
          position: 'absolute', bottom: 8, left: 12,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
          color: 'rgba(187,168,255,0.55)', letterSpacing: '0.2em',
        }}>
          phase {phase} {phase === 0 ? 'idle' : phase === 1 ? 'drawing' : 'lit'}
        </div>
      </div>
    </MiniStage>
  );
}

// --- 2) Card-deal flip --------------------------------------------------

function CardDealFlip() {
  const [scene, setScene] = React.useState(0);
  const scenes = [
    { name: 'Hub',   color: '#7be3ff', icon: '◇' },
    { name: 'Round', color: '#cc88ff', icon: '✦' },
    { name: 'Shop',  color: '#f5c451', icon: '◆' },
  ];

  React.useEffect(() => {
    const id = setInterval(() => setScene((s) => (s + 1) % scenes.length), 2200);
    return () => clearInterval(id);
  }, []);

  const cur = scenes[scene];

  return (
    <MiniStage>
      <div style={{ position: 'absolute', inset: 0, padding: 12 }}>
        <div className="f-mono uc" style={{ fontSize: 9, color: '#cc88ff', letterSpacing: '0.3em' }}>
          ◇ transition · card-deal flip
        </div>
        <div style={{
          position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%, -50%)',
          perspective: 1200,
        }}>
          <div
            key={scene}
            style={{
              width: 160, height: 110,
              borderRadius: 10,
              background: `radial-gradient(circle at 30% 25%, ${cur.color}30, rgba(15,9,37,0.95) 75%)`,
              border: `1px solid ${cur.color}aa`,
              boxShadow: `0 0 18px ${cur.color}66, 0 12px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              animation: 'card-deal 720ms var(--ease-spring) forwards',
              transformStyle: 'preserve-3d',
            }}
          >
            <div style={{ fontSize: 36, color: cur.color, filter: `drop-shadow(0 0 8px ${cur.color})` }}>{cur.icon}</div>
            <div className="f-display" style={{ fontSize: 16, color: '#f3f0ff', marginTop: 4 }}>{cur.name}</div>
          </div>
          <style>{`
            @keyframes card-deal {
              0%   { transform: rotateY(-180deg) translateY(-40px) scale(0.7); opacity: 0; }
              60%  { transform: rotateY(8deg)    translateY(0)     scale(1.04); opacity: 1; }
              100% { transform: rotateY(0)       translateY(0)     scale(1);    opacity: 1; }
            }
          `}</style>
        </div>

        <div style={{
          position: 'absolute', bottom: 8, left: 12,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
          color: 'rgba(187,168,255,0.55)', letterSpacing: '0.2em',
        }}>
          dealing → {cur.name.toLowerCase()}
        </div>
      </div>
    </MiniStage>
  );
}

// --- 3) Parallax push ---------------------------------------------------

function ParallaxPush() {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = (now - start) / 1000;
      const period = 4.5;
      // Sawtooth: 0 → 1 over 4.5s, then snap back
      setT((elapsed % period) / period);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Three layers move at different speeds
  const layerOffset = (speed) => {
    // Each layer tiles left → right; offset wraps at 360
    const x = (t * 360 * speed) % 360;
    return -x;
  };

  return (
    <MiniStage>
      <div style={{ position: 'absolute', inset: 0, padding: 12 }}>
        <div className="f-mono uc" style={{ fontSize: 9, color: '#f5c451', letterSpacing: '0.3em' }}>
          ◇ transition · parallax push
        </div>

        {/* Far layer: tiny stars */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translateX(${layerOffset(0.3)}px)`,
          backgroundImage:
            `radial-gradient(1px 1px at 30px 60px, #f3f0ff 100%, transparent),
             radial-gradient(1px 1px at 80px 120px, #bba8ff 100%, transparent),
             radial-gradient(1px 1px at 160px 80px, #7be3ff 100%, transparent),
             radial-gradient(1.5px 1.5px at 220px 150px, #f5c451 100%, transparent),
             radial-gradient(1px 1px at 280px 50px, #f3f0ff 100%, transparent),
             radial-gradient(1px 1px at 340px 110px, #cc88ff 100%, transparent)`,
          backgroundSize: '360px 220px',
          backgroundRepeat: 'repeat-x',
          opacity: 0.6,
        }} />

        {/* Mid layer: nebula blobs */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translateX(${layerOffset(0.7)}px)`,
          backgroundImage:
            `radial-gradient(50px 30px at 100px 120px, rgba(149,119,255,0.35), transparent),
             radial-gradient(40px 25px at 250px 80px, rgba(123,227,255,0.3), transparent)`,
          backgroundSize: '360px 220px',
          backgroundRepeat: 'repeat-x',
          mixBlendMode: 'screen',
        }} />

        {/* Near layer: silhouette of trial spires */}
        <svg
          width="720" height="220" viewBox="0 0 720 220"
          style={{
            position: 'absolute', left: 0, top: 0,
            transform: `translateX(${layerOffset(1.4)}px)`,
          }}
        >
          {[0, 360].map((dx) => (
            <g key={dx} transform={`translate(${dx}, 0)`}>
              <path
                d="M 0 220 L 0 170 L 40 150 L 60 90 L 80 150 L 130 165 L 150 110 L 175 165 L 220 175 L 240 130 L 270 175 L 320 180 L 360 220 Z"
                fill="rgba(15,9,37,0.95)"
                stroke="rgba(149,119,255,0.4)"
                strokeWidth="0.6"
              />
              {/* Star tips */}
              <circle cx="60" cy="88" r="2" fill="#f5c451" style={{ filter: 'drop-shadow(0 0 4px #f5c451)' }} />
              <circle cx="240" cy="128" r="1.5" fill="#7be3ff" style={{ filter: 'drop-shadow(0 0 3px #7be3ff)' }} />
            </g>
          ))}
        </svg>

        <div style={{
          position: 'absolute', bottom: 8, left: 12,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
          color: 'rgba(187,168,255,0.55)', letterSpacing: '0.2em',
        }}>
          0.3× · 0.7× · 1.4×
        </div>
      </div>
    </MiniStage>
  );
}

// --- Combined --------------------------------------------------------------

function TransitionsStrip() {
  return (
    <div style={{
      width: 1280, height: 320,
      display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: 'transparent',
    }}>
      <ConstellationDraw />
      <CardDealFlip />
      <ParallaxPush />
    </div>
  );
}

window.TransitionsStrip = TransitionsStrip;
