// FortuneFallacy — Vibe Coding Game Jam #1
// Balatro-style dice roguelike. Roll. Score. Defy the fallacy.

const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
const W = canvas.width;   // 960
const H = canvas.height;  // 540

// ─── Portal setup ────────────────────────────────────────────────────
const incoming   = Portal.readPortalParams();
const nextTarget = await Portal.pickPortalTarget();

// ─── Audio Engine (Web Audio API, no library) ────────────────────────
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type, duration, gainVal = 0.18, delay = 0) {
  try {
    const ac  = getAudio();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
    g.gain.setValueAtTime(0, ac.currentTime + delay);
    g.gain.linearRampToValueAtTime(gainVal, ac.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + duration);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration + 0.05);
  } catch {}
}

function playNoise(duration, gainVal = 0.12, delay = 0) {
  try {
    const ac  = getAudio();
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * duration), ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    const g   = ac.createGain();
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 800;
    src.buffer = buf;
    src.connect(flt); flt.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(gainVal, ac.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + duration);
    src.start(ac.currentTime + delay);
  } catch {}
}

const SFX = {
  roll()      { playNoise(0.08, 0.15); playTone(180, 'square', 0.06, 0.08); },
  lock()      { playTone(330, 'sine', 0.1, 0.14); },
  unlock()    { playTone(220, 'sine', 0.08, 0.1); },
  playHand()  { playTone(440, 'triangle', 0.1, 0.15); playTone(550, 'triangle', 0.1, 0.12, 0.08); },
  combo(tier) {
    const freqs = [330, 392, 494, 587, 659, 784, 880, 1047, 1175];
    const f = freqs[Math.min(tier, freqs.length - 1)];
    playTone(f, 'triangle', 0.18, 0.2);
    playTone(f * 1.25, 'sine', 0.14, 0.12, 0.06);
    if (tier >= 6) playTone(f * 1.5, 'sine', 0.12, 0.1, 0.12);
  },
  tick(score) { playTone(300 + Math.min(score / 500, 1) * 600, 'square', 0.03, 0.03); },
  mult()      { playTone(110, 'sawtooth', 0.22, 0.08); playTone(165, 'sawtooth', 0.18, 0.07, 0.05); },
  bigScore()  { [523, 659, 784].forEach((f, i) => playTone(f, 'triangle', 0.2, 0.18, i * 0.1)); },
  oracle()    { [1047, 1319, 1568].forEach((f, i) => playTone(f, 'sine', 0.18, 0.12, i * 0.06)); },
  clear()     { [392, 494, 587, 698, 784].forEach((f, i) => playTone(f, 'triangle', 0.18, 0.16, i * 0.08)); },
  win()       { [523, 659, 784, 1047].forEach((f, i) => playTone(f, 'triangle', 0.3, 0.18, i * 0.12)); },
  fail()      { [440, 330, 220, 165].forEach((f, i) => playTone(f, 'sawtooth', 0.25, 0.14, i * 0.1)); },
  portal()    { playNoise(0.3, 0.08); [523, 659, 523].forEach((f, i) => playTone(f, 'sine', 0.25, 0.1, i * 0.1)); },
};

// ─── Particles ────────────────────────────────────────────────────────
const particles = [];

function burst(x, y, color, n = 10, speed = 4) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.4 + Math.random() * 0.6) * speed;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      r: 2 + Math.random() * 3, color, alpha: 1,
      life: 0.6 + Math.random() * 0.5, age: 0 });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.90; p.vy *= 0.90;
    p.age += dt;
    p.alpha = 1 - p.age / p.life;
    if (p.age >= p.life) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ─── Floating labels ──────────────────────────────────────────────────
const floaters = [];

function floatText(x, y, text, color, size = 18) {
  floaters.push({
    x, y, vy: -2.2, text, color, size, alpha: 1, life: 1.5, age: 0,
    scale: 1, ts: 0, rot: (Math.random()-0.5) * 0.2,
  });
}

function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y += f.vy; f.vy *= 0.93;          // spring up and slow
    f.age += dt; f.ts += dt;
    // Bounce-pop: 1.6× → 0.9× → 1× over first 280ms
    if (f.ts < 0.12)       f.scale = 1 + 0.8 * (f.ts / 0.12);
    else if (f.ts < 0.28)  f.scale = 1.8 - 0.9 * ((f.ts - 0.12) / 0.16);
    else                   f.scale = 0.9 + 0.1 * Math.min(1, (f.ts - 0.28) / 0.12);
    f.alpha = f.age > f.life * 0.55 ? 1 - (f.age - f.life*0.55)/(f.life*0.45) : 1;
    if (f.age >= f.life) floaters.splice(i, 1);
  }
}

function drawFloaters() {
  for (const f of floaters) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.alpha);
    ctx.translate(f.x, f.y); ctx.rotate(f.rot || 0);
    const sz = f.size * (f.scale || 1);
    ctx.font = `bold ${sz.toFixed(1)}px ui-sans-serif,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = Math.max(2, sz * 0.18);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(f.text, 0, 0);
    ctx.shadowColor = f.color; ctx.shadowBlur = 6;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
}

// ─── Score ticker ─────────────────────────────────────────────────────
function animateTicker(from, to, duration, onTick, onDone) {
  const start = performance.now();
  const diff  = to - from;
  function step(now) {
    const t      = Math.min(1, (now - start) / (duration * 1000));
    const eased  = 1 - Math.pow(1 - t, 3);
    const cur    = Math.floor(from + diff * eased);
    onTick(cur);
    SFX.tick(cur);
    if (t < 1) requestAnimationFrame(step);
    else { onTick(to); if (onDone) onDone(); }
  }
  requestAnimationFrame(step);
}

// ─── Screen flash ─────────────────────────────────────────────────────
let flashAlpha = 0;
function screenFlash(a = 0.4) { flashAlpha = Math.max(flashAlpha, a); }

// ─── Screen shake ─────────────────────────────────────────────────────
let shakeAmp = 0;
function screenShake(a = 8) { shakeAmp = Math.max(shakeAmp, a); }

// ─── 3D Math ──────────────────────────────────────────────────────────
function rotate3(x, y, z, rx, ry, rz) {
  // Rx
  let y1 = y * Math.cos(rx) - z * Math.sin(rx);
  let z1 = y * Math.sin(rx) + z * Math.cos(rx);
  // Ry
  let x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
  let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
  // Rz
  let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
  let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
  return [x3, y3, z2];
}

// face: number(1-6), normal out, u=right, v=down when viewed from outside
// +Z toward viewer at rest → face 1 shows
const CUBE_FACES = [
  { n:1, normal:[0,0,1],  u:[1,0,0],  v:[0,1,0]  },
  { n:6, normal:[0,0,-1], u:[-1,0,0], v:[0,1,0]  },
  { n:2, normal:[1,0,0],  u:[0,0,-1], v:[0,1,0]  },
  { n:5, normal:[-1,0,0], u:[0,0,1],  v:[0,1,0]  },
  { n:3, normal:[0,-1,0], u:[1,0,0],  v:[0,0,-1] },
  { n:4, normal:[0,1,0],  u:[1,0,0],  v:[0,0,1]  },
];

const PI2 = Math.PI * 2;
// Canonical rotations (rx,ry,rz) to show each face to viewer
const FACE_ROT = {
  1: [0, 0, 0],
  6: [0, Math.PI, 0],
  2: [0, -Math.PI/2, 0],
  5: [0,  Math.PI/2, 0],
  3: [-Math.PI/2, 0, 0],
  4: [ Math.PI/2, 0, 0],
};

function nearestCanon(cur, target) {
  const n = Math.round((cur - target) / PI2);
  return target + n * PI2;
}

// ─── Banner ───────────────────────────────────────────────────────────
let banner = null;

function showBanner(text, color = '#c89960') {
  banner = { text, color, y: -60, targetY: 55, alpha: 1, timer: 2.2 };
}

function updateBanner(dt) {
  if (!banner) return;
  banner.y += (banner.targetY - banner.y) * 0.18;
  banner.timer -= dt;
  if (banner.timer < 0.5) banner.alpha = banner.timer / 0.5;
  if (banner.timer <= 0) banner = null;
}

function drawBanner() {
  if (!banner) return;
  ctx.save();
  ctx.globalAlpha = banner.alpha;
  ctx.fillStyle   = banner.color; ctx.shadowColor = banner.color; ctx.shadowBlur = 10;
  ctx.font        = 'bold 36px ui-sans-serif,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(banner.text, W/2, banner.y);
  ctx.restore();
}

// ─── Combo pop ────────────────────────────────────────────────────────
let comboPop = null;

function showComboPop(text, color) {
  comboPop = { text, color, scale: 2.2, alpha: 1, timer: 1.6 };
}

function updateComboPop(dt) {
  if (!comboPop) return;
  comboPop.scale  = Math.max(1, comboPop.scale - dt * 7);
  comboPop.timer -= dt;
  if (comboPop.timer < 0.4) comboPop.alpha = comboPop.timer / 0.4;
  if (comboPop.timer <= 0) comboPop = null;
}

function drawComboPop() {
  if (!comboPop) return;
  ctx.save();
  ctx.globalAlpha  = comboPop.alpha;
  ctx.fillStyle    = comboPop.color; ctx.shadowColor = comboPop.color; ctx.shadowBlur = 12;
  ctx.font         = `bold ${Math.floor(38 * comboPop.scale)}px ui-sans-serif,sans-serif`;
  ctx.textAlign    = 'center';
  ctx.fillText(comboPop.text, W/2, H/2 - 30);
  ctx.restore();
}

// ─── Draw helpers ─────────────────────────────────────────────────────
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);   ctx.arcTo(x+w, y,   x+w, y+r,   r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);   ctx.arcTo(x,   y+h, x,   y+h-r, r);
  ctx.lineTo(x,   y+r);   ctx.arcTo(x,   y,   x+r, y,     r);
  ctx.closePath();
}

function drawRoundRect(x, y, w, h, r, fill, stroke, lw = 2) {
  roundRect(x, y, w, h, r);
  if (fill)   { ctx.fillStyle = fill;     ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// ─── Ornament helpers ─────────────────────────────────────────────────
const SERIF = "Georgia,'Cinzel','Trajan Pro',serif";

// Draws a parchment-style layered frame with corner sigils and an inner hairline.
function ornamentFrame(x, y, w, h, accent = '#9a3826', opts = {}) {
  const { bg = 'rgba(22,13,7,0.94)', inner = 'rgba(200,153,96,0.35)', corner = 8 } = opts;
  // Outer warm parchment fill with a gentle vertical gradient
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, bg);
  g.addColorStop(1, 'rgba(12,6,3,0.96)');
  drawRoundRect(x, y, w, h, 10, g, accent, 1.5);
  // Inner hairline border (double-stroke look)
  ctx.save();
  ctx.strokeStyle = inner;
  ctx.lineWidth = 1;
  roundRect(x + 4, y + 4, w - 8, h - 8, 7);
  ctx.stroke();
  // Corner accent ticks
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.4;
  const c = corner;
  const mk = (cx, cy, dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * c); ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * c, cy);
    ctx.stroke();
  };
  mk(x + 8,     y + 8,      1,  1);
  mk(x + w - 8, y + 8,     -1,  1);
  mk(x + 8,     y + h - 8,  1, -1);
  mk(x + w - 8, y + h - 8, -1, -1);
  ctx.restore();
}

// Centered serif header with flanking sigils + thin divider line.
function panelHeader(cx, y, width, title, accent = '#c89960', sigil = '✦') {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.font = `bold 13px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  ctx.fillText(title.toUpperCase(), cx, y);
  // Measure for sigil placement
  const m = ctx.measureText(title.toUpperCase());
  const pad = 14;
  ctx.font = `11px ${SERIF}`;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.75;
  ctx.fillText(sigil, cx - m.width/2 - pad, y - 1);
  ctx.fillText(sigil, cx + m.width/2 + pad, y - 1);
  ctx.globalAlpha = 1;
  // Divider line below
  const lineY = y + 6;
  const half = Math.min(width/2 - 10, m.width/2 + 28);
  const grad = ctx.createLinearGradient(cx - half, lineY, cx + half, lineY);
  grad.addColorStop(0,   'rgba(200,153,96,0)');
  grad.addColorStop(0.5, 'rgba(200,153,96,0.55)');
  grad.addColorStop(1,   'rgba(200,153,96,0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - half, lineY);
  ctx.lineTo(cx + half, lineY);
  ctx.stroke();
  // Small center diamond on the divider
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(cx, lineY - 2);
  ctx.lineTo(cx + 2, lineY);
  ctx.lineTo(cx, lineY + 2);
  ctx.lineTo(cx - 2, lineY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const EMBERS = Array.from({ length: 44 }, () => ({
  x: Math.random()*W, y: Math.random()*H,
  r: 0.4 + Math.random()*1.2, ph: Math.random()*Math.PI*2,
  drift: 0.05 + Math.random()*0.15,
}));

function drawBG(t) {
  ctx.fillStyle = '#0d0805';
  ctx.fillRect(0, 0, W, H);

  // Soft warm vignette — candlelight spill from top-left + ember blush bottom-right
  const g1 = ctx.createRadialGradient(W*0.22, H*0.18, 30, W*0.22, H*0.18, W*0.6);
  g1.addColorStop(0,   'rgba(200,153,96,0.10)');
  g1.addColorStop(0.6, 'rgba(120,70,30,0.03)');
  g1.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W*0.82, H*0.92, 10, W*0.82, H*0.92, W*0.55);
  g2.addColorStop(0,   'rgba(154,56,38,0.10)');
  g2.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  // Candle flicker over the whole scene (very subtle)
  const flick = 0.92 + 0.08 * Math.sin(t*6.1) * Math.sin(t*2.7);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(255,${Math.floor(230*flick)},${Math.floor(200*flick)},1)`;
  ctx.fillRect(0,0,W,H);
  ctx.restore();

  // Drifting embers
  for (const s of EMBERS) {
    const a = 0.22 + 0.35 * Math.sin(t*1.4 + s.ph);
    const y = (s.y - t*10*s.drift) % H;
    const yy = y < 0 ? y + H : y;
    ctx.fillStyle = `rgba(220,${130+Math.floor(40*a)},70,${a})`;
    ctx.fillRect(s.x, yy, s.r, s.r);
  }

  // Deep corner vignette
  const g3 = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.35, W/2, H/2, Math.max(W,H)*0.75);
  g3.addColorStop(0,   'rgba(0,0,0,0)');
  g3.addColorStop(1,   'rgba(0,0,0,0.55)');
  ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);
}

function txt(text, x, y, style) {
  const { size=14, color='#fff', align='left', shadow=null, alpha=1, bold=false } = style||{};
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = color;
  ctx.font        = `${bold?'bold ':'' }${size}px ui-sans-serif,sans-serif`;
  ctx.textAlign   = align;
  if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = 4; }
  ctx.fillText(text, x, y);
  ctx.restore();
}

function wrapText(x, y, text, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let row  = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x + maxW/2, y + row*lineH);
      line = w; row++;
    } else { line = test; }
  }
  if (line) ctx.fillText(line, x + maxW/2, y + row*lineH);
}

// ─── Constants ────────────────────────────────────────────────────────
const GOAL_TARGETS    = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
const HANDS_PER_ROUND = 3;
const REROLLS_PER_HAND = 2;
const DICE_COUNT      = 5;   // starting pool size (grows via forge)
const MAX_HELD        = 5;   // max dice that can be held/played in one hand
const MAX_DICE        = 10;  // cap on total pool size
const MAX_ORACLES     = 6;
const SCORES_KEY      = 'fortunefallacy_scores';

// ─── Combo definitions ────────────────────────────────────────────────
// test(valueCounts, longestRun): valueCounts = sorted desc count array
const COMBOS = [
  { id:'five_kind',   name:'Five of a Kind',  tier:8, chips:100, mult:20,
    test: v => v[0] >= 5 },
  { id:'four_kind',   name:'Four of a Kind',  tier:7, chips:60,  mult:12,
    test: v => v[0] >= 4 },
  { id:'full_house',  name:'Full House',      tier:5, chips:35,  mult:8,
    test: v => (v[0]===3 && v[1]===2) },
  { id:'lg_straight', name:'Large Straight',  tier:6, chips:40,  mult:7,
    test: (_,seq) => seq >= 5 },
  { id:'sm_straight', name:'Small Straight',  tier:4, chips:30,  mult:5,
    test: (_,seq) => seq >= 4 },
  { id:'three_kind',  name:'Three of a Kind', tier:3, chips:30,  mult:5,
    test: v => v[0] >= 3 },
  { id:'two_pair',    name:'Two Pair',        tier:2, chips:20,  mult:3,
    test: v => v[0] >= 2 && v[1] >= 2 },
  { id:'one_pair',    name:'One Pair',        tier:1, chips:10,  mult:2,
    test: v => v[0] >= 2 },
  { id:'chance',      name:'Chance',          tier:0, chips:0,   mult:1,
    test: () => true },
];

function detectCombo(faces) {
  const counts = [0,0,0,0,0,0,0];
  for (const f of faces) counts[f]++;
  const vals = counts.filter(c=>c>0).sort((a,b)=>b-a);

  const present = [...new Set(faces)].sort((a,b)=>a-b);
  let seq = 1, best = 1;
  for (let i = 1; i < present.length; i++) {
    seq = present[i] === present[i-1]+1 ? seq+1 : 1;
    best = Math.max(best, seq);
  }

  for (const c of COMBOS) {
    if (c.test(vals, best)) return { ...c };
  }
  return { ...COMBOS[COMBOS.length-1] };
}

// ─── Oracle tiers ─────────────────────────────────────────────────────
const ORACLE_TIERS = {
  common:    { cost: 5,  label: 'Common',    color: '#b8a874' },
  uncommon:  { cost: 8,  label: 'Uncommon',  color: '#88b0d4' },
  rare:      { cost: 12, label: 'Rare',      color: '#cc88ff' },
  legendary: { cost: 18, label: 'Legendary', color: '#ff8844' },
};
function oracleCost(o) { return ORACLE_TIERS[o.tier || 'common'].cost; }

// ─── Oracle definitions ───────────────────────────────────────────────
const ALL_ORACLES = [
  // ─── Common ─────────────────────────────────────────────────────────
  { id:'lucky_star',     name:'Lucky Star',       tier:'common', icon:'★',  color:'#c89960',
    effect:'Three of a Kind → +3 Mult',
    flavor:'"Three in a row? Means nothing."',
    apply(combo,dice,b,m) { return combo.id==='three_kind'?[b,m+3]:[b,m]; } },
  { id:'prophet',        name:'The Prophet',      tier:'common', icon:'🔮', color:'#b088ff',
    effect:'Each 6 rolled → +4 Points',
    flavor:'"Sixes don\'t owe you anything."',
    apply(combo,dice,b,m) { return [b + dice.filter(d=>d===6).length*4, m]; } },
  { id:'crystal_ball',   name:'Crystal Ball',     tier:'common', icon:'🔮', color:'#88ffdd',
    effect:'+2 Points per die rerolled',
    flavor:'"It can\'t see the future. Neither can you."',
    rerollBonus: 2 },
  { id:'blind_chance',   name:'Blind Chance',     tier:'common', icon:'🎲', color:'#ffcc00',
    effect:'+Mult = random 1-6 each hand',
    flavor:'"Random is the whole point."',
    apply(combo,dice,b,m) { return [b, m + 1 + Math.floor(Math.random()*6)]; } },
  { id:'silver_tongue',  name:'Silver Tongue',    tier:'common', icon:'💬', color:'#c0c8ff',
    effect:'Chance → +4 Mult',
    flavor:'"Even a bad hand has something to say."',
    apply(combo,dice,b,m) { return combo.id==='chance'?[b,m+4]:[b,m]; } },
  { id:'gold_rush',      name:'Gold Rush',        tier:'common', icon:'💰', color:'#c89960',
    effect:'Two or more 5s → +8 Points each',
    flavor:'"Five is just a number."',
    apply(combo,dice,b,m) { const n=dice.filter(d=>d===5).length; return n>=2?[b+n*8,m]:[b,m]; } },
  { id:'kindled_wick',   name:'Kindled Wick',     tier:'common', icon:'🕯', color:'#e8a05a',
    effect:'Each 2 rolled → +3 Points',
    flavor:'"It only lights what you already brought."',
    apply(combo,dice,b,m) { return [b + dice.filter(d=>d===2).length*3, m]; } },
  { id:'knotted_thread', name:'Knotted Thread',   tier:'common', icon:'⟁',  color:'#9a9a68',
    effect:'+1 Mult per locked die held to score',
    flavor:'"What you hold becomes what you believe."',
    apply(combo,dice,b,m,meta) { return [b, m + (meta.lockedHeld||0)]; } },

  // ─── Uncommon ───────────────────────────────────────────────────────
  { id:'fools_fortune',  name:"Fortune's Fool",   tier:'uncommon', icon:'🃏', color:'#ff9944',
    effect:'Two Pair → Points ×2',
    flavor:'"Coincidence. Pure coincidence."',
    apply(combo,dice,b,m) { return combo.id==='two_pair'?[b*2,m]:[b,m]; } },
  { id:'chaos_theory',   name:'Chaos Theory',     tier:'uncommon', icon:'∞',  color:'#44ddff',
    effect:'Straights → +5 Mult',
    flavor:'"Order from chaos? How fallacious."',
    apply(combo,dice,b,m) { return (combo.id==='sm_straight'||combo.id==='lg_straight')?[b,m+5]:[b,m]; } },
  { id:'the_oracle',     name:'The Oracle',       tier:'uncommon', icon:'👁',  color:'#cc88ff',
    effect:'Full House → Mult ×2',
    flavor:'"The dice don\'t read prophecies."',
    apply(combo,dice,b,m) { return combo.id==='full_house'?[b,m*2]:[b,m]; } },
  { id:'gamblers_ghost', name:"Gambler's Ghost",  tier:'uncommon', icon:'👻', color:'#aaddff',
    effect:'Last reroll pair → +15 Points',
    flavor:'"It haunts those who believe."',
    apply(combo,dice,b,m,meta) { return (meta.lastReroll && combo.id==='one_pair')?[b+15,m]:[b,m]; } },
  { id:'blood_moon',     name:'Blood Moon',       tier:'uncommon', icon:'☾',  color:'#b83030',
    effect:'On odd-numbered goals → +4 Mult',
    flavor:'"Counting changes which side of fate you\'re on."',
    apply(combo,dice,b,m,meta) { return (meta.goalIdx % 2 === 0)?[b,m+4]:[b,m]; } },
  { id:'echo_chamber',   name:'Echo Chamber',     tier:'uncommon', icon:'◎',  color:'#a0d8d0',
    effect:'Same combo 2× in a row → ×1.5 Mult',
    flavor:'"You hear yourself and call it prophecy."',
    apply(combo,dice,b,m,meta) { return (meta.streakCount >= 2)?[b, m * 1.5]:[b,m]; } },
  { id:'dowager_pearl',  name:'Dowager Pearl',    tier:'uncommon', icon:'◯',  color:'#d8d0b0',
    effect:'Exactly one 1 → +20 Points',
    flavor:'"Loneliness has value you refused to see."',
    apply(combo,dice,b,m) { return (dice.filter(d=>d===1).length === 1)?[b+20,m]:[b,m]; } },

  // ─── Rare ───────────────────────────────────────────────────────────
  { id:'fates_edge',     name:"Fate's Edge",      tier:'rare', icon:'⚔',  color:'#ff4444',
    effect:'Four of a Kind → +50 Points',
    flavor:'"Fate is just math with attitude."',
    apply(combo,dice,b,m) { return combo.id==='four_kind'?[b+50,m]:[b,m]; } },
  { id:'the_fallacy',    name:'The Fallacy',      tier:'rare', icon:'🌀', color:'#ff88cc',
    effect:'Same combo 3× in a row → Mult ×3',
    flavor:'"You really thought that meant something."' },
  { id:'veiled_dowry',   name:'Veiled Dowry',     tier:'rare', icon:'◇',  color:'#d890e0',
    effect:'Pair of 6s → Mult ×3',
    flavor:'"A gift measured in coincidence."',
    apply(combo,dice,b,m) { return (dice.filter(d=>d===6).length >= 2)?[b, m*3]:[b,m]; } },
  { id:'final_gasp',     name:'Final Gasp',       tier:'rare', icon:'⌛', color:'#e0a878',
    effect:'Last hand of the round → Mult ×2',
    flavor:'"Desperation counts louder than calm."',
    apply(combo,dice,b,m,meta) { return (meta.handsLeft === 1)?[b, m*2]:[b,m]; } },
  { id:'entropy_stone',  name:'Entropy Stone',    tier:'rare', icon:'◈',  color:'#a080c0',
    effect:'Each unique face in hand → ×1.25 Mult',
    flavor:'"Disorder has its own geometry."',
    apply(combo,dice,b,m) { const uniq = new Set(dice).size; return [b, m * Math.pow(1.25, uniq)]; } },
  { id:'cascade_sigil',  name:'Cascade Sigil',    tier:'rare', icon:'❂',  color:'#88d8d8',
    effect:'Each scoring die → +1 Mult',
    flavor:'"One drop and the rest follows."',
    apply(combo,dice,b,m) { return [b, m + dice.length]; } },

  // ─── Legendary (collision-based + heavy effects) ────────────────────
  { id:'newtons_gambit', name:"Newton's Gambit",  tier:'legendary', icon:'💥', color:'#ff6644',
    effect:'Each collision this hand ×1.3 Mult (compounds)',
    flavor:'"For every impact, a multiplied reaction."' },
  { id:'kinetic_fusion', name:'Kinetic Fusion',   tier:'legendary', icon:'⚡', color:'#ff4488',
    effect:'Colliding dice add their face sum as Points',
    flavor:'"Energy cannot be destroyed — only scored."' },
  { id:'resonance_field',name:'Resonance Field',  tier:'legendary', icon:'◈',  color:'#44ffcc',
    effect:'Matching-face collision: ×2 Mult each',
    flavor:'"Harmony resonates. Multipliers compound."' },
  { id:'marionette',     name:'The Marionette',   tier:'legendary', icon:'𓂀',  color:'#e0c050',
    effect:'Three of a Kind → Points × face value',
    flavor:'"Every string pulled, still you dance the same."',
    apply(combo,dice,b,m) {
      if (combo.id !== 'three_kind' && combo.id !== 'four_kind' && combo.id !== 'five_kind') return [b,m];
      const counts={}; dice.forEach(v=>counts[v]=(counts[v]||0)+1);
      const trip = Object.keys(counts).find(k=>counts[k]>=3);
      return trip ? [b * +trip, m] : [b,m];
    } },
];

// ─── Dice upgrade definitions ─────────────────────────────────────────
const DICE_UPGRADES = [
  { id:'glass',    name:'Glass Die',    shortName:'GLASS',    icon:'◆', color:'#b8924a', cost:6,
    desc:'This die scores ×1.5 points', scoreMultiplier:1.5 },
  { id:'iron',     name:'Iron Die',     shortName:'IRON',     icon:'⬡', color:'#aab8cc', cost:8,
    desc:'Minimum score value is 4' },
  { id:'lucky',    name:'Lucky Die',    shortName:'LUCKY',    icon:'★', color:'#ffe066', cost:5,
    desc:"1s count as 3 when scoring" },
  { id:'cursed',   name:'Cursed Die',   shortName:'CURSED',   icon:'☠', color:'#cc44ff', cost:3,
    desc:'Score ×2, −1 Mult', scoreMultiplier:2, multPenalty:1 },
  { id:'volatile', name:'Volatile Die', shortName:'VOLATILE', icon:'⚠', color:'#ff6622', cost:10,
    desc:'Scores a d12 instead of face' },
  { id:'ember',    name:'Ember Die',    shortName:'EMBER',    icon:'🜂', color:'#e86828', cost:7,
    desc:'+2 points per collision this hand' },
  { id:'heavy',    name:'Heavy Die',    shortName:'HEAVY',    icon:'▮', color:'#8a6a4a', cost:9,
    desc:'Scores ×3 — cannot be rerolled', scoreMultiplier:3 },
  { id:'mirror',   name:'Mirror Die',   shortName:'MIRROR',   icon:'◐', color:'#c8d8e8', cost:8,
    desc:'Scores as highest face rolled' },
  { id:'wicked',   name:'Wicked Die',   shortName:'WICKED',   icon:'𖤍', color:'#9a4488', cost:6,
    desc:'+1 Mult per reroll remaining' },
];

// ─── Combo tier colours ───────────────────────────────────────────────
const COMBO_COLORS = ['#776655','#a89070','#b8a874','#bfa060','#c89960','#b35838','#9a3826','#8b1a1a','#f7e8b0'];

// ─── Game state ───────────────────────────────────────────────────────
let screen = 'title';
let runGoal = 0;
let endless = false;
const ENDLESS_BASE = 100000;

let roundScore       = 0;
let displayRoundScore = 0;
let handsLeft        = HANDS_PER_ROUND;
let rerollsLeft      = REROLLS_PER_HAND;
let totalFateScore   = 0;

let dice       = [];
let rolledOnce = false;
let handInProgress = false;

let heldOracles  = [];
let comboStreak  = { id: null, count: 0 };
let lastHandMeta = { lastReroll: false };

let shopChoices = [];
let highScores  = [];

let hoverX = -1, hoverY = -1;
let scoringState    = null; // { chips, mult } — live display during hand scoring
let rollCollisions  = [];  // unique die-pair collisions recorded during current hand

let shards             = 0;
let diceUpgrades       = [];   // null | upgrade object, indexed by dice slot
let hubEarnedShards    = 0;
let forgeTab           = 'dice';
let forgeChoices       = { upgrades: [], oracles: [] };
let forgeSelectedUpgrade = null;

// ─── Hover tooltip state ──────────────────────────────────────────────
let hoverState        = { id: null, since: 0 };
let frameHoverTarget  = null;
const TOOLTIP_DELAY   = 0.5;

function markHover(id, title, body, meta) {
  frameHoverTarget = { id, title, body, meta: meta || {} };
}

// ─── Persistence ─────────────────────────────────────────────────────
function loadScores() {
  try { highScores = JSON.parse(localStorage.getItem(SCORES_KEY)) || []; }
  catch { highScores = []; }
}
function saveScore(name, score, mode) {
  loadScores();
  highScores.push({ name, score, mode, date: Date.now() });
  highScores.sort((a,b) => b.score - a.score);
  highScores = highScores.slice(0, 10);
  localStorage.setItem(SCORES_KEY, JSON.stringify(highScores));
}
function endlessUnlocked() {
  try { return !!localStorage.getItem('fortunefallacy_endless'); } catch { return false; }
}
function unlockEndless() {
  try { localStorage.setItem('fortunefallacy_endless', '1'); } catch {} }

// ─── Run management ───────────────────────────────────────────────────
function initDice() {
  rollCollisions = [];
  const N = Math.max(DICE_COUNT, diceUpgrades.length || DICE_COUNT);
  const perRow = 5;
  const cols   = Math.min(N, perRow);
  const rowW   = cols * DICE_SIZE + (cols - 1) * DICE_GAP;
  const x0     = CP.x + (CP.w - rowW) / 2;
  const rowH   = DICE_SIZE + 8;
  dice = Array.from({ length: N }, (_, i) => {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    return {
      face: 1, locked: false, scoring: false,
      rx: 0, ry: 0, rz: 0,
      vx: 0, vy: 0, vz: 0,
      rolling: false, rollT: 0, rollDur: 0.8,
      settling: false, sfRx: 0, sfRy: 0, sfRz: 0,
      tRx: 0, tRy: 0, tRz: 0,
      bounceY: 0, bounceVY: 0,
      scoringT: 0, landT: 0,
      absX: x0 + c * (DICE_SIZE + DICE_GAP) + DICE_SIZE / 2,
      absY: DICE_Y + r * rowH + DICE_SIZE / 2,
      pvx: 0, pvy: 0,
    };
  });
  rolledOnce = false;
}

function startRun(isEndless = false) {
  endless        = isEndless;
  runGoal        = 0;
  totalFateScore = 0;
  heldOracles    = [];
  comboStreak    = { id:null, count:0 };
  shards         = 0;
  diceUpgrades   = Array(DICE_COUNT).fill(null);
  startRound();
  screen = 'game';
}

function startRound() {
  roundScore        = 0;
  displayRoundScore = 0;
  handsLeft         = HANDS_PER_ROUND;
  rerollsLeft       = REROLLS_PER_HAND;
  handInProgress    = false;
  lastHandMeta      = { lastReroll: false };
  initDice();
}

function currentTarget() {
  if (!endless) return GOAL_TARGETS[runGoal];
  return Math.floor(ENDLESS_BASE * Math.pow(2, runGoal));
}

function goalLabel() {
  return endless ? `Endless ${runGoal + 1}` : `Goal ${runGoal + 1} / ${GOAL_TARGETS.length}`;
}

// ─── Dice rolling ─────────────────────────────────────────────────────
function rollDice() {
  if (handInProgress) return;
  const targets = rolledOnce
    ? dice.filter((d,i) => !d.locked && diceUpgrades[i]?.id !== 'heavy')
    : dice;
  if (targets.length === 0) return;
  SFX.roll();
  screenShake(4);

  targets.forEach((d, i) => {
    d.face    = 1 + Math.floor(Math.random() * 6);
    d.rolling = true;
    d.rollT   = 0;
    d.rollDur = 0.62 + i * 0.055 + Math.random() * 0.12;
    d.settling = false;
    // Wild spin
    d.vx = (Math.random() - 0.5) * 42;
    d.vy = (Math.random() - 0.5) * 42;
    d.vz = (Math.random() - 0.5) * 22;
    // Anticipation bounce — stronger launch
    d.bounceY  = 0;
    d.bounceVY = -(22 + Math.random() * 10);
    // Table bounce velocity
    d.pvx = (Math.random() - 0.5) * 620;
    d.pvy = (Math.random() - 0.5) * 380;
    d.bounceCount = 0;
    // Target rotation
    const [trx, try_, trz] = FACE_ROT[d.face];
    d.tRx = trx; d.tRy = try_; d.tRz = trz;
  });

  const maxDur = Math.max(...targets.map(d => d.rollDur));
  setTimeout(() => {
    targets.forEach((d, i) => {
      setTimeout(() => {
        d.rolling  = false;
        d.settling = false;
        d.pvx = 0; d.pvy = 0;
        d.homeX = d.absX; d.homeY = d.absY;
        const [trx, try_, trz] = FACE_ROT[d.face];
        d.rx = trx; d.ry = try_; d.rz = trz;
        d.landT = 0;
        d.bounceVY = -6;
        burst(d.absX, d.absY + DICE_SIZE * 0.35, '#c89960', 5, 2.2);
        burst(d.absX, d.absY + DICE_SIZE * 0.35, '#ffffff', 3, 3);
        playTone(180 + d.face * 22, 'triangle', 0.08, 0.08);
        screenShake(3);
      }, i * 60);
    });
    rolledOnce = true;
    setTimeout(() => screenShake(8), targets.length * 60);
  }, (maxDur + 0.12) * 1000);
}

// ─── Play hand ────────────────────────────────────────────────────────
function playHand() {
  if (!rolledOnce || handInProgress) return;
  const heldEntries = [];
  for (let i = 0; i < dice.length; i++) {
    if (dice[i].locked) heldEntries.push({ die: dice[i], upg: diceUpgrades[i] });
  }
  if (heldEntries.length === 0) return;
  handInProgress = true;

  const faces = heldEntries.map(e => e.die.face);
  const combo = detectCombo(faces);
  lastHandMeta.lastReroll = (rerollsLeft === 0);
  lastHandMeta.lockedHeld = heldEntries.length;
  lastHandMeta.handsLeft  = handsLeft;
  lastHandMeta.goalIdx    = runGoal;

  if (comboStreak.id === combo.id) comboStreak.count++;
  else comboStreak = { id: combo.id, count: 1 };
  lastHandMeta.streakCount = comboStreak.count;

  // chips starts with the combo's base chip bonus; die faces add on top one at a time
  let chips = combo.chips;
  let mult  = combo.mult;
  scoringState = { chips, mult };

  SFX.playHand();

  setTimeout(() => {
    SFX.combo(combo.tier);
    showComboPop(combo.name, COMBO_COLORS[combo.tier] || '#fff');
    const tier = combo.tier;
    if (tier >= 6) { screenFlash(0.4); screenShake(tier >= 7 ? 10 : 6); }
    const burstN = [4,8,12,16,20,26,34,44,60][tier] || 10;
    const burstSpd = 4 + tier * 0.7;
    burst(W/2, H/2, COMBO_COLORS[tier] || '#c89960', burstN, burstSpd);
    if (tier >= 5) burst(W/2, H/2, '#ffffff', Math.floor(burstN/3), burstSpd * 1.3);

    let dieIdx = 0;

    function scoreNext() {
      if (dieIdx >= heldEntries.length) { applyModifiers(); return; }
      const entry = heldEntries[dieIdx];
      const d   = entry.die;
      const upg = entry.upg;
      dieIdx++;
      d.scoring = true;
      d.scoringT = 0;
      let add   = d.face;
      if (upg) {
        if (upg.id === 'iron')               add = Math.max(add, 4);
        if (upg.id === 'lucky' && add === 1) add = 3;
        if (upg.id === 'volatile')           add = 1 + Math.floor(Math.random() * 12);
        if (upg.id === 'mirror')             add = Math.max(...heldEntries.map(e => e.die.face));
        if (upg.id === 'ember')              add += rollCollisions.length * 2;
        if (upg.scoreMultiplier)             add = Math.round(add * upg.scoreMultiplier);
        if (upg.id === 'wicked') { mult += rerollsLeft; scoringState.mult = mult; scoringState.multPunch = 1; }
        if (upg.multPenalty) { mult = Math.max(1, mult - upg.multPenalty); scoringState.mult = mult; }
      }
      chips += add;
      scoringState.chips = chips;
      scoringState.chipPunch = 1;
      if (upg && upg.multPenalty) scoringState.multPunch = 1;
      const txtSize = 16 + Math.min(24, add * 1.5);
      const txtColor = upg ? upg.color : (add >= 10 ? '#ffffff' : add >= 6 ? '#ffe066' : '#c89960');
      floatText(d.absX, d.absY - 40, `+${add}`, txtColor, txtSize);
      const burstN = 8 + Math.min(20, add * 2);
      burst(d.absX, d.absY, txtColor, burstN, 3.5);
      if (add >= 8) burst(d.absX, d.absY, '#ffffff', Math.floor(burstN/2), 5);
      screenShake(1.2 + Math.min(5, add * 0.4));
      SFX.tick(chips);
      setTimeout(() => { d.scoring = false; setTimeout(scoreNext, 60); }, 150);
    }

    function applyModifiers() {
      // Crystal Ball: +chips per non-locked die
      const cb = heldOracles.find(o => o.id === 'crystal_ball');
      if (cb) {
        const bonus = dice.filter(d => !d.locked).length * (cb.rerollBonus || 0);
        if (bonus > 0) {
          chips += bonus;
          floatText(W/2, H/2 - 60, `+${bonus} Crystal`, '#88ffdd', 14);
        }
      }

      // Legendary collision oracles
      if (rollCollisions.length > 0) {
        const newtons = heldOracles.find(o => o.id === 'newtons_gambit');
        if (newtons) {
          const factor = Math.pow(1.3, rollCollisions.length);
          mult *= factor;
          floatText(W/2, H/2 - 80, `×${factor.toFixed(2)} Newton!`, '#ff6644', 16);
          screenShake(5);
        }
        const kinetic = heldOracles.find(o => o.id === 'kinetic_fusion');
        if (kinetic) {
          const bonus = rollCollisions.reduce((s, c) => s + c.faces[0] + c.faces[1], 0);
          chips += bonus;
          floatText(W/2, H/2 - 100, `+${bonus} Kinetic!`, '#ff4488', 16);
        }
        const resonance = heldOracles.find(o => o.id === 'resonance_field');
        if (resonance) {
          const matching = rollCollisions.filter(c => c.faces[0] === c.faces[1]).length;
          if (matching > 0) {
            const factor = Math.pow(2, matching);
            mult *= factor;
            floatText(W/2, H/2 - 120, `×${factor} Resonance!`, '#44ffcc', 18);
          }
        }
        scoringState.chips = chips;
        scoringState.mult  = mult;
      }

      // The Fallacy streak multiplier
      const fallacyO = heldOracles.find(o => o.id === 'the_fallacy');
      if (fallacyO && comboStreak.count >= 3) {
        mult *= 3;
        floatText(W/2, H/2 - 80, '×3 FALLACY!', '#ff88cc', 22);
        comboStreak.count = 0;
      }

      // All other oracle effects (compound mult via × operations)
      for (const o of heldOracles) {
        if (o.apply) [chips, mult] = o.apply(combo, faces, chips, mult, lastHandMeta);
      }
      scoringState.chips = chips;
      scoringState.mult  = mult;

      const handScore = Math.max(chips, 0) * Math.max(mult, 1);
      const newTotal  = roundScore + handScore;

      SFX.mult();
      floatText(W/2, H/2 + 30, `×${mult} Mult`, '#9a3826', 22);
      burst(W/2, H/2 + 30, '#9a3826', 18, 4);
      screenShake(5);

      setTimeout(() => {
        const scoreSize = 24 + Math.min(28, Math.log10(Math.max(1, handScore)) * 6);
        floatText(W/2, H/2 + 60, `= ${handScore.toLocaleString()}`, '#fff', scoreSize);
        burst(W/2, H/2 + 60, '#c89960', 24, 5);
        burst(W/2, H/2 + 60, '#ffffff', 12, 7);
        screenShake(7 + Math.min(10, Math.log10(Math.max(1, handScore)) * 2));
        screenFlash(Math.min(0.55, 0.2 + Math.log10(Math.max(1, handScore)) * 0.08));
        SFX.bigScore();
        if (handScore >= 10000) { screenFlash(0.75); screenShake(18); }

        animateTicker(roundScore, newTotal, 0.7, v => { displayRoundScore = v; }, () => {
          roundScore = newTotal; displayRoundScore = newTotal;
          handsLeft--; rerollsLeft = REROLLS_PER_HAND;
          rolledOnce = false; handInProgress = false; scoringState = null;
          initDice();

          if (roundScore >= currentTarget()) {
            advanceGoal();
          } else if (handsLeft <= 0) {
            setTimeout(() => {
              SFX.fail();
              const name = playerName || nameEntry.trim() || incoming.username || 'Wanderer';
              saveScore(name, totalFateScore, endless ? 'endless' : 'run');
              loadScores();
              screen = 'scores';
            }, 800);
          }
        });
      }, 500);
    }

    setTimeout(scoreNext, 300);
  }, 100);
}

// ─── Goal advancement ─────────────────────────────────────────────────
function advanceGoal() {
  totalFateScore += roundScore;
  SFX.clear();
  showBanner('✦ GOAL CLEARED ✦', '#c89960');
  screenShake(12);
  screenFlash(0.3);
  burst(W/2, H/2, '#c89960', 50, 7);
  burst(W/2, H/2, '#9a3826', 25, 5);
  burst(W/2, H/2, '#ffffff', 18, 9);

  setTimeout(() => {
    const clearedTarget = currentTarget();
    runGoal++;
    if (!endless && runGoal >= GOAL_TARGETS.length) {
      SFX.win();
      unlockEndless();
      nameEntry       = '';
      nameEntryActive = false;
      screen = 'win';
      return;
    }
    // Award shards for goal clear
    const earned = Math.max(3, Math.floor(5 + (roundScore - clearedTarget) / 200));
    shards += earned;
    hubEarnedShards = earned;
    // Pre-generate free oracle choices for the gift button
    const pool = ALL_ORACLES.filter(o => !heldOracles.find(h => h.id === o.id) && o.tier !== 'legendary');
    shopChoices = pool.sort(() => Math.random()-0.5).slice(0, 3);
    forgeChoices = { upgrades: [], oracles: [] };
    screen = 'hub';
  }, 1800);
}

function pickOracle(idx) {
  const o = shopChoices[idx];
  if (!o) return;
  SFX.oracle();
  heldOracles.push(o);
  shopChoices = [];
  burst(W/2, H/2, o.color, 20, 5);
  screen = 'hub';
}

function skipShop() { shopChoices = []; screen = 'hub'; }

function openForge() {
  if (forgeChoices.upgrades.length === 0) {
    forgeChoices.upgrades = [...DICE_UPGRADES].sort(() => Math.random()-0.5).slice(0, 3);
  }
  if (forgeChoices.oracles.length === 0) {
    // Weighted oracle pool: legendaries scarce, rares uncommon; ensure variety by tier
    const unowned = ALL_ORACLES.filter(o => !heldOracles.find(h => h.id === o.id));
    const weights = { common: 3, uncommon: 2, rare: 1.3, legendary: 0.5 };
    const weightedPool = [];
    unowned.forEach(o => {
      const n = Math.round((weights[o.tier || 'common']) * 2);
      for (let i = 0; i < n; i++) weightedPool.push(o);
    });
    const picked = [];
    while (picked.length < 3 && weightedPool.length > 0) {
      const i = Math.floor(Math.random() * weightedPool.length);
      const o = weightedPool[i];
      if (!picked.find(p => p.id === o.id)) picked.push(o);
      weightedPool.splice(i, 1);
    }
    forgeChoices.oracles = picked;
  }
  forgeTab = 'dice';
  forgeSelectedUpgrade = null;
  screen = 'forge';
}

// ─── Portal state ─────────────────────────────────────────────────────
let exitPortalPulse   = 0;
let returnPortalPulse = 0;
let portalRedirecting = false;

function triggerExitPortal() {
  if (portalRedirecting) return;
  portalRedirecting = true;
  SFX.portal();
  burst(W - 44, H/2, '#9a3826', 24, 5);
  setTimeout(() => Portal.sendPlayerThroughPortal(
    nextTarget?.url ?? 'https://callumhyoung.github.io/gamejam/',
    { username: incoming.username, color: incoming.color, speed: incoming.speed }
  ), 900);
}

function triggerReturnPortal() {
  if (portalRedirecting || !incoming.ref) return;
  portalRedirecting = true;
  SFX.portal();
  burst(44, H/2, '#b8a874', 24, 5);
  setTimeout(() => Portal.sendPlayerThroughPortal(incoming.ref,
    { username: incoming.username, color: incoming.color, speed: incoming.speed }
  ), 900);
}

// ─── Name entry ───────────────────────────────────────────────────────
let nameEntry       = '';
let nameEntryActive = false;
let playerName      = '';
let pendingEndless  = false;

function submitScore() {
  const name = playerName || nameEntry.trim() || incoming.username || 'Wanderer';
  saveScore(name, totalFateScore, endless ? 'endless' : 'run');
  nameEntryActive = false;
  nameEntry = '';
  loadScores();
  screen = 'scores';
}

// ─── Layout constants ─────────────────────────────────────────────────
const LP = { x:8,   w:196, y:8, h:H-16 };
const CP = { x:212, w:536, y:8, h:H-16 };
const RP = { x:756, w:196, y:8, h:H-16 };

const DICE_SIZE  = 44;
const DICE_GAP   = 10;
const DICE_Y     = CP.y + 95;
const DICE_ROW_W = DICE_COUNT * DICE_SIZE + (DICE_COUNT-1) * DICE_GAP;
const DICE_X0    = CP.x + (CP.w - DICE_ROW_W)/2;
const BOARD_Y    = DICE_Y - 33;
const BOARD_H    = 220;

function diceRect(i) { return { x: DICE_X0 + i*(DICE_SIZE+DICE_GAP), y: DICE_Y, w: DICE_SIZE, h: DICE_SIZE }; }

const BTN_ROLL = { x: CP.x + 60,  y: BOARD_Y + BOARD_H + 14, w: 180, h: 46 };
const BTN_PLAY = { x: CP.x + 296, y: BOARD_Y + BOARD_H + 14, w: 180, h: 46 };

// Holding tray — locked dice glide here, below the action buttons
const HOLD_Y      = BTN_ROLL.y + BTN_ROLL.h + 22;
const HOLD_H      = 68;
const HOLD_SLOT_W = 50;
const HOLD_GAP    = 12;
const HOLD_TOTAL  = MAX_HELD * (HOLD_SLOT_W + HOLD_GAP) - HOLD_GAP;
const HOLD_X0     = CP.x + (CP.w - HOLD_TOTAL) / 2;
function holdSlotCenter(i) {
  return {
    x: HOLD_X0 + i * (HOLD_SLOT_W + HOLD_GAP) + HOLD_SLOT_W / 2,
    y: HOLD_Y + HOLD_H / 2,
  };
}
function heldCount() { let n = 0; for (const d of dice) if (d.locked) n++; return n; }

function inRect(mx, my, r) { return mx>=r.x && mx<=r.x+r.w && my>=r.y && my<=r.y+r.h; }

// ─── Input ────────────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  hoverX = (e.clientX - rect.left) * (W / rect.width);
  hoverY = (e.clientY - rect.top)  * (H / rect.height);
});

canvas.addEventListener('click', e => {
  getAudio();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const my = (e.clientY - rect.top)  * (H / rect.height);
  handleClick(mx, my);
});

document.addEventListener('keydown', e => {
  if (screen === 'name_entry') {
    if (e.key === 'Backspace') nameEntry = nameEntry.slice(0, -1);
    else if (e.key === 'Enter') {
      playerName = nameEntry.trim() || incoming.username || 'Wanderer';
      nameEntry = '';
      startRun(pendingEndless);
    }
    else if (e.key === 'Escape') { screen = 'title'; nameEntry = ''; }
    else if (e.key.length === 1 && nameEntry.length < 16) nameEntry += e.key;
    return;
  }
  if (nameEntryActive) {
    if (e.key === 'Backspace') nameEntry = nameEntry.slice(0, -1);
    else if (e.key === 'Enter') submitScore();
    else if (e.key.length === 1 && nameEntry.length < 16) nameEntry += e.key;
    return;
  }
  if (screen === 'title') { pendingEndless = false; nameEntry = ''; screen = 'name_entry'; }
});

function handleClick(mx, my) {
  if (screen === 'title') {
    const tfy = (H - 360) / 2;
    if (inRect(mx,my,{x:W/2-130,y:tfy+200,w:260,h:48})) { pendingEndless=false; nameEntry=''; screen='name_entry'; return; }
    if (endlessUnlocked() && inRect(mx,my,{x:W/2-130,y:tfy+256,w:260,h:42})) { pendingEndless=true; nameEntry=''; screen='name_entry'; return; }
    if (inRect(mx,my,{x:W/2-110,y:tfy+304,w:220,h:36})) { loadScores(); screen='scores'; return; }
    return;
  }
  if (screen === 'name_entry') {
    if (inRect(mx,my,{x:W/2-130,y:H/2+40,w:260,h:48})) {
      playerName = nameEntry.trim() || incoming.username || 'Wanderer';
      nameEntry = '';
      startRun(pendingEndless);
      return;
    }
    if (inRect(mx,my,{x:W/2-80,y:H/2+100,w:160,h:36})) { screen='title'; nameEntry=''; return; }
    return;
  }
  if (screen === 'scores') {
    if (inRect(mx,my,{x:W/2-100,y:H-68,w:200,h:40})) screen='title';
    return;
  }
  if (screen === 'win') {
    // portal clicks
    if (inRect(mx,my,{x:W-94,y:H/2-40,w:68,h:80})) { triggerExitPortal(); return; }
    if (incoming.ref && inRect(mx,my,{x:26,y:H/2-40,w:68,h:80})) { triggerReturnPortal(); return; }
    if (inRect(mx,my,{x:W/2-130,y:H/2+86,w:260,h:46})) { submitScore(); return; }
    return;
  }
  if (screen === 'shop') {
    for (let i = 0; i < shopChoices.length; i++) {
      const cx = W/2 - 380 + i*265;
      if (inRect(mx,my,{x:cx,y:H/2-150,w:250,h:310})) { pickOracle(i); return; }
    }
    if (inRect(mx,my,{x:W/2-70,y:H-68,w:140,h:40})) { skipShop(); return; }
    return;
  }
  if (screen === 'hub') {
    const BY = H - 84;
    const canOracle = heldOracles.length < MAX_ORACLES && shopChoices.length > 0;
    if (canOracle && inRect(mx,my,{x:W/2-300,y:BY,w:185,h:50})) { screen='shop'; return; }
    if (inRect(mx,my,{x:W/2-75,y:BY,w:175,h:50})) { openForge(); return; }
    if (inRect(mx,my,{x:W/2+130,y:BY,w:170,h:50})) { startRound(); screen='game'; return; }
    return;
  }
  if (screen === 'forge') {
    if (inRect(mx,my,{x:W/2-170,y:64,w:160,h:34})) { forgeTab='dice'; return; }
    if (inRect(mx,my,{x:W/2+10, y:64,w:160,h:34})) { forgeTab='oracles'; return; }
    if (inRect(mx,my,{x:W/2-90,y:H-54,w:180,h:40})) { screen='hub'; return; }
    if (forgeTab === 'dice') {
      const upgW=188,upgH=138,upgGap=14;
      const upgTotal=forgeChoices.upgrades.length*(upgW+upgGap)-upgGap;
      const upgX0=W/2-upgTotal/2;
      const poolFull = diceUpgrades.length >= MAX_DICE;
      for (let i=0;i<forgeChoices.upgrades.length;i++) {
        const ux=upgX0+i*(upgW+upgGap);
        if (inRect(mx,my,{x:ux,y:134,w:upgW,h:upgH})) {
          const upg=forgeChoices.upgrades[i];
          if (shards>=upg.cost && !poolFull) {
            shards -= upg.cost;
            diceUpgrades.push({ ...upg });
            forgeChoices.upgrades.splice(i, 1);
            SFX.oracle(); burst(mx,my,upg.color,14,4.5);
            floatText(mx, my-18, `+${upg.shortName} die`, upg.color, 13);
          }
          return;
        }
      }
      // Reroll upgrade offerings
      if (inRect(mx,my,{x:W/2+90,y:H-54,w:140,h:40}) && shards>=3) {
        shards -= 3;
        forgeChoices.upgrades = [...DICE_UPGRADES].sort(() => Math.random()-0.5).slice(0, 3);
        SFX.roll(); burst(W/2+160,H-34,'#c89960',10,4); return;
      }
    }
    if (forgeTab === 'oracles') {
      const cW=220,cH=260,cGap=22;
      const cTotal=forgeChoices.oracles.length*(cW+cGap)-cGap;
      const cX0=W/2-cTotal/2;
      for (let i=0;i<forgeChoices.oracles.length;i++) {
        const ox=cX0+i*(cW+cGap);
        const cost=oracleCost(forgeChoices.oracles[i]);
        if (inRect(mx,my,{x:ox+20,y:136+cH+6,w:cW-40,h:32})) {
          if (shards>=cost && heldOracles.length<MAX_ORACLES) {
            shards-=cost;
            const o=forgeChoices.oracles.splice(i,1)[0];
            heldOracles.push(o); SFX.oracle(); burst(W/2,H/2,o.color,15,5);
          }
          return;
        }
      }
      // Reroll oracle offerings
      if (inRect(mx,my,{x:W/2+90,y:H-54,w:140,h:40}) && shards>=3) {
        shards -= 3;
        const unowned = ALL_ORACLES.filter(o => !heldOracles.find(h => h.id === o.id));
        forgeChoices.oracles = unowned.sort(() => Math.random()-0.5).slice(0, 3);
        SFX.roll(); burst(W/2+160,H-34,'#c89960',10,4); return;
      }
    }
    return;
  }
  if (screen === 'game') {
    if (rolledOnce && !handInProgress) {
      for (let i = 0; i < dice.length; i++) {
        const hs = DICE_SIZE / 2;
        if (inRect(mx,my,{x:dice[i].absX-hs, y:dice[i].absY-hs, w:DICE_SIZE, h:DICE_SIZE})) {
          if (!dice[i].locked && heldCount() >= MAX_HELD) {
            floatText(dice[i].absX, dice[i].absY - 30, `Held full (${MAX_HELD})`, '#ff8844', 12);
            return;
          }
          dice[i].locked = !dice[i].locked;
          SFX[dice[i].locked ? 'lock' : 'unlock']();
          return;
        }
      }
    }
    if (inRect(mx,my,BTN_ROLL) && !handInProgress) {
      if (!rolledOnce) { rollDice(); return; }
      if (rerollsLeft > 0) { rerollsLeft--; rollDice(); return; }
    }
    if (inRect(mx,my,BTN_PLAY) && rolledOnce && !handInProgress && heldCount() > 0) { playHand(); return; }
    // Exit portal (endless only — in main run it shows on win screen)
    if (endless && inRect(mx,my,{x:RP.x+RP.w/2-30,y:RP.y+RP.h-74,w:60,h:60})) { triggerExitPortal(); return; }
    if (incoming.ref && inRect(mx,my,{x:LP.x+LP.w/2-30,y:LP.y+LP.h-74,w:60,h:60})) { triggerReturnPortal(); return; }
  }
}

// ─── Pip layouts (face-space, u/v in [0,1]) ───────────────────────────
const PIP_LAYOUTS = {
  1: [[0.5,0.5]],
  2: [[0.28,0.28],[0.72,0.72]],
  3: [[0.28,0.28],[0.5,0.5],[0.72,0.72]],
  4: [[0.28,0.28],[0.72,0.28],[0.28,0.72],[0.72,0.72]],
  5: [[0.28,0.28],[0.72,0.28],[0.5,0.5],[0.28,0.72],[0.72,0.72]],
  6: [[0.28,0.22],[0.72,0.22],[0.28,0.5],[0.72,0.5],[0.28,0.78],[0.72,0.78]],
};

// ─── 3D Die drawing ───────────────────────────────────────────────────
function drawDie3D(die, cx, cy, size) {
  // Scale-pulse when scoring (Balatro-style pop)
  let scalePulse = 1;
  if (die.scoring) {
    const t = die.scoringT || 0;
    if (t < 0.08)      scalePulse = 1 + 0.28 * (t / 0.08);
    else if (t < 0.18) scalePulse = 1.28 - 0.18 * ((t - 0.08) / 0.10);
    else               scalePulse = 1.10 - 0.10 * Math.min(1, (t - 0.18) / 0.10);
  }
  if (scalePulse !== 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scalePulse, scalePulse);
    ctx.translate(-cx, -cy);
  }
  const hs  = size * 0.48;
  const isHov = inRect(hoverX, hoverY, { x:cx-hs, y:cy-hs, w:size, h:size }) && rolledOnce && !handInProgress;
  const by = die.bounceY || 0;

  const rendered = [];
  for (const cf of CUBE_FACES) {
    const [nx, ny, nz] = rotate3(...cf.normal, die.rx, die.ry, die.rz);
    if (nz <= 0) continue; // back-face cull

    // 4 quad corners in object space
    const quads = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([su,sv]) => {
      const ox = cf.normal[0] + cf.u[0]*su + cf.v[0]*sv;
      const oy = cf.normal[1] + cf.u[1]*su + cf.v[1]*sv;
      const oz = cf.normal[2] + cf.u[2]*su + cf.v[2]*sv;
      const [wx,wy,wz] = rotate3(ox, oy, oz, die.rx, die.ry, die.rz);
      const p = 1 + wz * 0.18; // weak perspective
      return [cx + wx*hs*p, cy + by + wy*hs*p];
    });

    // Pip world positions
    const pips = (PIP_LAYOUTS[cf.n] || []).map(([pu,pv]) => {
      const ux = (pu-0.5)*1.4, vv = (pv-0.5)*1.4;
      const ox = cf.normal[0] + cf.u[0]*ux + cf.v[0]*vv;
      const oy = cf.normal[1] + cf.u[1]*ux + cf.v[1]*vv;
      const oz = cf.normal[2] + cf.u[2]*ux + cf.v[2]*vv;
      const [wx,wy,wz] = rotate3(ox, oy, oz, die.rx, die.ry, die.rz);
      const p = 1 + wz * 0.18;
      return [cx + wx*hs*p, cy + by + wy*hs*p];
    });

    rendered.push({ quads, pips, nz, faceN: cf.n });
  }
  rendered.sort((a,b) => a.nz - b.nz); // painter: draw furthest first

  ctx.save();
  for (const fd of rendered) {
    const br    = 0.45 + 0.55 * fd.nz;
    const isTop = fd.nz > 0.8;
    const q     = fd.quads;

    // Quad bounding points for gradient direction (top edge → bottom edge)
    const topMx = (q[0][0] + q[1][0]) / 2, topMy = (q[0][1] + q[1][1]) / 2;
    const botMx = (q[2][0] + q[3][0]) / 2, botMy = (q[2][1] + q[3][1]) / 2;

    // Face path
    ctx.beginPath();
    ctx.moveTo(q[0][0], q[0][1]);
    for (let k = 1; k < q.length; k++) ctx.lineTo(q[k][0], q[k][1]);
    ctx.closePath();

    // Face gradient — lighter at top, darker at bottom for 3D lit feel
    const grad = ctx.createLinearGradient(topMx, topMy, botMx, botMy);
    if (die.locked) {
      grad.addColorStop(0, `rgb(${(br*255)|0},${(br*232)|0},${(br*120)|0})`);
      grad.addColorStop(1, `rgb(${(br*205)|0},${(br*155)|0},${(br*45)|0})`);
    } else {
      grad.addColorStop(0, `rgb(${(br*252)|0},${(br*248)|0},${(br*236)|0})`);
      grad.addColorStop(1, `rgb(${(br*205)|0},${(br*198)|0},${(br*180)|0})`);
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // Outer edge — dark border (base)
    ctx.lineWidth   = 2.2;
    ctx.strokeStyle = die.locked
      ? `rgba(100,60,0,${0.6+0.3*br})`
      : `rgba(22,10,40,${0.55+0.35*br})`;
    ctx.stroke();

    // Inset bevel — draw a slightly shrunken quad with a bright inner stroke
    // to mimic a chamfered edge under top-left light.
    const fcx = (q[0][0]+q[1][0]+q[2][0]+q[3][0]) / 4;
    const fcy = (q[0][1]+q[1][1]+q[2][1]+q[3][1]) / 4;
    const bevel = 0.88;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(fcx + (q[0][0]-fcx)*bevel, fcy + (q[0][1]-fcy)*bevel);
    for (let k = 1; k < q.length; k++) {
      ctx.lineTo(fcx + (q[k][0]-fcx)*bevel, fcy + (q[k][1]-fcy)*bevel);
    }
    ctx.closePath();
    ctx.lineWidth   = 1;
    ctx.strokeStyle = die.locked
      ? `rgba(255,240,180,${0.28 + 0.35*br})`
      : `rgba(255,255,255,${0.22 + 0.35*br})`;
    ctx.stroke();
    ctx.restore();

    // Hover/locked glow stroke on top face only
    if ((die.locked || isHov) && isTop) {
      ctx.save();
      ctx.lineWidth   = 2.2;
      ctx.strokeStyle = die.locked ? `rgba(200,153,96,${0.5+0.4*br})` : `rgba(154,56,38,${0.5+0.4*br})`;
      ctx.shadowColor = die.locked ? '#c89960' : '#9a3826';
      ctx.shadowBlur  = die.locked ? 14 : 9;
      ctx.stroke();
      ctx.restore();
    }

    // Pips — radial gradient body + tiny specular highlight on top face
    const isOne = fd.faceN === 1;
    const pipR  = hs * 0.135;
    let pipCore, pipEdge;
    if (die.locked)      { pipCore = `rgba(50,25,0,${br})`;   pipEdge = `rgba(100,60,5,${br})`; }
    else if (isOne)      { pipCore = `rgba(150,8,8,${br})`;   pipEdge = `rgba(210,50,50,${br})`; }
    else                 { pipCore = `rgba(10,4,28,${br})`;   pipEdge = `rgba(40,22,70,${br})`; }

    for (const [px,py] of fd.pips) {
      // Soft pip shadow ring (gives recessed look)
      if (isTop) {
        ctx.save();
        ctx.shadowColor = die.locked ? 'rgba(80,40,0,0.5)'
          : isOne ? 'rgba(200,20,20,0.45)' : 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 1;
      }
      const pg = ctx.createRadialGradient(px - pipR*0.3, py - pipR*0.3, 0, px, py, pipR);
      pg.addColorStop(0, pipEdge);
      pg.addColorStop(1, pipCore);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, pipR, 0, Math.PI*2);
      ctx.fill();
      if (isTop) ctx.restore();

      // Specular spot on top face pips
      if (isTop) {
        ctx.fillStyle = isOne ? 'rgba(255,180,180,0.55)' : 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(px - pipR*0.35, py - pipR*0.35, pipR*0.32, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // Scoring flash — bright ring + expanding shockwave when this die is being counted
  if (die.scoring) {
    const t = die.scoringT || 0;
    ctx.save();
    ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(255,228,60,0.95)'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy + by, hs * 1.20, hs * 1.13, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Expanding shockwave ring
    const ringT = Math.min(1, t / 0.35);
    if (ringT < 1) {
      ctx.globalAlpha = (1 - ringT) * 0.85;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 3 * (1 - ringT) + 1;
      ctx.strokeStyle = '#ffffff';
      const rr = hs * (1.2 + ringT * 1.8);
      ctx.beginPath();
      ctx.ellipse(cx, cy + by, rr, rr * 0.94, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Land impulse ring — quick pulse when a die just finished rolling
  if (die.landT !== undefined && die.landT < 0.28 && !die.rolling) {
    const lt = die.landT / 0.28;
    ctx.save();
    ctx.globalAlpha = (1 - lt) * 0.7;
    ctx.strokeStyle = '#9a3826';
    ctx.lineWidth = 2.5 * (1 - lt) + 0.5;
    ctx.shadowColor = '#9a3826'; ctx.shadowBlur = 4;
    const rr = hs * (0.95 + lt * 1.2);
    ctx.beginPath();
    ctx.ellipse(cx, cy + by, rr, rr * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Glow halo for locked / hovered
  if (die.locked || isHov) {
    ctx.shadowColor = die.locked ? '#c89960' : '#9a3826';
    ctx.shadowBlur  = die.locked ? 24 : 14;
    ctx.strokeStyle = die.locked ? 'rgba(200,153,96,0.75)' : 'rgba(154,56,38,0.65)';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy + by, hs * 1.13, hs * 1.06, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Drop shadow on board — soft radial falloff
  {
    const lift = Math.max(0, -by); // rises with bounce height
    const sr   = hs * (0.92 - Math.min(0.25, lift * 0.04));
    const sh   = hs * (0.26 + Math.min(0.1, lift * 0.015));
    const sg   = ctx.createRadialGradient(cx + 3, cy + hs * 1.05, 2, cx + 3, cy + hs * 1.05, sr);
    sg.addColorStop(0, `rgba(0,0,0,${0.45 - Math.min(0.18, lift * 0.03)})`);
    sg.addColorStop(0.6, 'rgba(0,0,0,0.18)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy + hs * 1.05, sr, sh, 0, 0, Math.PI*2);
    ctx.fill();
  }

  if (die.locked) {
    ctx.fillStyle   = 'rgba(80,40,0,0.95)';
    ctx.shadowColor = '#c89960'; ctx.shadowBlur = 2;
    ctx.font        = 'bold 8px ui-sans-serif,sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText('HELD', cx, cy + by + hs + 14);
    ctx.shadowBlur  = 0;
  }
  ctx.restore();
  if (scalePulse !== 1) ctx.restore();
}

// ─── Board surface ────────────────────────────────────────────────────
function drawBoard(cx, topY, width, height) {
  // Perspective felt table under the dice
  const bx = cx - width/2, bw = width, bh = height;
  ctx.save();
  // Candlelit stone altar — warm amber core fading to near-black edges
  const gr = ctx.createRadialGradient(cx, topY + bh*0.4, 10, cx, topY + bh*0.4, bw*0.55);
  gr.addColorStop(0,   'rgba(60,28,10,0.92)');
  gr.addColorStop(0.6, 'rgba(28,12,4,0.94)');
  gr.addColorStop(1,   'rgba(8,3,1,0.95)');
  roundRect(bx, topY, bw, bh, 14);
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.strokeStyle = 'rgba(154,56,38,0.4)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Subtle ember inner glow border
  ctx.shadowColor = 'rgba(200,153,96,0.2)';
  ctx.shadowBlur  = 6;
  ctx.strokeStyle = 'rgba(200,120,60,0.22)';
  ctx.lineWidth   = 1;
  roundRect(bx+4, topY+4, bw-8, bh-8, 11);
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // Rune-lines radiating to center (perspective vanishing)
  ctx.strokeStyle = 'rgba(200,130,70,0.14)';
  ctx.lineWidth   = 1;
  const lines = 7;
  for (let i = 0; i <= lines; i++) {
    const f  = i / lines;
    const xp = bx + bw * f;
    // Converge slightly toward horizontal center line
    const yTop = topY + 4;
    const yBot = topY + bh - 4;
    ctx.beginPath();
    ctx.moveTo(xp, yTop);
    ctx.lineTo(cx + (xp-cx)*0.6, topY + bh*0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xp, yBot);
    ctx.lineTo(cx + (xp-cx)*0.6, topY + bh*0.5);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Button drawing ───────────────────────────────────────────────────
function drawBtn(r, label, enabled, hot = false) {
  const hover = inRect(hoverX, hoverY, r) && enabled;
  const bg    = !enabled ? '#140a05' : hot && hover ? '#4a1a0e' : hot ? '#3a1408' : hover ? '#22120a' : '#180c06';
  const bdr   = !enabled ? '#2a1810' : hot ? '#b35838' : hover ? '#b8924a' : '#6a4a28';
  ctx.save();
  // Subtle base fill with gradient
  const grd = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  grd.addColorStop(0, bg);
  grd.addColorStop(1, 'rgba(0,0,0,0.4)');
  drawRoundRect(r.x, r.y, r.w, r.h, 8, grd, bdr, 1.6);
  // Inner hairline for chrome feel
  ctx.strokeStyle = enabled ? 'rgba(200,153,96,0.28)' : 'rgba(120,90,60,0.15)';
  ctx.lineWidth = 1;
  roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 6);
  ctx.stroke();
  // Corner sigils
  if (enabled) {
    ctx.fillStyle = hot ? '#d4a050' : '#9a7848';
    ctx.font = '10px serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦', r.x + 12, r.y + r.h/2 + 4);
    ctx.fillText('✦', r.x + r.w - 12, r.y + r.h/2 + 4);
  }
  ctx.fillStyle = enabled ? (hot ? '#f7e0b0' : '#e8d4a8') : '#5a4830';
  ctx.font      = `bold 15px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w/2, r.y + r.h/2 + 5);
  ctx.restore();
}

// ─── Oracle card drawing ──────────────────────────────────────────────
function drawTooltip(info, mx, my) {
  const { title, body, meta } = info;
  const color = meta.color || '#c89960';
  const pad = 9, lineH = 14, maxW = 240;
  ctx.save();
  // Wrap body
  ctx.font = '11px ui-sans-serif,sans-serif';
  const paragraphs = (body || '').split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let cur = '';
    for (const w of words) {
      const cand = cur ? cur + ' ' + w : w;
      if (ctx.measureText(cand).width > maxW - pad*2) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = cand;
    }
    if (cur) lines.push(cur);
  }
  ctx.font = 'bold 12px ui-sans-serif,sans-serif';
  const titleW = ctx.measureText(title).width;
  ctx.font = '11px ui-sans-serif,sans-serif';
  let bodyMaxW = 0;
  for (const l of lines) bodyMaxW = Math.max(bodyMaxW, ctx.measureText(l).width);
  let costH = 0;
  if (meta.cost != null) { costH = 18; }
  const tooltipW = Math.min(maxW, Math.max(titleW, bodyMaxW) + pad*2);
  const tooltipH = 22 + lines.length * lineH + costH;
  // Position — offset from mouse, clamp to canvas
  let tx = mx + 14, ty = my + 14;
  if (tx + tooltipW > W - 4)  tx = mx - tooltipW - 14;
  if (ty + tooltipH > H - 4)  ty = my - tooltipH - 14;
  if (tx < 4) tx = 4;
  if (ty < 4) ty = 4;
  drawRoundRect(tx, ty, tooltipW, tooltipH, 6, 'rgba(10, 4, 2, 0.96)', color, 1.5);
  ctx.fillStyle = color;
  ctx.font = 'bold 12px ui-sans-serif,sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, tx + pad, ty + 16);
  ctx.fillStyle = '#e0d3b8';
  ctx.font = '11px ui-sans-serif,sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, tx + pad, ty + 32 + i * lineH));
  if (meta.cost != null) {
    ctx.fillStyle = '#b8a874';
    ctx.font = 'bold 10px ui-sans-serif,sans-serif';
    ctx.fillText(`◆ ${meta.cost} Shards`, tx + pad, ty + tooltipH - 7);
  }
  ctx.restore();
}

function processTooltips(t) {
  if (frameHoverTarget) {
    if (hoverState.id !== frameHoverTarget.id) {
      hoverState = { id: frameHoverTarget.id, since: t };
    } else if (t - hoverState.since >= TOOLTIP_DELAY) {
      drawTooltip(frameHoverTarget, hoverX, hoverY);
    }
  } else {
    hoverState.id = null;
  }
  frameHoverTarget = null;
}

function oracleTooltipBody(o) {
  const tier = ORACLE_TIERS[o.tier || 'common'];
  return `${tier.label}\n\n${o.effect}\n\n${o.flavor || ''}`.trim();
}

function upgradeTooltipBody(u) {
  const parts = [u.desc];
  if (u.scoreMultiplier) parts.push(`Score multiplier: ×${u.scoreMultiplier}`);
  if (u.multPenalty)     parts.push(`Mult penalty: −${u.multPenalty}`);
  return parts.join('\n\n');
}

function drawOracleCard(oracle, x, y, w, h, owned = false) {
  const inHover = inRect(hoverX, hoverY, {x,y,w,h});
  const hover = !owned && inHover;
  if (inHover) {
    const meta = { color: oracle.color };
    if (!owned) meta.cost = oracleCost(oracle);
    markHover(`oracle:${oracle.id}:${owned?'own':'buy'}:${Math.round(x)}:${Math.round(y)}`,
              oracle.name, oracleTooltipBody(oracle), meta);
  }
  ctx.save();
  if (hover) { ctx.shadowColor = oracle.color; ctx.shadowBlur = 8; }
  const bg = owned ? '#130a05' : hover ? '#22100a' : '#180c06';
  drawRoundRect(x, y, w, h, 12, bg, oracle.color, owned ? 1.5 : 2);

  // Legendary badge
  if (oracle.tier === 'legendary' && !owned) {
    ctx.shadowColor = oracle.color; ctx.shadowBlur = hover ? 40 : 20;
    ctx.strokeStyle = oracle.color; ctx.lineWidth = 3;
    roundRect(x, y, w, h, 12); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = oracle.color; ctx.font = 'bold 8px ui-sans-serif,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦ LEGENDARY ✦', x+w/2, y+11);
  } else if (!owned && oracle.tier) {
    // Tier chip badge in top-right corner
    const tier = ORACLE_TIERS[oracle.tier];
    const label = tier.label.toUpperCase();
    ctx.save();
    ctx.font = `bold 8px ${SERIF}`;
    const lw = ctx.measureText(label).width;
    const bx = x + w - lw - 14, by = y + 6, bh = 13;
    ctx.fillStyle = 'rgba(10,4,2,0.75)';
    roundRect(bx, by, lw + 10, bh, 3); ctx.fill();
    ctx.strokeStyle = tier.color; ctx.lineWidth = 1;
    roundRect(bx, by, lw + 10, bh, 3); ctx.stroke();
    ctx.fillStyle = tier.color;
    ctx.textAlign = 'left';
    ctx.fillText(label, bx + 5, by + 9);
    ctx.restore();
  }

  ctx.fillStyle   = oracle.color;
  ctx.shadowColor = oracle.color; ctx.shadowBlur = 3;
  ctx.font        = `${owned ? 18 : 26}px ui-sans-serif,sans-serif`;
  ctx.textAlign   = 'center';
  ctx.fillText(oracle.icon, x+w/2, y+(owned?26:34));

  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#fff';
  ctx.font       = `bold ${owned?10:13}px ui-sans-serif,sans-serif`;
  ctx.fillText(owned ? (oracle.name.length>14?oracle.name.slice(0,13)+'…':oracle.name) : oracle.name, x+w/2, y+(owned?40:58));

  if (!owned) {
    ctx.fillStyle = '#c89960'; ctx.font = '11px ui-sans-serif,sans-serif'; ctx.textAlign = 'center';
    wrapText(x+10, y+76, oracle.effect, w-20, 15);
    ctx.fillStyle = 'rgba(200,180,255,0.55)'; ctx.font = 'italic 10px ui-sans-serif,sans-serif';
    wrapText(x+10, y+126, oracle.flavor, w-20, 14);
  }
  ctx.restore();
}

// ─── Portal ring ──────────────────────────────────────────────────────
function drawPortalRing(x, y, r, color, pulse, label, active) {
  const a = active ? 1 : 0.35;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = color; ctx.shadowBlur = 6 + Math.sin(pulse)*2;
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.globalAlpha = a*0.35;
  ctx.beginPath(); ctx.arc(x, y, r-7+Math.sin(pulse+1)*3, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#fff'; ctx.font = '9px ui-sans-serif,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, x, y+r+13);
  ctx.globalAlpha = 1;
}

// ─── SCREEN: Title ────────────────────────────────────────────────────
function drawNameEntry(t) {
  drawBG(t);

  const fw = 480, fh = 260;
  const fx = (W - fw) / 2, fy = (H - fh) / 2;
  ornamentFrame(fx, fy, fw, fh, '#5a2a18', { bg: 'rgba(28,14,8,0.94)', inner: 'rgba(200,153,96,0.45)' });

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = '#c89960'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#c89960';
  ctx.font = `bold 28px ${SERIF}`;
  ctx.fillText(pendingEndless ? 'Endless Mode' : 'Begin New Run', W/2, fy + 58);
  ctx.restore();

  txt('Enter your name for the high score board:', W/2, fy + 88, {size:12,color:'rgba(200,170,120,0.65)',align:'center'});

  // Name input box
  drawRoundRect(W/2-160, fy+104, 320, 46, 8, '#100828', '#c89960', 2);
  const cursor = Math.floor(t*2) % 2 ? '|' : '';
  if (nameEntry) {
    txt(nameEntry + cursor, W/2, fy+133, {size:18,color:'#c89960',align:'center'});
  } else if (cursor) {
    txt(cursor, W/2, fy+133, {size:18,color:'#c89960',align:'center'});
  } else {
    txt('type your name…', W/2, fy+133, {size:14,color:'rgba(200,153,96,0.3)',align:'center'});
  }

  drawBtn({x:W/2-130,y:fy+166,w:260,h:48}, '▶  Start', true, true);
  drawBtn({x:W/2-80,y:fy+222,w:160,h:30}, '← Back', true);

  drawParticles(); drawFloaters();
}

function drawTitle(t) {
  drawBG(t);

  // Ornate central parchment frame
  const fw = 560, fh = 360;
  const fx = (W - fw) / 2, fy = (H - fh) / 2;
  ornamentFrame(fx, fy, fw, fh, '#5a2a18', { bg: 'rgba(28,14,8,0.94)', inner: 'rgba(200,153,96,0.45)' });

  // Top flourish line with sigils
  ctx.save();
  ctx.strokeStyle = 'rgba(200,153,96,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx + 40, fy + 42);
  ctx.lineTo(fx + fw - 40, fy + 42);
  ctx.stroke();
  ctx.fillStyle = '#c89960';
  ctx.font = `16px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText('✦', fx + 30, fy + 47);
  ctx.fillText('✦', fx + fw - 30, fy + 47);
  ctx.restore();

  // Title in serif — layered for depth (shadow + main)
  ctx.save();
  ctx.textAlign='center';
  ctx.fillStyle='rgba(0,0,0,0.7)';
  ctx.font = `bold 64px ${SERIF}`;
  ctx.fillText('FortuneFallacy', W/2 + 2, fy + 112 + 2);
  ctx.shadowColor = '#9a3826'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#c89960';
  ctx.fillText('FortuneFallacy', W/2, fy + 112);
  ctx.restore();

  // Subtitle in italic serif
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b8a874';
  ctx.font = `italic 18px ${SERIF}`;
  ctx.fillText('Roll the dice.  Defy the fallacy.', W/2, fy + 150);
  ctx.fillStyle = 'rgba(200,170,120,0.55)';
  ctx.font = `12px ${SERIF}`;
  ctx.fillText('A dice roguelike  ·  8 goals  ·  endless mode', W/2, fy + 172);
  ctx.restore();

  // Bottom flourish
  ctx.save();
  ctx.strokeStyle = 'rgba(200,153,96,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx + 60, fy + fh - 20);
  ctx.lineTo(fx + fw - 60, fy + fh - 20);
  ctx.stroke();
  ctx.fillStyle = '#9a7848';
  ctx.font = `10px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText('☽', fx + 48, fy + fh - 16);
  ctx.fillText('☽', fx + fw - 48, fy + fh - 16);
  ctx.restore();

  drawBtn({x:W/2-130,y:fy + 200,w:260,h:48}, '▶  Begin New Run', true, true);
  if (endlessUnlocked())
    drawBtn({x:W/2-130,y:fy + 256,w:260,h:42}, '∞  Endless Mode', true);
  drawBtn({x:W/2-110,y:fy + 304,w:220,h:36}, '🏆  High Scores', true);

  const pulse = 0.5 + 0.4*Math.sin(t*2.3);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(200,170,120,${pulse})`;
  ctx.font = `italic 11px ${SERIF}`;
  ctx.fillText('— press any key to begin —', W/2, H - 26);
  ctx.restore();
}

// ─── SCREEN: Game ─────────────────────────────────────────────────────
function drawGame(t) {
  drawBG(t);

  // Left panel
  ornamentFrame(LP.x, LP.y, LP.w, LP.h, '#3a1e10');
  panelHeader(LP.x + LP.w/2, LP.y + 22, LP.w - 20, 'Oracles', '#c89960', '☽');

  const cardH = 68; const cardW = LP.w - 16;
  for (let i = 0; i < MAX_ORACLES; i++) {
    const cy = LP.y + 38 + i*(cardH+5);
    if (i < heldOracles.length) {
      drawOracleCard(heldOracles[i], LP.x+8, cy, cardW, cardH, true);
    } else {
      drawRoundRect(LP.x+8, cy, cardW, cardH, 6, 'rgba(255,255,255,0.02)', '#2a180e');
      txt('—', LP.x+LP.w/2, cy+cardH/2+5, {size:14,color:'#3a2210',align:'center'});
    }
  }
  // Return portal
  if (incoming.ref) {
    returnPortalPulse += 0.05;
    drawPortalRing(LP.x+LP.w/2, LP.y+LP.h-44, 24, '#b8a874', returnPortalPulse, '← Return', true);
  }

  // Center panel
  ornamentFrame(CP.x, CP.y, CP.w, CP.h, '#3a1e10');
  // Ornate title with goal label (replaces plain header)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c89960';
  ctx.font = `bold 20px ${SERIF}`;
  ctx.fillText(goalLabel(), CP.x + CP.w/2, CP.y + 30);
  ctx.restore();
  panelHeader(CP.x + CP.w/2, CP.y + 46, CP.w - 40, `${handsLeft} hand${handsLeft!==1?'s':''} remaining`, '#a88860', '✦');

  // Board surface behind dice
  drawBoard(CP.x + CP.w/2, BOARD_Y, CP.w - 16, BOARD_H);

  // Holding tray — slot frames + label (behind dice, above particles)
  {
    const trayX = HOLD_X0 - 10;
    const trayW = HOLD_TOTAL + 20;
    const trayBG = ctx.createLinearGradient(0, HOLD_Y, 0, HOLD_Y + HOLD_H);
    trayBG.addColorStop(0, 'rgba(22,13,7,0.55)');
    trayBG.addColorStop(1, 'rgba(12,6,3,0.7)');
    drawRoundRect(trayX, HOLD_Y, trayW, HOLD_H, 8, trayBG, 'rgba(200,153,96,0.22)', 1);
    // Label
    ctx.save();
    ctx.fillStyle = 'rgba(200,170,120,0.55)';
    ctx.font = `bold 9px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillText('— HELD —', CP.x + CP.w/2, HOLD_Y - 4);
    ctx.restore();
    // Slot outlines
    const held = heldCount();
    for (let si = 0; si < MAX_HELD; si++) {
      const sx = HOLD_X0 + si*(HOLD_SLOT_W + HOLD_GAP);
      const sy = HOLD_Y + (HOLD_H - HOLD_SLOT_W) / 2;
      const filled = si < held;
      ctx.save();
      ctx.strokeStyle = filled ? 'rgba(200,153,96,0.45)' : 'rgba(200,153,96,0.12)';
      ctx.setLineDash(filled ? [] : [3, 3]);
      ctx.lineWidth = 1;
      roundRect(sx, sy, HOLD_SLOT_W, HOLD_SLOT_W, 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Dice (3D) — positions driven by absX/absY physics
  for (let i = 0; i < dice.length; i++) {
    const d = dice[i];
    drawDie3D(d, d.absX, d.absY, DICE_SIZE);
    const upg = diceUpgrades[i];
    if (upg) {
      ctx.save();
      ctx.fillStyle = upg.color; ctx.shadowColor = upg.color; ctx.shadowBlur = 2;
      ctx.font = '11px ui-sans-serif,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(upg.icon, d.absX, d.absY + DICE_SIZE/2 + 14);
      ctx.restore();
    }
    if (!d.rolling) {
      const hs = DICE_SIZE / 2;
      if (inRect(hoverX, hoverY, { x: d.absX-hs, y: d.absY-hs, w: DICE_SIZE, h: DICE_SIZE })) {
        if (upg) markHover(`gameDie:${i}`, upg.name, upgradeTooltipBody(upg), { color: upg.color });
        else     markHover(`gameDie:${i}`, 'Plain Die', 'A standard d6. Scores its face value.', { color: '#e0d3b8' });
      }
    }
  }

  // Combo name (before play) or live chips × mult counter (during scoring)
  if (handInProgress && scoringState) {
    const { chips, mult } = scoringState;
    const chipPunch = scoringState.chipPunch || 0;
    const multPunch = scoringState.multPunch || 0;
    const chipScale = 1 + chipPunch * 0.45;
    const multScale = 1 + multPunch * 0.45;
    const sy = BOARD_Y + BOARD_H - 24;
    const cx2 = CP.x + CP.w / 2;
    ctx.save();
    ctx.textAlign = 'center';
    // Chips with punch scale
    ctx.save();
    ctx.translate(cx2 - 58, sy); ctx.scale(chipScale, chipScale);
    ctx.fillStyle = '#c89960'; ctx.shadowColor = '#c89960'; ctx.shadowBlur = 3 + chipPunch * 10;
    ctx.font = 'bold 22px ui-sans-serif,sans-serif';
    ctx.fillText(chips, 0, 0);
    ctx.restore();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(200,153,96,0.55)';
    ctx.font = '9px ui-sans-serif,sans-serif';
    ctx.fillText('points', cx2 - 58, sy + 13);
    ctx.fillStyle = 'rgba(230,210,160,0.7)'; ctx.font = 'bold 15px ui-sans-serif,sans-serif';
    ctx.fillText('×', cx2, sy - 2);
    // Mult with punch scale
    ctx.save();
    ctx.translate(cx2 + 58, sy); ctx.scale(multScale, multScale);
    ctx.fillStyle = '#9a3826'; ctx.shadowColor = '#9a3826'; ctx.shadowBlur = 3 + multPunch * 10;
    ctx.font = 'bold 22px ui-sans-serif,sans-serif';
    ctx.fillText(mult, 0, 0);
    ctx.restore();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(154,56,38,0.55)';
    ctx.font = '9px ui-sans-serif,sans-serif';
    ctx.fillText('mult', cx2 + 58, sy + 13);
    ctx.restore();
    // Decay punches
    scoringState.chipPunch = Math.max(0, chipPunch - 0.08);
    scoringState.multPunch = Math.max(0, multPunch - 0.08);
  } else if (rolledOnce && !handInProgress) {
    const heldFaces = dice.filter(d => d.locked).map(d => d.face);
    if (heldFaces.length > 0) {
      const combo = detectCombo(heldFaces);
      const col   = COMBO_COLORS[combo.tier]||'#fff';
      txt(combo.name, CP.x+CP.w/2, BOARD_Y + BOARD_H - 12, {size:15,color:col,align:'center',bold:true,shadow:col});
    } else {
      txt(`Hold 1–${MAX_HELD} dice to play`, CP.x+CP.w/2, BOARD_Y + BOARD_H - 12, {size:13,color:'rgba(200,170,120,0.55)',align:'center'});
    }
  }

  const canRoll = !handInProgress && (!rolledOnce || rerollsLeft > 0);
  const canPlay = rolledOnce && !handInProgress && heldCount() > 0;
  drawBtn(BTN_ROLL, rolledOnce ? `Reroll  (${rerollsLeft} left)` : 'Roll Dice', canRoll);
  drawBtn(BTN_PLAY, 'Play Hand  ✦', canPlay, canPlay);

  if (rolledOnce && !handInProgress)
    txt('Click dice to hold / release them', CP.x+CP.w/2, BTN_PLAY.y+BTN_PLAY.h+16, {size:10,color:'rgba(200,170,120,0.55)',align:'center'});

  // Right panel
  ornamentFrame(RP.x, RP.y, RP.w, RP.h, '#3a1e10');
  panelHeader(RP.x + RP.w/2, RP.y + 22, RP.w - 20, 'Fate Score', '#c89960', '⚝');

  ctx.save();
  ctx.fillStyle='#e0c590'; ctx.shadowColor='#9a3826'; ctx.shadowBlur=3;
  ctx.font=`bold 32px ${SERIF}`; ctx.textAlign='center';
  ctx.fillText(displayRoundScore.toLocaleString(), RP.x+RP.w/2, RP.y+62);
  ctx.restore();
  txt('/ '+currentTarget().toLocaleString(), RP.x+RP.w/2, RP.y+74, {size:11,color:'rgba(200,180,255,0.55)',align:'center'});

  // Progress bar
  const prog = Math.min(1, roundScore/currentTarget());
  const bx=RP.x+12, by=RP.y+84, bw=RP.w-24, bh=14;
  drawRoundRect(bx, by, bw, bh, 5, '#1a0f08', '#3a1e10');
  if (prog>0) {
    ctx.save();
    ctx.shadowColor = prog>=1?'#c89960':'#a03325'; ctx.shadowBlur = prog>=1?16:6;
    drawRoundRect(bx, by, bw*prog, bh, 5, prog>=1?'#c89960':'#9a3826', null);
    ctx.restore();
  }

  // Goal dots
  if (!endless) {
    txt('Run Progress', RP.x+RP.w/2, RP.y+116, {size:9,color:'rgba(200,170,120,0.55)',align:'center'});
    for (let i = 0; i < GOAL_TARGETS.length; i++) {
      const dx = RP.x + 14 + i*(RP.w-28)/(GOAL_TARGETS.length-1);
      ctx.save();
      if (i<runGoal) { ctx.fillStyle='#c89960'; ctx.shadowColor='#c89960'; ctx.shadowBlur=2; }
      else if (i===runGoal) { ctx.fillStyle='#9a3826'; ctx.shadowColor='#9a3826'; ctx.shadowBlur=3; }
      else { ctx.fillStyle='#2a1810'; }
      ctx.beginPath(); ctx.arc(dx, RP.y+128, 5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  } else {
    txt(`Stage ${runGoal+1}`, RP.x+RP.w/2, RP.y+120, {size:13,color:'#9a3826',align:'center',bold:true});
  }

  txt(`Rerolls: ${rerollsLeft} / ${REROLLS_PER_HAND}`, RP.x+RP.w/2, RP.y+150, {size:10,color:'rgba(200,170,120,0.55)',align:'center'});
  txt('Total Fate', RP.x+RP.w/2, RP.y+176, {size:9,color:'rgba(200,170,120,0.55)',align:'center'});
  txt((totalFateScore+roundScore).toLocaleString(), RP.x+RP.w/2, RP.y+196, {size:15,color:'#e6c590',align:'center',bold:true});

  // Exit portal
  exitPortalPulse += 0.05;
  const epLabel = (nextTarget?.title ?? 'Jam Hub').slice(0,14);
  drawPortalRing(RP.x+RP.w/2, RP.y+RP.h-44, 24, '#9a3826', exitPortalPulse, epLabel, endless);
  if (!endless) txt('(finish run first)', RP.x+RP.w/2, RP.y+RP.h-14, {size:8,color:'rgba(180,100,255,0.35)',align:'center'});

  drawParticles();
  drawFloaters();
  drawComboPop();
  drawBanner();

  if (flashAlpha > 0) {
    ctx.save(); ctx.globalAlpha=flashAlpha; ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H); ctx.restore();
    flashAlpha = Math.max(0, flashAlpha - 0.035);
  }
}

// ─── SCREEN: Shop ─────────────────────────────────────────────────────
function drawShop(t) {
  drawBG(t);
  txt('ORACLE SHOP', W/2, 56, {size:30,color:'#9a3826',align:'center',bold:true,shadow:'#9a3826'});
  txt(`Goal ${runGoal} cleared! Choose a power-up — it lasts the whole run.`, W/2, 86, {size:13,color:'rgba(200,180,255,0.7)',align:'center'});

  for (let i = 0; i < shopChoices.length; i++) {
    const cx = W/2 - 380 + i*265;
    drawOracleCard(shopChoices[i], cx, H/2-150, 250, 310);
  }
  drawBtn({x:W/2-70,y:H-68,w:140,h:38}, 'Skip →', true);
  drawParticles(); drawFloaters();
}

// ─── SCREEN: Hub ──────────────────────────────────────────────────────
function drawHub(t) {
  drawBG(t);
  txt('CAMPAIGN MAP', W/2, 44, {size:24,color:'#9a3826',align:'center',bold:true,shadow:'#9a3826'});
  txt(`Goal ${runGoal} cleared  ·  +${hubEarnedShards} Shards earned`, W/2, 72, {size:13,color:'#b8a874',align:'center'});

  // Shard badge (top right)
  drawRoundRect(W-158, 14, 144, 34, 8, 'rgba(200,153,96,0.08)', '#b8a874', 1.5);
  txt(`◆ ${shards} Shards`, W-86, 36, {size:13,color:'#b8a874',align:'center',bold:true});

  // Goal map
  const mapXS = 80, mapXE = W-80, mapY = 155;
  const nodes = GOAL_TARGETS;
  for (let i = 0; i < nodes.length - 1; i++) {
    const x1 = mapXS + (i/(nodes.length-1))*(mapXE-mapXS);
    const x2 = mapXS + ((i+1)/(nodes.length-1))*(mapXE-mapXS);
    ctx.save();
    ctx.strokeStyle = i < runGoal ? '#c89960' : 'rgba(100,60,30,0.5)';
    ctx.lineWidth = 3; ctx.setLineDash(i < runGoal ? [] : [6,5]);
    ctx.beginPath(); ctx.moveTo(x1+22, mapY); ctx.lineTo(x2-22, mapY); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }
  for (let i = 0; i < nodes.length; i++) {
    const gx = mapXS + (i/(nodes.length-1))*(mapXE-mapXS);
    const cleared = i < runGoal, current = i === runGoal;
    const col = cleared ? '#c89960' : current ? '#9a3826' : '#2a1810';
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = cleared||current ? 14 : 0;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(gx, mapY, 20, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = cleared ? '#ffe066' : current ? '#b35838' : '#332255';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gx, mapY, 20, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = cleared ? '#0d0805' : current ? '#fff' : '#5a3a18';
    ctx.font = 'bold 12px ui-sans-serif,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(cleared ? '✓' : String(i+1), gx, mapY+5);
    const lbl = nodes[i]>=10000 ? (nodes[i]/1000|0)+'k' : nodes[i]>=1000 ? (nodes[i]/1000).toFixed(1)+'k' : String(nodes[i]);
    txt(lbl, gx, mapY+38, {size:10,color:cleared?'#c89960':current?'#9a3826':'rgba(180,150,100,0.5)',align:'center'});
  }

  // Owned oracle row
  if (heldOracles.length > 0) {
    txt('YOUR ORACLES', 90, 232, {size:9,color:'rgba(200,170,120,0.55)',align:'left',bold:true});
    heldOracles.forEach((o,i) => drawOracleCard(o, 90+i*54, 244, 48, 68, true));
  }

  // Owned dice upgrade row
  const anyUpg = diceUpgrades.some(u=>u);
  if (anyUpg) {
    txt('YOUR DICE', 90, 330, {size:9,color:'rgba(200,170,120,0.55)',align:'left',bold:true});
    diceUpgrades.forEach((u,i) => {
      const ux = 90+i*54;
      const hov = inRect(hoverX,hoverY,{x:ux,y:342,w:48,h:48});
      if (!u) {
        if (hov) markHover(`hubDie:${i}`, 'Plain Die', 'A standard d6. Scores its face value.', { color: '#e0d3b8' });
        drawRoundRect(ux,342,48,48,8,'rgba(255,255,255,0.02)','rgba(80,50,130,0.35)');
        return;
      }
      if (hov) markHover(`hubDie:${i}`, u.name, upgradeTooltipBody(u), { color: u.color });
      drawRoundRect(ux,342,48,48,8,'rgba(12,4,28,0.9)',u.color,2);
      txt(u.icon, ux+24, 372, {size:18,color:u.color,align:'center'});
    });
  }

  // Action buttons
  const BY = H - 84;
  const canOracle = heldOracles.length < MAX_ORACLES && shopChoices.length > 0;
  drawBtn({x:W/2-300,y:BY,w:185,h:50}, '🔮 Oracle Gift', canOracle, canOracle);
  if (!canOracle) txt('(oracles full)', W/2-207, BY+64, {size:9,color:'rgba(200,180,255,0.3)',align:'center'});
  drawBtn({x:W/2-75,y:BY,w:175,h:50}, '⚒ Forge Shop', true, shards>0);
  txt(`◆ ${shards} shards available`, W/2+12, BY+64, {size:9,color:'#b8a874',align:'center'});
  drawBtn({x:W/2+130,y:BY,w:170,h:50}, 'Next Goal →', true, true);

  drawParticles(); drawFloaters();
}

// ─── SCREEN: Forge ────────────────────────────────────────────────────
function drawForge(t) {
  drawBG(t);
  txt('THE FORGE', W/2, 42, {size:24,color:'#b35838',align:'center',bold:true,shadow:'#b35838'});
  drawRoundRect(W-158,14,144,34,8,'rgba(200,153,96,0.08)','#b8a874',1.5);
  txt(`◆ ${shards} Shards`, W-86, 36, {size:13,color:'#b8a874',align:'center',bold:true});

  // Tabs
  const tabY = 64;
  drawBtn({x:W/2-170,y:tabY,w:160,h:34}, '⚄ Dice Upgrades', true, forgeTab==='dice');
  drawBtn({x:W/2+10, y:tabY,w:160,h:34}, '🔮 Oracle Store',  true, forgeTab==='oracles');

  if (forgeTab === 'dice') {
    // Upgrade cards — click to BUY (adds a new die to your pool)
    const poolFull = diceUpgrades.length >= MAX_DICE;
    txt(poolFull ? `POOL FULL (${MAX_DICE} dice max)` : `BUY A DIE — adds to your pool (${diceUpgrades.length}/${MAX_DICE})`,
      W/2, 122, {size:10,color:poolFull?'#ff8844':'rgba(200,170,120,0.55)',align:'center',bold:true});
    const upgW = 188, upgH = 138, upgGap = 14;
    const upgTotal = forgeChoices.upgrades.length*(upgW+upgGap)-upgGap;
    const upgX0 = W/2 - upgTotal/2;
    forgeChoices.upgrades.forEach((upg,i) => {
      const ux = upgX0 + i*(upgW+upgGap), uy = 134;
      const canAfford = shards >= upg.cost && !poolFull;
      const hov = inRect(hoverX,hoverY,{x:ux,y:uy,w:upgW,h:upgH});
      if (hov) markHover(`forgeBuy:${upg.id}:${i}`, upg.name, upgradeTooltipBody(upg), { color: upg.color, cost: upg.cost });
      ctx.save();
      if (hov&&canAfford) { ctx.shadowColor=upg.color; ctx.shadowBlur=6; }
      drawRoundRect(ux,uy,upgW,upgH,10,
        hov?'rgba(18,6,36,0.95)':'rgba(12,4,28,0.85)',
        canAfford?(hov?upg.color:'rgba(140,90,220,0.65)'):'rgba(70,50,100,0.35)',hov?2.5:1.5);
      ctx.restore();
      txt(upg.icon, ux+upgW/2, uy+28, {size:20,color:upg.color,align:'center'});
      txt(upg.name, ux+upgW/2, uy+50, {size:12,color:'#fff',align:'center'});
      txt(upg.desc, ux+upgW/2, uy+68, {size:10,color:'#c89960',align:'center'});
      txt(`◆ ${upg.cost} Shards`, ux+upgW/2, uy+92, {size:11,color:canAfford?'#b8a874':'rgba(180,150,100,0.5)',align:'center',bold:true});
      txt(canAfford?'click to buy':poolFull?'pool full':'not enough shards',
        ux+upgW/2, uy+114, {size:9,color:canAfford?'rgba(255,200,80,0.7)':'rgba(200,170,120,0.35)',align:'center'});
    });

    // Current dice pool viewer
    txt('YOUR DICE POOL', W/2, 298, {size:10,color:'rgba(200,170,120,0.55)',align:'center',bold:true});
    const pn = diceUpgrades.length;
    const poolW = 44, poolGap = 8;
    const poolTotal = pn*(poolW+poolGap)-poolGap;
    const poolX0 = W/2 - poolTotal/2;
    for (let i=0;i<pn;i++) {
      const ex = diceUpgrades[i];
      const px = poolX0 + i*(poolW+poolGap), py = 310;
      const hovPool = inRect(hoverX,hoverY,{x:px,y:py,w:poolW,h:poolW});
      if (hovPool) {
        if (ex) markHover(`poolDie:${i}`, ex.name, upgradeTooltipBody(ex), { color: ex.color });
        else    markHover(`poolDie:${i}`, 'Plain Die', 'A standard d6. Scores its face value with no modifiers.', { color: '#e0d3b8' });
      }
      drawRoundRect(px,py,poolW,poolW,6,'rgba(10,3,24,0.9)',
        ex?ex.color:'rgba(200,200,200,0.5)', ex?2:1.2);
      if (ex) txt(ex.icon, px+poolW/2, py+poolW/2+6, {size:18,color:ex.color,align:'center'});
      else    txt('⚅', px+poolW/2, py+poolW/2+6, {size:18,color:'#e0d3b8',align:'center'});
    }
    // Reroll offerings
    const rerollCost = 3;
    const canReroll  = shards >= rerollCost;
    drawBtn({x:W/2+90,y:H-54,w:140,h:40}, `🜂 Reroll ◆${rerollCost}`, canReroll, canReroll);
  } else {
    // Oracle store
    txt('BUY ORACLES WITH SHARDS', W/2, 122, {size:10,color:'rgba(200,170,120,0.55)',align:'center',bold:true});
    if (forgeChoices.oracles.length === 0) {
      txt('No oracles available — you own them all!', W/2, 280, {size:14,color:'rgba(200,180,255,0.4)',align:'center'});
    } else {
      const cW=220,cH=260,cGap=22;
      const cTotal=forgeChoices.oracles.length*(cW+cGap)-cGap;
      const cX0=W/2-cTotal/2;
      forgeChoices.oracles.forEach((o,i) => {
        const ox=cX0+i*(cW+cGap), oy=136;
        const cost=oracleCost(o);
        const canAfford=shards>=cost && heldOracles.length<MAX_ORACLES;
        drawOracleCard(o,ox,oy,cW,cH,false);
        drawBtn({x:ox+20,y:oy+cH+6,w:cW-40,h:32}, `◆ ${cost} Shards`, canAfford, canAfford);
        if (!canAfford && heldOracles.length>=MAX_ORACLES) txt('(oracles full)',ox+cW/2,oy+cH+48,{size:9,color:'rgba(200,180,255,0.35)',align:'center'});
      });
    }
    // Reroll offerings
    const rerollCost = 3;
    const canReroll  = shards >= rerollCost;
    drawBtn({x:W/2+90,y:H-54,w:140,h:40}, `🜂 Reroll ◆${rerollCost}`, canReroll, canReroll);
  }

  drawBtn({x:W/2-90,y:H-54,w:180,h:40}, '← Back to Hub', true);
  drawParticles(); drawFloaters();
}

// ─── SCREEN: Win ──────────────────────────────────────────────────────
function drawWin(t) {
  drawBG(t);
  if (Math.random()<0.04) burst(Math.random()*W, Math.random()*H, Math.random()<0.5?'#c89960':'#9a3826', 3, 4);

  ctx.save();
  ctx.textAlign='center'; ctx.shadowColor='#c89960'; ctx.shadowBlur=14;
  ctx.fillStyle='#c89960'; ctx.font='bold 64px ui-sans-serif,sans-serif';
  ctx.fillText('FATE DEFIED', W/2, H/2-92); ctx.restore();

  txt('All 8 Goals conquered!', W/2, H/2-44, {size:18,color:'#fff',align:'center'});
  txt('Total Fate Score:', W/2, H/2+6, {size:13,color:'rgba(200,180,255,0.7)',align:'center'});
  txt(totalFateScore.toLocaleString(), W/2, H/2+44, {size:38,color:'#c89960',align:'center',bold:true,shadow:'#c89960'});
  txt('✦ Endless Mode Unlocked ✦', W/2, H/2+74, {size:14,color:'#b8a874',align:'center',bold:true});

  txt(playerName || incoming.username || 'Wanderer', W/2, H/2+78, {size:13,color:'rgba(200,170,120,0.65)',align:'center'});
  drawBtn({x:W/2-130,y:H/2+90,w:260,h:46}, '🏆  Save Score', true, true);

  exitPortalPulse += 0.05; returnPortalPulse += 0.05;
  drawPortalRing(W-52, H/2, 32, '#9a3826', exitPortalPulse, epLabel(), true);
  if (incoming.ref) drawPortalRing(52, H/2, 32, '#b8a874', returnPortalPulse, '← Return', true);

  drawParticles(); drawFloaters();
}

function epLabel() { return (nextTarget?.title ?? 'Jam Hub').slice(0,14); }

// ─── SCREEN: Scores ───────────────────────────────────────────────────
function drawScores(t) {
  drawBG(t);
  txt('HIGH SCORES', W/2, 66, {size:34,color:'#c89960',align:'center',bold:true,shadow:'#c89960'});

  const headers = ['#','Name','Score','Mode'];
  const cxs     = [W/2-230, W/2-170, W/2+50, W/2+185];
  headers.forEach((h,i) => txt(h, cxs[i], 116, {size:11,color:'#9a3826',align:'left',bold:true}));

  if (highScores.length === 0) {
    txt('No scores yet — go play!', W/2, 210, {size:16,color:'rgba(200,170,120,0.55)',align:'center'});
  }
  highScores.slice(0,8).forEach((s,i) => {
    const y   = 144 + i*38;
    const col = i===0 ? '#c89960' : 'rgba(230,210,160,0.85)';
    if (i===0) drawRoundRect(W/2-248,y-24,496,34,6,'rgba(200,153,96,0.06)','#c89960',1);
    txt(String(i+1),    cxs[0], y, {size:14,color:col,align:'left',bold:i===0});
    txt(s.name||'?',    cxs[1], y, {size:14,color:col,align:'left',bold:i===0});
    txt(Number(s.score).toLocaleString(), cxs[2], y, {size:14,color:col,align:'left',bold:i===0});
    txt(s.mode||'run',  cxs[3], y, {size:11,color:'rgba(200,170,120,0.55)',align:'left'});
  });

  drawBtn({x:W/2-100,y:H-68,w:200,h:40}, '← Back to Menu', true);
}

// ─── Main loop ────────────────────────────────────────────────────────
let lastT = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const t = now / 1000;

  // Assign held dice to tray slots by held order (drives glide targets)
  {
    let hs = 0;
    for (const d of dice) d.holdSlot = d.locked ? hs++ : -1;
  }

  // Update 3D dice physics
  for (let i = 0; i < dice.length; i++) {
    const d = dice[i];
    if (d.scoring) d.scoringT += dt; else d.scoringT = 0;
    if (d.landT !== undefined && !d.rolling) d.landT += dt;
    if (d.rolling) {
      d.rollT += dt;
      const prog = Math.min(1, d.rollT / d.rollDur);

      if (prog < 0.62) {
        // Tumble coupling — linear velocity drives rotation axis perpendicular to motion
        const speed = Math.hypot(d.pvx, d.pvy);
        if (speed > 20) {
          const inv = 1 / speed;
          const mx  = d.pvx * inv, my = d.pvy * inv;
          const tumbleRate = speed * 0.045;
          // Moving right → spin around Y; moving down → spin around X
          d.vy = d.vy * 0.78 + mx * tumbleRate * 0.22;
          d.vx = d.vx * 0.78 + my * tumbleRate * 0.22;
        }
        d.rx += d.vx * dt;
        d.ry += d.vy * dt;
        d.rz += d.vz * dt;
        const fr = Math.pow(0.32, dt);
        d.vx *= fr; d.vy *= fr; d.vz *= fr;
        d.settling = false;
      } else {
        // Snap to target face rotation
        if (!d.settling) {
          d.settling = true;
          d.sfRx = d.rx; d.sfRy = d.ry; d.sfRz = d.rz;
          // Find nearest equivalent of canonical target
          d.tRx = nearestCanon(d.rx, FACE_ROT[d.face][0]);
          d.tRy = nearestCanon(d.ry, FACE_ROT[d.face][1]);
          d.tRz = nearestCanon(d.rz, FACE_ROT[d.face][2]);
        }
        const st   = (prog - 0.62) / 0.38;
        const ease = 1 - Math.pow(1 - st, 3);
        d.rx = d.sfRx + (d.tRx - d.sfRx) * ease;
        d.ry = d.sfRy + (d.tRy - d.sfRy) * ease;
        d.rz = d.sfRz + (d.tRz - d.sfRz) * ease;
      }
    }
    // Bounce physics — gravity + multi-hop while tumbling
    const speed2 = Math.hypot(d.pvx, d.pvy);
    if (d.rolling && d.bounceY >= 0 && d.bounceVY >= -0.01 && speed2 > 90 && (d.bounceCount|0) < 4) {
      // Still moving fast → take another hop (tumbling)
      d.bounceVY = -(7 + Math.random() * 5 + speed2 * 0.008);
      d.bounceCount = (d.bounceCount|0) + 1;
    }
    if (d.bounceY < 0 || d.bounceVY < 0) {
      d.bounceVY += 150 * dt;
      d.bounceY  += d.bounceVY * dt;
      if (d.bounceY > 0) {
        d.bounceY = 0;
        if (Math.abs(d.bounceVY) > 3) {
          d.bounceVY = -Math.abs(d.bounceVY) * 0.42;
          // Landing thud → angular kick + tangential friction
          if (d.rolling) {
            d.vx += (Math.random() - 0.5) * 7;
            d.vz += (Math.random() - 0.5) * 5;
            d.pvx *= 0.90; d.pvy *= 0.90;
            if (Math.abs(d.bounceVY) > 4) {
              burst(d.absX, d.absY + DICE_SIZE*0.35, '#8a5a2e', 2, 1.6);
              playTone(100 + Math.random()*30, 'square', 0.02, 0.03);
            }
          }
        } else {
          d.bounceVY = 0;
        }
      }
    }

    // Position physics — dice fly around the table when rolling
    if (d.rolling) {
      const hs = DICE_SIZE / 2;
      const bL = CP.x + 14 + hs, bR = CP.x + CP.w - 14 - hs;
      const bT = BOARD_Y + 10 + hs, bB = BOARD_Y + BOARD_H - 10 - hs;
      d.absX += d.pvx * dt;
      d.absY += d.pvy * dt;
      // Air drag is light; ground (rolling) friction grips harder
      const inAir = d.bounceY < -0.5;
      const fr = inAir ? Math.pow(0.62, dt) : Math.pow(0.18, dt);
      d.pvx *= fr; d.pvy *= fr;
      // Wall collisions — bounce + spin kick from tangential velocity
      if (d.absX < bL) {
        d.absX = bL;
        const inV = -d.pvx;
        d.pvx = Math.abs(d.pvx) * 0.72;
        d.vy += inV * 0.02;
        d.vz += d.pvy * 0.015;
        if (inV > 80) { burst(bL, d.absY, '#c89960', 3, 2); playTone(140, 'square', 0.03, 0.04); }
      } else if (d.absX > bR) {
        d.absX = bR;
        const inV = d.pvx;
        d.pvx = -Math.abs(d.pvx) * 0.72;
        d.vy -= inV * 0.02;
        d.vz -= d.pvy * 0.015;
        if (inV > 80) { burst(bR, d.absY, '#c89960', 3, 2); playTone(140, 'square', 0.03, 0.04); }
      }
      if (d.absY < bT) {
        d.absY = bT;
        const inV = -d.pvy;
        d.pvy = Math.abs(d.pvy) * 0.72;
        d.vx -= inV * 0.02;
        d.vz += d.pvx * 0.015;
        if (inV > 80) { burst(d.absX, bT, '#c89960', 3, 2); playTone(140, 'square', 0.03, 0.04); }
      } else if (d.absY > bB) {
        d.absY = bB;
        const inV = d.pvy;
        d.pvy = -Math.abs(d.pvy) * 0.72;
        d.vx += inV * 0.02;
        d.vz -= d.pvx * 0.015;
        if (inV > 80) { burst(d.absX, bB, '#c89960', 3, 2); playTone(140, 'square', 0.03, 0.04); }
      }
    }
    // Glide between holding tray and last board position based on lock state
    if (!d.rolling) {
      let tx = null, ty = null;
      if (d.locked) {
        const slot = holdSlotCenter(d.holdSlot != null ? d.holdSlot : 0);
        tx = slot.x; ty = slot.y;
      } else if (d.homeX != null) {
        tx = d.homeX; ty = d.homeY;
      }
      if (tx != null) {
        const lerp = 1 - Math.pow(0.0015, dt);
        d.absX += (tx - d.absX) * lerp;
        d.absY += (ty - d.absY) * lerp;
      }
    }
  }

  // Dice-to-dice collision (cubes → AABB separation + rotational impulse)
  {
    const hs   = DICE_SIZE / 2;
    const bL   = CP.x + 14 + hs, bR = CP.x + CP.w - 14 - hs;
    const bT   = BOARD_Y + 10 + hs, bB = BOARD_Y + BOARD_H - 10 - hs;
    const side = DICE_SIZE + 2;  // full cube edge + small air gap
    const e    = 0.78;

    // Pass 1: velocity impulses (rolling dice only) — AABB axis-of-min-penetration
    for (let ci = 0; ci < dice.length - 1; ci++) {
      for (let cj = ci + 1; cj < dice.length; cj++) {
        const di = dice[ci], dj = dice[cj];
        if (!di.rolling && !dj.rolling) continue;
        if (di.locked || dj.locked) continue;
        const dx = dj.absX - di.absX, dy = dj.absY - di.absY;
        const ox = side - Math.abs(dx);
        const oy = side - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;

        // Normal points along axis with smaller overlap (min-translation vector)
        let nx, ny;
        if (ox < oy) { nx = dx >= 0 ? 1 : -1; ny = 0; }
        else         { nx = 0; ny = dy >= 0 ? 1 : -1; }

        const relVx = di.pvx - dj.pvx, relVy = di.pvy - dj.pvy;
        const dvn   = relVx * nx + relVy * ny;
        if (dvn <= 0) continue;

        if (di.rolling && dj.rolling) {
          const j = (1 + e) * dvn * 0.5;
          di.pvx -= j*nx; di.pvy -= j*ny;
          dj.pvx += j*nx; dj.pvy += j*ny;
        } else if (di.rolling) {
          di.pvx -= (1 + e) * dvn * nx;
          di.pvy -= (1 + e) * dvn * ny;
        } else {
          dj.pvx += (1 + e) * dvn * nx;
          dj.pvy += (1 + e) * dvn * ny;
        }

        // Rotational kick — perpendicular component of contact → spin (juice)
        const tx = -ny, ty = nx;
        const relTan = relVx * tx + relVy * ty;
        const spinKick = relTan * 0.07;
        di.vx += spinKick * 0.75; di.vy -= spinKick * 0.75; di.vz += spinKick * 1.1;
        dj.vx -= spinKick * 0.75; dj.vy += spinKick * 0.75; dj.vz -= spinKick * 1.1;

        // Vertical hop from collision — harder hits lift the dice
        const impactMag = Math.abs(dvn);
        if (impactMag > 40 && di.rolling) {
          di.bounceVY = Math.min(di.bounceVY, -(4 + impactMag * 0.018));
          di.bounceCount = (di.bounceCount|0) + 1;
        }
        if (impactMag > 40 && dj.rolling) {
          dj.bounceVY = Math.min(dj.bounceVY, -(4 + impactMag * 0.018));
          dj.bounceCount = (dj.bounceCount|0) + 1;
        }

        const pairKey = `${ci}-${cj}`;
        const cx = (di.absX+dj.absX)/2, cy = (di.absY+dj.absY)/2;
        const isNew = !rollCollisions.find(c => c.key === pairKey);
        if (isNew) {
          rollCollisions.push({ key: pairKey, faces: [di.face, dj.face] });
          burst(cx, cy, '#b8924a', 14, 4.5);
          burst(cx, cy, '#ffffff', 6, 6);
          screenShake(2.2);
          playTone(90 + Math.random()*40, 'square', 0.05, 0.06);
        } else {
          burst(cx, cy, '#b8924a', 4, 2.5);
        }
      }
    }

    // Pass 2: AABB positional correction — separate on axis of min penetration
    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      for (let ci = 0; ci < dice.length - 1; ci++) {
        for (let cj = ci + 1; cj < dice.length; cj++) {
          const di = dice[ci], dj = dice[cj];
          if (di.locked || dj.locked) continue;
          const dx = dj.absX - di.absX, dy = dj.absY - di.absY;
          const ox = side - Math.abs(dx);
          const oy = side - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          let pushX = 0, pushY = 0;
          if (ox < oy) pushX = (dx >= 0 ? 1 : -1) * ox;
          else         pushY = (dy >= 0 ? 1 : -1) * oy;
          const iMove = di.rolling || !dj.rolling;
          const jMove = dj.rolling || !di.rolling;
          const iW = iMove ? (jMove ? 0.5 : 1.0) : 0;
          const jW = jMove ? (iMove ? 0.5 : 1.0) : 0;
          di.absX -= pushX * iW; di.absY -= pushY * iW;
          dj.absX += pushX * jW; dj.absY += pushY * jW;
          moved = true;
        }
      }
      if (!moved) break;
    }

    // Pass 3: boundary clamp — only dice in play (not held in the tray)
    for (const d of dice) {
      if (d.locked) continue;
      d.absX = Math.max(bL, Math.min(bR, d.absX));
      d.absY = Math.max(bT, Math.min(bB, d.absY));
    }
  }

  // Decay screen shake
  shakeAmp = Math.max(0, shakeAmp - dt * 22);

  updateParticles(dt);
  updateFloaters(dt);
  updateComboPop(dt);
  updateBanner(dt);

  // Apply screen shake via canvas transform
  ctx.save();
  if (shakeAmp > 0.1) {
    const sx = (Math.random()*2-1) * shakeAmp;
    const sy = (Math.random()*2-1) * shakeAmp;
    ctx.translate(sx, sy);
  }
  switch (screen) {
    case 'title':      drawTitle(t);      break;
    case 'name_entry': drawNameEntry(t);  break;
    case 'game':       drawGame(t);       break;
    case 'shop':   drawShop(t);   break;
    case 'hub':    drawHub(t);    break;
    case 'forge':  drawForge(t);  break;
    case 'win':    drawWin(t);    break;
    case 'scores': drawScores(t); break;
  }
  ctx.restore();

  requestAnimationFrame(loop);
}

// ─── Boot ─────────────────────────────────────────────────────────────
loadScores();
screen = incoming.fromPortal ? 'game' : 'title';
if (incoming.fromPortal) { playerName = incoming.username || 'Wanderer'; startRun(false); }

requestAnimationFrame(loop);
