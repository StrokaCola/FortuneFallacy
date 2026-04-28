// Screens for Fortune Fallacy. Reads tweaks via props. Each screen is full-stage.

const { useState: rsUseState, useMemo: rsUseMemo, useRef: rsUseRef, useEffect: rsUseEffect } = React;

// ---- Common chrome: top stat bar -------------------------------------------
function TopBar({ ante = 2, blind = 'Big Blind', shards = 12, hands = 3, rerolls = 2, target = 2000, score = 0, accent = '#7be3ff' }) {
  return (
    <div style={{
      position: 'absolute', top: 18, left: 18, right: 18,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      pointerEvents: 'none', zIndex: 5,
    }}>
      {/* left: score / target */}
      <div className="panel" style={{ padding: '14px 18px', minWidth: 280, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Astrolabe size={92} score={score} target={target} accent={accent} />
          <div>
            <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>score</div>
            <div className="f-display num" style={{ fontSize: 38, lineHeight: 1, color: '#f3f0ff', fontWeight: 700 }}>
              {score.toLocaleString()}
            </div>
            <div className="f-mono num" style={{ fontSize: 12, color: accent, marginTop: 2 }}>
              / {target.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* center: blind name + ante */}
      <div className="panel" style={{ padding: '12px 22px', textAlign: 'center', pointerEvents: 'auto' }}>
        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff' }}>
          ante {String(ante).padStart(2,'0')} · {blind.toLowerCase()}
        </div>
        <div className="f-display" style={{ fontSize: 22, marginTop: 4, color: '#f3f0ff' }}>{blind}</div>
        <div className="f-mono" style={{ fontSize: 10, color: '#9577ff', marginTop: 2 }}>
          hands {hands} · rerolls {rerolls}
        </div>
      </div>

      {/* right: shards + run state */}
      <div className="panel" style={{ padding: '14px 18px', minWidth: 200, pointerEvents: 'auto' }}>
        <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>treasury</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Sigil kind="star" size={20} color="#f5c451" />
          <div className="f-display num" style={{ fontSize: 32, color: '#f5c451', fontWeight: 700 }}>
            {shards}
          </div>
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.2em' }}>shards</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <span className="f-mono" style={{ fontSize: 10, color: '#7be3ff', padding: '2px 6px',
            border: '1px solid rgba(123,227,255,0.4)', borderRadius: 4 }}>oracles 2/3</span>
          <span className="f-mono" style={{ fontSize: 10, color: '#bba8ff', padding: '2px 6px',
            border: '1px solid rgba(149,119,255,0.3)', borderRadius: 4 }}>vouchers 1</span>
        </div>
      </div>
    </div>
  );
}

// ---- Combo banner ----------------------------------------------------------
function ComboBanner({ combo, accent = '#7be3ff' }) {
  const c = COMBOS.find(x => x.id === combo) ?? COMBOS[0];
  return (
    <div style={{
      position: 'absolute', left: '50%', top: 145, transform: 'translateX(-50%)',
      pointerEvents: 'none', textAlign: 'center', zIndex: 4,
    }}>
      <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.4em', color: '#bba8ff', marginBottom: 4 }}>
        ◇ pattern detected ◇
      </div>
      <div className="panel-strong" style={{ padding: '10px 28px', display: 'inline-flex', alignItems: 'center', gap: 18,
            border: `1px solid ${accent}88`, boxShadow: `0 0 28px ${accent}55, inset 0 0 18px ${accent}20` }}>
        <span className="f-display" style={{ fontSize: 22, color: '#f3f0ff' }}>{c.name}</span>
        <span className="f-mono num" style={{ fontSize: 14, color: '#7be3ff' }}>+{c.chips}</span>
        <span style={{ width: 1, height: 18, background: 'rgba(149,119,255,0.4)' }} />
        <span className="f-mono num" style={{ fontSize: 14, color: '#ff7847' }}>×{c.mult}</span>
      </div>
    </div>
  );
}

// ---- Oracle slot (top corner of round) -------------------------------------
function OracleStrip({ oracles = [] }) {
  return (
    <div style={{
      position: 'absolute', top: 142, left: 18,
      display: 'flex', gap: 8, zIndex: 4,
    }}>
      {oracles.map((o, i) => (
        <div key={i} className="has-tip" style={{ position: 'relative' }}>
          <div style={{
            width: 64, height: 88, borderRadius: 8,
            background: `linear-gradient(180deg, ${o.color}25, rgba(15,9,37,0.85))`,
            border: `1px solid ${o.color}80`,
            boxShadow: `0 0 14px ${o.color}40, inset 0 0 10px ${o.color}20`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 4px',
            cursor: 'help',
          }}>
            <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.18em', color: '#bba8ff' }}>oracle</div>
            <div style={{ fontSize: 28, color: o.color, filter: `drop-shadow(0 0 6px ${o.color})` }}>{o.icon}</div>
            <div className="f-mono uc" style={{ fontSize: 7, letterSpacing: '0.14em', color: o.color, textAlign: 'center', lineHeight: 1.2 }}>
              {o.name.split(' ').pop()}
            </div>
          </div>
          <div className="tip">{o.desc}</div>
        </div>
      ))}
    </div>
  );
}

// ---- Consumable tray (right side of round) ---------------------------------
function ConsumableTray({ items = [] }) {
  return (
    <div style={{ position: 'absolute', top: 142, right: 18, display: 'flex', gap: 8, zIndex: 4 }}>
      {items.map((c, i) => (
        <div key={i} className="has-tip" style={{ position: 'relative' }}>
          <div style={{
            width: 64, height: 88, borderRadius: 8,
            background: `linear-gradient(180deg, rgba(28,18,69,0.9), rgba(15,9,37,0.95))`,
            border: `1px dashed ${c.color}60`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 4px',
            cursor: 'pointer',
          }}>
            <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.18em', color: c.type === 'tarot' ? '#bba8ff' : '#7be3ff' }}>
              {c.type}
            </div>
            <div style={{ fontSize: 28, color: c.color, filter: `drop-shadow(0 0 6px ${c.color}80)` }}>{c.icon}</div>
            <div className="f-mono uc" style={{ fontSize: 7, letterSpacing: '0.14em', color: '#dcd4ff', textAlign: 'center', lineHeight: 1.1 }}>
              {c.name}
            </div>
          </div>
          <div className="tip">{c.desc}</div>
        </div>
      ))}
    </div>
  );
}

// ---- Helper: detect best combo from face counts -----------------------------
function detectCombo(faces) {
  const counts = {};
  faces.forEach(f => counts[f] = (counts[f] || 0) + 1);
  const counted = Object.values(counts).sort((a, b) => b - a);
  const uniq = [...new Set(faces)].sort((a, b) => a - b);
  let run = 1, longest = 1;
  for (let i = 1; i < uniq.length; i++) {
    if (uniq[i] === uniq[i-1] + 1) { run++; longest = Math.max(longest, run); }
    else run = 1;
  }
  if (counted[0] >= 5) return 'five_kind';
  if (counted[0] === 4) return 'four_kind';
  if (longest >= 5) return 'lg_straight';
  if (counted[0] === 3 && counted[1] === 2) return 'full_house';
  if (longest >= 4) return 'sm_straight';
  if (counted[0] === 3) return 'three_kind';
  if (counted[0] === 2 && counted[1] === 2) return 'two_pair';
  if (counted[0] === 2) return 'one_pair';
  return 'chance';
}

// indices of dice that contribute to combo
function scoringIndices(faces, comboId) {
  const counts = {};
  faces.forEach((f, i) => { (counts[f] = counts[f] || []).push(i); });
  if (comboId === 'five_kind' || comboId === 'four_kind' || comboId === 'three_kind' || comboId === 'one_pair') {
    return Object.values(counts).sort((a, b) => b.length - a.length)[0];
  }
  if (comboId === 'two_pair') {
    return Object.values(counts).filter(g => g.length === 2).flat();
  }
  if (comboId === 'full_house') {
    return Object.values(counts).filter(g => g.length >= 2).flat();
  }
  if (comboId === 'lg_straight' || comboId === 'sm_straight') {
    // pick longest run indices
    const sorted = faces.map((f, i) => ({ f, i })).sort((a, b) => a.f - b.f);
    let best = [], cur = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].f === sorted[i-1].f) continue;
      if (sorted[i].f === sorted[i-1].f + 1) cur.push(sorted[i]);
      else { if (cur.length > best.length) best = cur; cur = [sorted[i]]; }
    }
    if (cur.length > best.length) best = cur;
    return best.map(x => x.i);
  }
  return [];
}

// ---- ROUND screen ----------------------------------------------------------
function RoundScreen({ tweaks, ctx }) {
  const dieSize  = tweaks.dieSize ?? 88;
  const trayCurve = tweaks.trayCurve ?? 1;
  const accentMap = { astral: '#7be3ff', gold: '#f5c451', ember: '#ff7847', violet: '#bba8ff' };
  const accent = accentMap[tweaks.primaryAccent] ?? '#7be3ff';

  // simulated dice — controllable via tweaks
  const targets = { 300: [3,3,2,5,1], 600: [4,4,4,2,1], 1000: [5,5,5,2,2],
                    1200:[6,6,3,3,2], 2000:[6,5,4,3,2], 3500:[6,6,6,6,1],
                    4000:[5,5,4,4,2], 6000:[1,2,3,4,5], 10000:[6,6,6,5,5] };
  // pick faces based on combo tweak
  const comboFaces = {
    five_kind:   [4,4,4,4,4],
    four_kind:   [5,5,5,5,2],
    full_house:  [3,3,3,2,2],
    lg_straight: [1,2,3,4,5],
    sm_straight: [2,3,4,5,1],
    three_kind:  [6,6,6,2,4],
    two_pair:    [5,5,3,3,1],
    one_pair:    [4,4,1,3,6],
    chance:      [1,2,4,6,3],
  };
  const faces = comboFaces[tweaks.comboTier] ?? comboFaces.full_house;

  const [locked, setLocked] = rsUseState([false, false, false, false, false]);
  const toggleLock = (i) => setLocked(prev => prev.map((v, j) => j === i ? !v : v));

  const comboId = detectCombo(faces);
  const scIdxs = scoringIndices(faces, comboId);
  const combo = COMBOS.find(c => c.id === comboId);

  const dieRunes = [
    [{ icon: '⬆', name: 'Amplify', color: '#7be3ff' }],
    [],
    [{ icon: '◆', name: 'Gilded', color: '#f5c451' }, { icon: '▲', name: 'Sharpened', color: '#ff7847' }],
    [],
    [{ icon: '✦', name: 'Blessed', color: '#bba8ff' }],
  ];

  // tray geometry — 5 dice arranged on a gentle arc
  const trayCenter = { x: 640, y: 600 };
  const spread = 130;
  const arc = trayCurve * 30;
  const positions = faces.map((_, i) => {
    const t = (i - 2) / 2; // -1 .. 1
    return {
      x: trayCenter.x + t * spread * 2,
      y: trayCenter.y + Math.abs(t) * arc,
    };
  });

  // constellation points = scoring dice center
  const constellationPoints = scIdxs.map(i => ({
    x: positions[i].x, y: positions[i].y - (locked[i] ? 12 : 0),
  }));

  // score breakdown
  const scoringFaces = scIdxs.map(i => faces[i]);
  const baseChips = scoringFaces.reduce((a,b) => a + b, 0);
  const totalChips = combo.chips + baseChips + scIdxs.length * 2 /* amplify guess */;
  const totalMult = combo.mult + 1;
  const score = totalChips * totalMult;

  const oracles = [ORACLES[0], ORACLES[3]];
  const consumables = [CONSUMABLES[0], CONSUMABLES[2]];
  const target = [300, 600, 1000, 1200, 2000, 3500, 4000, 6000, 10000][(tweaks.anteLevel - 1) * 3 + 1] || 2000;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TopBar ante={tweaks.anteLevel} blind="Big Blind" shards={tweaks.shardsCount} hands={3} rerolls={2}
              target={target} score={score} accent={accent} />

      <OracleStrip oracles={oracles} />
      <ConsumableTray items={consumables} />

      <ComboBanner combo={comboId} accent={accent} />

      {/* Score breakdown chip */}
      <div style={{
        position: 'absolute', left: '50%', top: 230, transform: 'translateX(-50%)',
        display: 'flex', gap: 16, zIndex: 3, pointerEvents: 'none',
      }}>
        <div className="panel" style={{ padding: '8px 16px', textAlign: 'center' }}>
          <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.18em' }}>chips</div>
          <div className="f-display num" style={{ fontSize: 28, color: '#7be3ff' }}>{totalChips}</div>
        </div>
        <div className="f-display" style={{ fontSize: 36, color: '#bba8ff', alignSelf: 'center' }}>×</div>
        <div className="panel" style={{ padding: '8px 16px', textAlign: 'center' }}>
          <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.18em' }}>mult</div>
          <div className="f-display num" style={{ fontSize: 28, color: '#ff7847' }}>{totalMult}</div>
        </div>
      </div>

      {/* Tray */}
      <div style={{
        position: 'absolute',
        left: trayCenter.x - 480, top: trayCenter.y - 100,
        width: 960, height: 220,
        pointerEvents: 'none',
      }}>
        {/* tray base */}
        <svg width="960" height="220" viewBox="0 0 960 220" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id="trayGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(149,119,255,0.0)" />
              <stop offset="60%" stopColor="rgba(149,119,255,0.18)" />
              <stop offset="100%" stopColor="rgba(28,18,69,0.5)" />
            </linearGradient>
          </defs>
          <path d={`M 40 100 Q 480 ${100 + arc * 2 + 60} 920 100 L 920 200 L 40 200 Z`}
                fill="url(#trayGrad)"
                stroke="rgba(149,119,255,0.4)" strokeWidth="1.2" />
          {/* tick marks */}
          {Array.from({length: 11}).map((_, i) => (
            <line key={i}
                  x1={40 + i * 88} y1={100 + Math.abs((i-5)/5) * arc * 2}
                  x2={40 + i * 88} y2={106 + Math.abs((i-5)/5) * arc * 2}
                  stroke="rgba(187,168,255,0.5)" strokeWidth="0.8" />
          ))}
        </svg>
      </div>

      {/* Constellation lines */}
      {tweaks.constellationLines && (
        <ConstellationLines points={constellationPoints} color={accent} show />
      )}

      {/* Dice */}
      {faces.map((f, i) => {
        const p = positions[i];
        const scoring = scIdxs.includes(i);
        return (
          <div key={i} style={{
            position: 'absolute',
            left: p.x - dieSize / 2,
            top: p.y - dieSize / 2 - (locked[i] ? 12 : 0),
            zIndex: scoring ? 6 : 5,
            pointerEvents: 'auto',
            animation: `float-y ${3 + i * 0.3}s ease-in-out infinite`,
          }}>
            <Die face={f} size={dieSize}
                 style={tweaks.dieStyle}
                 locked={locked[i]} scoring={scoring}
                 runes={dieRunes[i]}
                 onClick={() => toggleLock(i)} />
            {scoring && tweaks.scoringFx && (
              <div style={{
                position: 'absolute', left: dieSize / 2, top: -6, transform: 'translateX(-50%)',
                fontSize: 11, color: accent,
                fontFamily: 'JetBrains Mono, monospace',
                textShadow: `0 0 6px ${accent}`,
              }}>+{f}</div>
            )}
          </div>
        );
      })}

      {/* Action buttons */}
      <div style={{
        position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)',
        display: 'flex', gap: 16, zIndex: 5,
      }}>
        <button className="btn btn-ghost">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: accent }}>↻</span> Reroll <span className="f-mono" style={{ fontSize: 11, opacity: 0.7 }}>(2)</span>
          </span>
        </button>
        <button className="btn btn-primary">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            ✦ Cast Hand
          </span>
        </button>
        <button className="btn btn-ghost">
          <span style={{ color: '#f5c451' }}>◆</span>&nbsp; Discard
        </button>
      </div>

      {/* Inline help hint */}
      {tweaks.showInlineHelp && (
        <div style={{
          position: 'absolute', left: 18, bottom: 18, zIndex: 4,
          maxWidth: 300, fontFamily: 'Exo 2', fontSize: 11, color: '#bba8ff', lineHeight: 1.5,
        }}>
          <span className="f-mono uc" style={{ letterSpacing: '0.2em', color: '#7be3ff', display: 'block', marginBottom: 4 }}>
            ◇ astral hint
          </span>
          Click any die to lock it for the next roll. Highlighted dice form a constellation — your scoring pattern.
        </div>
      )}
    </div>
  );
}

// ---- HUB / blind select screen ---------------------------------------------
function HubScreen({ tweaks }) {
  const accentMap = { astral: '#7be3ff', gold: '#f5c451', ember: '#ff7847', violet: '#bba8ff' };
  const accent = accentMap[tweaks.primaryAccent] ?? '#7be3ff';
  const blinds = [
    { name: 'Small Blind', target: 1200, reward: 5, mult: '×1.0', kind: 'small', sigil: '☽' },
    { name: 'Big Blind',   target: 2000, reward: 5, mult: '×1.5', kind: 'big',   sigil: '☀', current: true },
    { name: 'Boss Blind',  target: 4000, reward: 8, mult: '×2.0', kind: 'boss',  sigil: '⛧' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TopBar ante={tweaks.anteLevel} blind="Hub" shards={tweaks.shardsCount} hands={3} rerolls={2}
              target={2000} score={0} accent={accent} />

      <div style={{ position: 'absolute', left: '50%', top: 200, transform: 'translateX(-50%)',
                    textAlign: 'center', zIndex: 4 }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ choose your trial ◇
        </div>
        <div className="f-display" style={{ fontSize: 36, color: '#f3f0ff', marginTop: 8 }}>
          The Tribunal of Stars
        </div>
        <div className="f-body" style={{ fontSize: 13, color: '#bba8ff', marginTop: 6, maxWidth: 460 }}>
          Three blinds bar your ascension. Each cleared blind grants shards and admittance to the Bazaar.
        </div>
      </div>

      <div style={{ position: 'absolute', left: '50%', top: 360, transform: 'translateX(-50%)',
                    display: 'flex', gap: 26, zIndex: 4 }}>
        {blinds.map((b, i) => {
          const isBoss = b.kind === 'boss';
          const cur = b.current;
          return (
            <div key={i} className="panel-strong" style={{
              width: 240, height: 320, padding: 20,
              border: cur ? `2px solid ${accent}` : (isBoss ? '1px solid rgba(226,51,74,0.5)' : '1px solid rgba(149,119,255,0.3)'),
              boxShadow: cur ? `0 0 30px ${accent}55` : (isBoss ? '0 0 24px rgba(226,51,74,0.3)' : '0 8px 24px rgba(0,0,0,0.4)'),
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <OrnateFrame style={{ width: '100%', height: '100%' }} color={cur ? accent : (isBoss ? 'rgba(226,51,74,0.6)' : 'rgba(245,196,81,0.4)')}>
                <div style={{ position: 'absolute', inset: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: cur ? accent : '#bba8ff' }}>
                    blind {String(i+1).padStart(2,'0')}
                  </div>
                  <div className="f-display" style={{ fontSize: 22, color: '#f3f0ff', marginTop: 6 }}>
                    {b.name}
                  </div>
                  <div style={{
                    fontSize: 64, marginTop: 14,
                    color: isBoss ? '#e2334a' : (cur ? accent : '#9577ff'),
                    filter: `drop-shadow(0 0 14px ${isBoss ? '#e2334a' : (cur ? accent : '#9577ff')}80)`,
                  }}>{b.sigil}</div>

                  <div style={{ marginTop: 'auto', textAlign: 'center', width: '100%' }}>
                    <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.2em', color: '#bba8ff' }}>target</div>
                    <div className="f-display num" style={{ fontSize: 26, color: '#f3f0ff' }}>{b.target.toLocaleString()}</div>
                    <div className="f-mono" style={{ fontSize: 10, color: accent, marginTop: 2 }}>{b.mult} multiplier</div>
                    <div className="f-mono" style={{ fontSize: 10, color: '#f5c451', marginTop: 6 }}>
                      ◇ +{b.reward} shards
                    </div>
                  </div>
                </div>
              </OrnateFrame>

              {cur && (
                <button className="btn btn-primary" style={{
                  position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 13, padding: '10px 18px',
                }}>Begin</button>
              )}
              {!cur && i < 1 && (
                <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                              fontSize: 10, color: '#9577ff', fontFamily: 'JetBrains Mono', }}>
                  ✓ cleared
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12 }}>
        <button className="btn btn-ghost">⚒ Forge</button>
        <button className="btn btn-ghost">↪ Skip (+3 ◇)</button>
      </div>
    </div>
  );
}

// ---- SHOP screen -----------------------------------------------------------
function ShopScreen({ tweaks }) {
  const accentMap = { astral: '#7be3ff', gold: '#f5c451', ember: '#ff7847', violet: '#bba8ff' };
  const accent = accentMap[tweaks.primaryAccent] ?? '#7be3ff';

  const offers = [
    { kind: 'oracle', item: ORACLES[2], price: 6 },
    { kind: 'rune',   item: RUNES[1],   price: 3 },
    { kind: 'tarot',  item: CONSUMABLES[0], price: 4 },
    { kind: 'voucher',item: VOUCHERS[0], price: 8 },
  ];
  const reroll = 2;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TopBar ante={tweaks.anteLevel} blind="Bazaar" shards={tweaks.shardsCount} hands={3} rerolls={2}
              target={2000} score={0} accent={accent} />

      <div style={{ position: 'absolute', left: '50%', top: 180, transform: 'translateX(-50%)',
                    textAlign: 'center', zIndex: 4 }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ between the stars ◇
        </div>
        <div className="f-display" style={{ fontSize: 36, color: '#f3f0ff', marginTop: 8 }}>
          The Celestial Bazaar
        </div>
      </div>

      <div style={{ position: 'absolute', left: '50%', top: 290, transform: 'translateX(-50%)',
                    display: 'flex', gap: 18, zIndex: 4 }}>
        {offers.map((o, i) => {
          const it = o.item;
          const c = it.color || accent;
          return (
            <div key={i} className="panel-strong" style={{
              width: 180, height: 250, padding: 14,
              border: `1px solid ${c}55`,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              cursor: 'pointer',
              animation: `float-y ${3 + i * 0.4}s ease-in-out infinite`,
            }}>
              <div className="f-mono uc" style={{
                fontSize: 9, letterSpacing: '0.28em', color: c, marginBottom: 6,
                padding: '2px 6px', border: `1px solid ${c}55`, borderRadius: 4,
              }}>{o.kind}</div>
              <div style={{
                width: 84, height: 84, borderRadius: 12,
                background: `radial-gradient(circle, ${c}30, rgba(15,9,37,0.9))`,
                border: `1px solid ${c}80`,
                display: 'grid', placeItems: 'center',
                fontSize: 40, color: c,
                filter: `drop-shadow(0 0 10px ${c}80)`,
                marginTop: 8,
              }}>{it.icon || '◇'}</div>
              <div className="f-head" style={{ fontSize: 14, color: '#f3f0ff', marginTop: 12, textAlign: 'center' }}>
                {it.name}
              </div>
              <div className="f-body" style={{ fontSize: 11, color: '#bba8ff', marginTop: 6, textAlign: 'center', lineHeight: 1.4, flex: 1 }}>
                {it.desc}
              </div>
              <div style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 'auto', paddingTop: 8, borderTop: `1px solid rgba(149,119,255,0.2)`,
              }}>
                <span className="f-mono num" style={{ color: '#f5c451', fontSize: 14 }}>◆ {o.price}</span>
                <span className="f-mono uc" style={{ fontSize: 9, color: tweaks.shardsCount >= o.price ? accent : '#e2334a',
                                                     letterSpacing: '0.2em' }}>
                  {tweaks.shardsCount >= o.price ? 'buy' : 'low'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', left: '50%', bottom: 70, transform: 'translateX(-50%)', display: 'flex', gap: 12 }}>
        <button className="btn btn-ghost">↻ Reshuffle ({reroll}◇)</button>
        <button className="btn btn-primary">Next Blind →</button>
      </div>
    </div>
  );
}

// ---- FORGE screen (rune attachment) ----------------------------------------
function ForgeScreen({ tweaks }) {
  const accentMap = { astral: '#7be3ff', gold: '#f5c451', ember: '#ff7847', violet: '#bba8ff' };
  const accent = accentMap[tweaks.primaryAccent] ?? '#7be3ff';
  const dice = [1,4,6,3,5];
  const [selectedDie, setSelectedDie] = rsUseState(2);
  const [hovered, setHovered] = rsUseState(null);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TopBar ante={tweaks.anteLevel} blind="Forge" shards={tweaks.shardsCount} hands={3} rerolls={2}
              target={2000} score={0} accent={accent} />

      <div style={{ position: 'absolute', left: '50%', top: 160, transform: 'translateX(-50%)',
                    textAlign: 'center', zIndex: 4 }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ etch the cosmos ◇
        </div>
        <div className="f-display" style={{ fontSize: 32, color: '#f3f0ff', marginTop: 6 }}>
          The Star Forge
        </div>
      </div>

      {/* Selected die (large) */}
      <div style={{ position: 'absolute', left: 260, top: 280, width: 360, height: 360,
                    display: 'grid', placeItems: 'center' }}>
        <div className="panel" style={{ width: '100%', height: '100%', position: 'relative',
              display: 'grid', placeItems: 'center' }}>
          {/* orbit ring */}
          <svg width="320" height="320" viewBox="0 0 320 320" style={{ position: 'absolute' }}>
            <circle cx="160" cy="160" r="140"
                    stroke="rgba(149,119,255,0.3)" strokeWidth="1" fill="none"
                    strokeDasharray="4 6" />
            <g style={{ transformOrigin: 'center', animation: 'orbit 30s linear infinite' }}>
              {[0, 90, 180, 270].map(a => {
                const x = 160 + Math.cos(a * Math.PI/180) * 140;
                const y = 160 + Math.sin(a * Math.PI/180) * 140;
                return <circle key={a} cx={x} cy={y} r="3" fill={accent}
                               style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />;
              })}
            </g>
          </svg>
          <Die face={dice[selectedDie]} size={140} style={tweaks.dieStyle}
               runes={[{ icon: '⬆', name: 'Amplify', color: '#7be3ff' }]} />
          <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16,
                        textAlign: 'center' }}>
            <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.2em' }}>die {selectedDie + 1} · 1 rune attached</div>
          </div>
        </div>
      </div>

      {/* Die selector strip */}
      <div style={{ position: 'absolute', left: 260, bottom: 50, width: 360,
                    display: 'flex', justifyContent: 'space-between' }}>
        {dice.map((f, i) => (
          <div key={i} onClick={() => setSelectedDie(i)} style={{
            cursor: 'pointer',
            opacity: i === selectedDie ? 1 : 0.5,
            transform: i === selectedDie ? 'translateY(-4px)' : 'none',
            transition: 'all 200ms',
          }}>
            <Die face={f} size={56} style={tweaks.dieStyle} />
          </div>
        ))}
      </div>

      {/* Rune library */}
      <div style={{ position: 'absolute', right: 60, top: 260, width: 380, height: 440 }}>
        <div className="panel-strong" style={{ width: '100%', height: '100%', padding: 18 }}>
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.3em', marginBottom: 12 }}>
            ◈ rune codex
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {RUNES.map((r, i) => (
              <div key={r.id}
                   onMouseEnter={() => setHovered(i)}
                   onMouseLeave={() => setHovered(null)}
                   style={{
                cursor: 'pointer',
                padding: 10, borderRadius: 8,
                background: hovered === i ? `${r.color}15` : 'rgba(15,9,37,0.5)',
                border: `1px solid ${hovered === i ? r.color : 'rgba(149,119,255,0.2)'}`,
                transition: 'all 150ms',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: `${r.color}25`,
                  border: `1px solid ${r.color}80`,
                  display: 'grid', placeItems: 'center',
                  color: r.color, fontSize: 16,
                  filter: `drop-shadow(0 0 4px ${r.color})`,
                }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="f-head" style={{ fontSize: 12, color: '#f3f0ff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {r.name}
                  </div>
                  <div className="f-body" style={{ fontSize: 10, color: '#bba8ff', lineHeight: 1.3 }}>
                    {r.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- BOSS REVEAL screen ----------------------------------------------------
function BossRevealScreen({ tweaks }) {
  const boss = BOSSES.find(b => b.id === tweaks.boss) ?? BOSSES[0];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div style={{
        width: 440, height: 600, position: 'relative',
        animation: 'float-y 4s ease-in-out infinite',
      }}>
        <div className="panel-strong" style={{
          width: '100%', height: '100%', padding: 28,
          border: `2px solid ${boss.color}`,
          boxShadow: `0 0 60px ${boss.color}66, 0 30px 80px rgba(0,0,0,0.7)`,
          background: `linear-gradient(180deg, ${boss.color}15, rgba(15,9,37,0.95))`,
          position: 'relative',
        }}>
          <OrnateFrame style={{ width: '100%', height: '100%' }} color={boss.color}>
            <div style={{ position: 'absolute', inset: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.5em', color: '#e2334a', marginTop: 12 }}>
                boss blind
              </div>
              <div style={{ width: 36, height: 1, background: boss.color, marginTop: 8, opacity: 0.6 }} />

              <div style={{
                fontSize: 180, color: boss.color, marginTop: 20,
                filter: `drop-shadow(0 0 30px ${boss.color}cc)`,
                lineHeight: 1,
              }}>
                <Sigil kind={boss.sigil} size={180} color={boss.color} />
              </div>

              <div className="f-display" style={{ fontSize: 28, color: '#f3f0ff', marginTop: 16, textAlign: 'center' }}>
                {boss.name}
              </div>
              <div className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.32em', color: boss.color, marginTop: 6 }}>
                arcanum {String(BOSSES.indexOf(boss) + 1).padStart(2, '0')} · ante {tweaks.anteLevel}
              </div>

              <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '20px 0' }} />

              <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: '#bba8ff' }}>
                hex
              </div>
              <div className="f-body" style={{ fontSize: 14, color: '#f3f0ff', marginTop: 6, textAlign: 'center', fontStyle: 'italic' }}>
                "{boss.desc}"
              </div>

              <div style={{ flex: 1 }} />

              <button className="btn btn-primary" style={{
                marginTop: 20,
                background: `linear-gradient(180deg, ${boss.color}, ${boss.color}aa)`,
                color: '#0f0925',
                boxShadow: `0 0 0 1px ${boss.color}cc, 0 6px 18px ${boss.color}44`,
              }}>
                Confront
              </button>
            </div>
          </OrnateFrame>
        </div>
      </div>
    </div>
  );
}

// ---- TITLE screen ----------------------------------------------------------
function TitleScreen({ tweaks }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#7be3ff', letterSpacing: '0.6em', marginBottom: 24 }}>
          ◇ a roguelike of dice and divination ◇
        </div>
        <div className="f-display" style={{ fontSize: 96, lineHeight: 1, color: '#f3f0ff',
              textShadow: '0 0 40px rgba(123,227,255,0.5), 0 0 80px rgba(149,119,255,0.4)' }}>
          Fortune
        </div>
        <div className="f-display" style={{ fontSize: 96, lineHeight: 1, color: '#7be3ff',
              textShadow: '0 0 40px rgba(123,227,255,0.6)', fontStyle: 'italic' }}>
          Fallacy
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 40 }}>
          <Sigil kind="moon" size={28} color="#bba8ff" />
          <Sigil kind="star" size={32} color="#7be3ff" />
          <Sigil kind="sun" size={28} color="#f5c451" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 36, alignItems: 'center' }}>
          <button className="btn btn-primary" style={{ width: 220 }}>Begin Ascension</button>
          <button className="btn btn-ghost" style={{ width: 220 }}>Continue Run</button>
          <button className="btn btn-tab" style={{ width: 180 }}>Codex</button>
        </div>

        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: '#9577ff', marginTop: 60, opacity: 0.7 }}>
          v 0.42 · seed ⟨LYRA-VII⟩
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  RoundScreen, HubScreen, ShopScreen, ForgeScreen, BossRevealScreen, TitleScreen,
  TopBar, ComboBanner, OracleStrip, ConsumableTray,
});
