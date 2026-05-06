/* global React, Die3D */
// React hooks accessed via React.useX inside components to avoid Babel global scope collisions.

/* ============================================================
   Round screen — TopBar, dice tray, action bar,
   choreographed score sequence (chip ticks → mult slams →
   target-cross stamp → boom → catch).
   ============================================================ */

// --- TopBar -------------------------------------------------------------

function TopBar({ score, target, ante, blind, hands, rerolls, shards, accent = '#7be3ff', shake }) {
  return (
    <div style={{
      position: 'absolute', top: 16, left: 16, right: 16,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      zIndex: 5, gap: 14,
      animation: shake ? `ff-shake-${shake} 380ms ease-out` : undefined,
    }}>
      {/* Score / target */}
      <div className="panel" style={{ padding: '14px 18px', minWidth: 290 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Astrolabe size={84} score={score} target={target} accent={accent} />
          <div>
            <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>score</div>
            <div
              data-score-counter
              className="f-display num"
              style={{
                fontSize: 36, lineHeight: 1, color: '#f3f0ff', fontWeight: 700,
                textShadow: '0 0 18px rgba(123,227,255,0.35)',
              }}
            >{score.toLocaleString()}</div>
            <div className="f-mono num" style={{ fontSize: 12, color: accent, marginTop: 2 }}>
              / {target.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flourish-corner tl" />
        <div className="flourish-corner tr" />
        <div className="flourish-corner bl" />
        <div className="flourish-corner br" />
      </div>

      {/* Center — blind plate */}
      <div className="panel" style={{ padding: '12px 22px', textAlign: 'center', minWidth: 220 }}>
        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff' }}>
          ante {String(ante).padStart(2, '0')} · trial
        </div>
        <div className="f-display" style={{ fontSize: 22, marginTop: 4, color: '#f3f0ff' }}>{blind}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 6 }}>
          <span className="ff-pip" style={{ color: '#7be3ff' }}>✦ {hands} hands</span>
          <span className="ff-pip" style={{ color: '#cc88ff' }}>↻ {rerolls}</span>
        </div>
      </div>

      {/* Treasury */}
      <div className="panel" style={{ padding: '14px 18px', minWidth: 200 }}>
        <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>treasury</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ color: '#f5c451', fontSize: 18, filter: 'drop-shadow(0 0 6px #f5c451)' }}>◆</span>
          <div className="f-display num" style={{ fontSize: 30, color: '#f5c451', fontWeight: 700 }}>{shards}</div>
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.2em' }}>shards</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <span className="ff-pip" style={{ color: '#7be3ff', fontSize: 10 }}>catalysts 2/3</span>
          <span className="ff-pip" style={{ color: '#bba8ff', fontSize: 10 }}>vouchers 1</span>
        </div>
      </div>
    </div>
  );
}

// --- Astrolabe (score progress as orbital ring) ------------------------

function Astrolabe({ size = 84, score, target, accent = '#7be3ff' }) {
  const pct = target > 0 ? Math.min(1, score / target) : 0;
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: `drop-shadow(0 0 6px ${accent}80)` }}>
      <defs>
        <radialGradient id="astro-bg" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#2e1d6b" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0f0925" stopOpacity="0.95" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 2} fill="url(#astro-bg)" stroke="rgba(245,196,81,0.25)" strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(149,119,255,0.22)" strokeWidth="2" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={accent} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 380ms var(--ease-savor)' }}
      />
      {/* tick marks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(a) * (r - 4);
        const y1 = cy + Math.sin(a) * (r - 4);
        const x2 = cx + Math.cos(a) * (r - 1);
        const y2 = cy + Math.sin(a) * (r - 1);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(245,196,81,0.4)" strokeWidth="0.6" />;
      })}
      <circle cx={cx} cy={cy} r="3" fill="#f5c451" style={{ filter: 'drop-shadow(0 0 4px #f5c451)' }} />
    </svg>
  );
}

// --- Catalyst strip (top-right floating row) ---------------------------

function CatalystStrip({ items }) {
  return (
    <div style={{
      position: 'absolute', top: 130, right: 24,
      display: 'flex', flexDirection: 'column', gap: 8, zIndex: 4,
    }}>
      <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff', textAlign: 'right' }}>
        ◇ catalysts
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {items.map((it, i) => (
          <div
            key={i}
            className="ff-idle-float"
            style={{
              width: 56, height: 72,
              borderRadius: 10,
              background: `radial-gradient(circle at 30% 25%, ${it.color}30, rgba(15,9,37,0.92) 75%)`,
              border: `1px solid ${it.color}80`,
              boxShadow: `0 0 14px ${it.color}55, inset 0 1px 0 rgba(255,255,255,0.08)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4,
              ['--ff-tilt']: `${(i % 2 === 0 ? -1 : 1) * 2}deg`,
              ['--ff-float-dur']: `${3.4 + i * 0.3}s`,
              animationDelay: `${i * 0.4}s`,
            }}
          >
            <div style={{ fontSize: 22, color: it.color, filter: `drop-shadow(0 0 4px ${it.color})` }}>{it.icon}</div>
            <div className="f-mono uc" style={{ fontSize: 7, color: it.color, letterSpacing: '0.18em' }}>{it.tag}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Action bar ----------------------------------------------------------

function ActionBar({ onRoll, onScore, canScore, hasRolled }) {
  return (
    <div style={{
      position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 14, zIndex: 5,
    }}>
      <button className="ff-btn ff-btn-ghost" onClick={onRoll}>
        {hasRolled ? '↻ Reroll' : '⤴ Roll'}
        <span className="f-mono" style={{ fontSize: 10, opacity: 0.7, marginLeft: 8 }}>(R)</span>
      </button>
      <button
        className="ff-btn ff-btn-primary"
        onClick={onScore}
        disabled={!canScore}
      >
        ✦ Play Hand
      </button>
    </div>
  );
}

// --- ComboBanner (ribbon) -----------------------------------------------

function ComboBanner({ name }) {
  if (!name) return null;
  return (
    <div
      key={name}
      style={{
        position: 'absolute',
        left: '50%', top: 162,
        transform: 'translate(-50%, 0)',
        zIndex: 6,
        animation: 'ff-ribbon-in 460ms var(--ease-spring) forwards',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        position: 'relative',
        padding: '10px 36px',
        background: 'linear-gradient(180deg, #ffd97a 0%, #f5c451 50%, #b88a1e 100%)',
        color: '#20100a',
        fontFamily: 'Cinzel Decorative, serif',
        fontWeight: 700,
        fontSize: 22,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        boxShadow: '0 0 24px rgba(245,196,81,0.55), inset 0 1px 0 rgba(255,255,220,0.7)',
        border: '1px solid rgba(255,240,200,0.7)',
        textShadow: '0 1px 0 rgba(255,255,220,0.4)',
        clipPath: 'polygon(0 0, 100% 0, calc(100% - 18px) 50%, 100% 100%, 0 100%, 18px 50%)',
      }}>
        ✦ {name} ✦
      </div>
    </div>
  );
}

// --- ScoreBreakdown (CHIPS × MULT panel) --------------------------------

function ScoreBreakdown({ chips, mult, chipsPulse, multPulse, tier, tierFlash, visible }) {
  if (!visible) return null;
  const tierColor = tier >= 2 ? '#f5c451' : tier >= 1 ? '#cc88ff' : '#ff7847';
  const tierGlow = tier >= 2 ? 'rgba(245,196,81,0.65)' : tier >= 1 ? 'rgba(204,136,255,0.6)' : 'rgba(255,120,71,0.55)';

  return (
    <div style={{
      position: 'absolute', left: '50%', top: 230,
      transform: 'translateX(-50%)',
      display: 'flex', gap: 22, alignItems: 'center', zIndex: 4,
      pointerEvents: 'none',
      animation: 'ff-fadeup 240ms ease-out',
    }}>
      <div
        key={`chips-${chipsPulse}`}
        className="panel"
        style={{
          padding: '14px 28px',
          textAlign: 'center',
          animation: chipsPulse > 0 ? 'ff-chip-pop 280ms var(--ease-spring)' : undefined,
        }}
      >
        <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.2em' }}>chips</div>
        <div className="f-display num" style={{
          fontSize: 44, color: '#7be3ff', fontWeight: 700, lineHeight: 1,
          textShadow: '0 0 18px rgba(123,227,255,0.6)',
        }}>{chips}</div>
      </div>
      <div className="f-display" style={{
        fontSize: 48, color: '#bba8ff',
        textShadow: '0 0 12px rgba(187,168,255,0.4)',
      }}>×</div>
      <div style={{ position: 'relative' }}>
        {tierFlash > 0 && (
          <div
            key={`ring-${tierFlash}`}
            style={{
              position: 'absolute', inset: -14,
              borderRadius: 24,
              border: `2px solid ${tierColor}`,
              boxShadow: `0 0 32px ${tierGlow}`,
              animation: 'ff-ring 600ms ease-out forwards',
              transform: 'translate(-50%,-50%) scale(0.4)',
              left: '50%', top: '50%',
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          key={`mult-${multPulse}`}
          className="panel"
          style={{
            padding: '14px 28px',
            textAlign: 'center',
            animation: multPulse > 0 ? 'ff-mult-slam 360ms var(--ease-spring)' : undefined,
          }}
        >
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.2em' }}>mult</div>
          <div className="f-display num" style={{
            fontSize: 44, color: tierColor, fontWeight: 700, lineHeight: 1,
            textShadow: `0 0 22px ${tierGlow}`,
            transition: 'color 200ms ease, text-shadow 200ms ease',
          }}>{Number.isInteger(mult) ? mult : mult.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

// --- Stamp overlays (TARGET BEAT etc.) ----------------------------------

function StampOverlay({ kind }) {
  if (!kind) return null;
  const isTarget = kind === 'target';
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '36%',
      transform: 'translate(-50%, -50%)',
      zIndex: 9, pointerEvents: 'none',
      animation: 'ff-stamp-text 520ms var(--ease-spring) forwards',
    }}>
      <div className="f-display" style={{
        fontSize: 56, fontWeight: 900,
        color: isTarget ? '#f5c451' : '#ff4d6d',
        letterSpacing: '0.22em',
        textShadow: isTarget
          ? '0 0 28px #f5c451, 0 0 56px rgba(245,196,81,0.6)'
          : '0 0 28px #ff4d6d, 0 0 56px rgba(255,77,109,0.6)',
        WebkitTextStroke: '1px rgba(255,255,255,0.25)',
      }}>
        {isTarget ? 'TARGET BEAT' : 'NOT ENOUGH'}
      </div>
    </div>
  );
}

// --- Boom (final score) -------------------------------------------------

function Boom({ total, gold, phase, stars }) {
  const color = gold ? '#f5c451' : '#fff';
  const glow = gold
    ? '0 0 40px #f5c451, 0 0 80px rgba(245,196,81,0.5)'
    : '0 0 40px #7be3ff, 0 0 80px rgba(123,227,255,0.5)';
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 9, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="f-mono num" style={{
        fontSize: 96, fontWeight: 700,
        color, textShadow: glow,
        animation: phase === 'fly'
          ? 'ff-boom-implode 220ms ease-in forwards'
          : 'ff-boom-pop 420ms var(--ease-spring) forwards',
      }}>
        {total.toLocaleString()}
      </div>
      {phase === 'fly' && stars && stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 28, height: 28, lineHeight: '28px',
            textAlign: 'center', fontSize: 22,
            fontFamily: 'Cinzel Decorative, serif',
            color: gold ? '#f5c451' : '#7be3ff',
            textShadow: gold
              ? '0 0 12px #f5c451, 0 0 24px #f5c451'
              : '0 0 12px #7be3ff, 0 0 24px #7be3ff',
            transform: 'translate(-50%,-50%)',
            ['--dx']: `${s.dx}px`,
            ['--dy']: `${s.dy}px`,
            animation: `ff-star-fly 720ms cubic-bezier(0.34, 1.06, 0.64, 1) ${s.delay}ms forwards`,
            pointerEvents: 'none',
          }}
        >★</div>
      ))}
    </div>
  );
}

// --- Round screen --------------------------------------------------------

const STARTING_DICE = [
  { face: 4, style: 'celestial', mods: [] },
  { face: 6, style: 'celestial', mods: [{ icon: '✦', name: 'Solar', color: '#f5c451' }] },
  { face: 6, style: 'obsidian',  mods: [] },
  { face: 4, style: 'celestial', mods: [] },
  { face: 6, style: 'ember',     mods: [{ icon: '⫶', name: 'Pyre', color: '#ff7847' }] },
];

const CATALYSTS = [
  { icon: '✦', tag: 'lyra',   color: '#7be3ff' },
  { icon: '◈', tag: 'forge',  color: '#f5c451' },
];

function RoundScreen() {
  // Live state
  const [score, setScore] = React.useState(0);
  const [target] = React.useState(2400);
  const [hands, setHands] = React.useState(3);
  const [rerolls, setRerolls] = React.useState(2);
  const [shards, setShards] = React.useState(7);

  // Dice state
  const [dice, setDice] = React.useState(STARTING_DICE);
  const [locked, setLocked] = React.useState([false, true, true, false, true]); // 6,6,6 locked = three of a kind
  const [rolling, setRolling] = React.useState([false, false, false, false, false]);
  const [hasRolled, setHasRolled] = React.useState(true);
  const [scoreBumps, setScoreBumps] = React.useState([null, null, null, null, null]);

  // Score sequence state
  const [chips, setChips] = React.useState(0);
  const [mult, setMult] = React.useState(1);
  const [chipsPulse, setChipsPulse] = React.useState(0);
  const [multPulse, setMultPulse] = React.useState(0);
  const [tierFlash, setTierFlash] = React.useState(0);
  const [tier, setTier] = React.useState(0);
  const [breakdownVisible, setBreakdownVisible] = React.useState(false);
  const [combo, setCombo] = React.useState(null);
  const [stamp, setStamp] = React.useState(null);
  const [boom, setBoom] = React.useState(null);
  const [shake, setShake] = React.useState(null);
  const [sequenceRunning, setSequenceRunning] = React.useState(false);

  // Toggle die lock
  const toggleLock = (i) => {
    if (sequenceRunning) return;
    setLocked((arr) => arr.map((v, idx) => idx === i ? !v : v));
  };

  // Reroll: spin unlocked dice, randomize their faces
  const reroll = () => {
    if (sequenceRunning) return;
    if (rerolls <= 0) return;
    setRerolls((r) => r - 1);
    setRolling(locked.map((l) => !l));
    setTimeout(() => {
      setDice((d) => d.map((die, i) => locked[i] ? die : ({ ...die, face: 1 + Math.floor(Math.random() * 6) })));
    }, 280);
    setTimeout(() => setRolling([false, false, false, false, false]), 600);
  };

  const tierFromMult = (m) => m >= 8 ? 2 : m >= 4 ? 1 : 0;

  // Score sequence — choreographed beats
  const playHand = () => {
    if (sequenceRunning) return;
    setSequenceRunning(true);
    setHands((h) => h - 1);

    // Reset breakdown
    setChips(0);
    setMult(1);
    setChipsPulse(0);
    setMultPulse(0);
    setTierFlash(0);
    setTier(0);
    setBreakdownVisible(true);
    setStamp(null);
    setBoom(null);
    setCombo(null);

    // Sequence: combo banner, then per-die chip ticks, then mult slams,
    // then target stamp, then boom, then catch.
    const timeline = [];

    // 1) Combo banner
    timeline.push({ at: 250, run: () => setCombo('Auriga · Three of a Kind') });

    // 2) Per-die chip ticks
    const scoringIdx = [1, 2, 4]; // the three sixes
    let runningChips = 0;
    scoringIdx.forEach((idx, n) => {
      timeline.push({
        at: 600 + n * 280,
        run: () => {
          const v = dice[idx].face * 6; // base * arbitrary scoring
          runningChips += v;
          setChips(runningChips);
          setChipsPulse((p) => p + 1);
          setScoreBumps((arr) => arr.map((b, j) => j === idx ? v : b));
          setTimeout(() => setScoreBumps((arr) => arr.map((b, j) => j === idx ? null : b)), 800);
        },
      });
    });

    // 3) Mult slams (catalyst contributions)
    timeline.push({
      at: 1700,
      run: () => {
        setMult((m) => +(m + 3).toFixed(2));
        setMultPulse((p) => p + 1);
      },
    });
    timeline.push({
      at: 2050,
      run: () => {
        // Cross threshold to gold tier (×8)
        setMult((m) => {
          const next = +(m * 2).toFixed(2);
          const t = tierFromMult(next);
          if (t > tierFromMult(m)) {
            setTier(t);
            setTierFlash((f) => f + 1);
            setShake('md');
            setTimeout(() => setShake(null), 400);
          }
          return next;
        });
        setMultPulse((p) => p + 1);
      },
    });

    // 4) Cross-target stamp
    timeline.push({
      at: 2500,
      run: () => {
        setStamp('target');
        setShake('lg');
        setTimeout(() => {
          setStamp(null);
          setShake(null);
        }, 720);
      },
    });

    // 5) Boom
    timeline.push({
      at: 3250,
      run: () => {
        const finalTotal = runningChips * 8; // chips * mult
        setBoom({ phase: 'hold', total: finalTotal, gold: true });
      },
    });

    // 6) Stars fly + catch
    timeline.push({
      at: 4500,
      run: () => {
        // Compute target offset toward score counter
        const counter = document.querySelector('[data-score-counter]');
        const boomEl = document.querySelector('[data-boom]');
        // We don't actually have refs here; approximate based on stage geometry.
        // Boom is centered, counter is top-left ~ (130, 90). Stage is 1280x800.
        const dx = -465; // toward score counter from center
        const dy = -300;
        const stars = Array.from({ length: 12 }, (_, i) => ({
          dx: dx + (Math.random() - 0.5) * 60,
          dy: dy + (Math.random() - 0.5) * 24,
          delay: i * 30,
        }));
        setBoom((b) => b ? { ...b, phase: 'fly', stars } : null);
      },
    });

    timeline.push({
      at: 5250,
      run: () => {
        const finalTotal = runningChips * 8;
        setScore((s) => s + finalTotal);
        setBoom(null);
        setBreakdownVisible(false);
        setSequenceRunning(false);
        setShards((s) => s + 5);
        // counter catch animation
        const counter = document.querySelector('[data-score-counter]');
        if (counter) {
          counter.style.animation = 'ff-counter-catch 260ms var(--ease-spring)';
          setTimeout(() => { counter.style.animation = ''; }, 280);
        }
      },
    });

    timeline.forEach(({ at, run }) => setTimeout(run, at));
  };

  const reset = () => {
    setScore(0); setHands(3); setRerolls(2); setShards(7);
    setDice(STARTING_DICE);
    setLocked([false, true, true, false, true]);
    setRolling([false, false, false, false, false]);
    setBreakdownVisible(false); setStamp(null); setBoom(null); setCombo(null);
    setChips(0); setMult(1); setChipsPulse(0); setMultPulse(0); setTierFlash(0); setTier(0);
    setSequenceRunning(false); setShake(null);
    setScoreBumps([null, null, null, null, null]);
    setHasRolled(true);
  };

  const canScore = locked.some((l) => l) && !sequenceRunning;

  return (
    <div className="ff-stage" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <TopBar
          score={score} target={target} ante={3} blind="The Cracked Mirror"
          hands={hands} rerolls={rerolls} shards={shards} accent="#7be3ff"
        />

        <CatalystStrip items={CATALYSTS} />

        <ComboBanner name={combo} />
        <ScoreBreakdown
          chips={chips} mult={mult}
          chipsPulse={chipsPulse} multPulse={multPulse}
          tier={tier} tierFlash={tierFlash}
          visible={breakdownVisible}
        />

        {/* Dice tray */}
        <div style={{
          position: 'absolute', left: '50%', top: 420,
          transform: 'translate(-50%, -50%)',
          display: 'flex', gap: 38, zIndex: 3,
          animation: shake ? `ff-shake-${shake} 380ms ease-out` : undefined,
        }}>
          {dice.map((die, i) => (
            <Die3D
              key={i}
              face={die.face}
              size={92}
              styleKey={die.style}
              locked={locked[i]}
              rolling={rolling[i]}
              scoring={scoreBumps[i] != null}
              scoreValue={scoreBumps[i]}
              mods={die.mods}
              onClick={() => toggleLock(i)}
              label={locked[i] ? null : 'tap to lock'}
            />
          ))}
        </div>

        {/* Locked-bar — visual reinforcement of the locked group */}
        <div style={{
          position: 'absolute', left: '50%', top: 540,
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.32em' }}>
            ◇ locked group · {locked.filter(Boolean).length} dice
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {locked.map((l, i) => (
              <div key={i} style={{
                width: 22, height: 4, borderRadius: 2,
                background: l ? '#7be3ff' : 'rgba(149,119,255,0.25)',
                boxShadow: l ? '0 0 8px #7be3ff' : 'none',
                transition: 'all 180ms var(--ease-snap)',
              }} />
            ))}
          </div>
        </div>

        <StampOverlay kind={stamp} />
        {boom && <Boom total={boom.total} gold={boom.gold} phase={boom.phase} stars={boom.stars} />}

        <ActionBar
          onRoll={reroll}
          onScore={playHand}
          canScore={canScore}
          hasRolled={hasRolled}
        />

        {/* Reset button — design canvas affordance */}
        <button
          onClick={reset}
          className="ff-btn ff-btn-ghost"
          style={{
            position: 'absolute', bottom: 28, right: 28,
            fontSize: 11, padding: '8px 14px',
          }}
        >↺ Reset</button>

        {/* Helper hint */}
        <div style={{
          position: 'absolute', bottom: 90, left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10, color: 'rgba(187,168,255,0.55)',
          letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>
          tap dice to toggle lock · play hand to score
        </div>
      </div>
    </div>
  );
}

window.RoundScreen = RoundScreen;
