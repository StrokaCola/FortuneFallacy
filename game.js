// FortuneFallacy — Vibe Coding Game Jam #1
// Balatro-style dice roguelike. Roll. Score. Defy the fallacy.

const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
const W = canvas.width;   // 960
const H = canvas.height;  // 540

// ─── Physics constants (edit via physics-editor.html) ────────────────
const PHYSICS = (()=>{
  const saved = localStorage.getItem('ff_physics');
  const defaults = {
    throwSpeedX:          700,
    throwSpeedY:          400,
    launchBounceBase:      55,
    launchBounceRand:      20,
    initSpinXY:            70,
    initSpinZ:             40,
    rollDurBase:         0.65,
    rollDurStagger:     0.055,
    rollDurRand:         0.10,
    tumblePhase:         0.78,
    tumbleRate:         0.055,
    spinCoupling:        0.30,
    spinFriction:        0.25,
    gravity:              260,
    floorRestitution:    0.48,
    hopThreshold:          60,
    maxHops:                4,
    hopBaseVel:            12,
    hopRandVel:             6,
    hopSpeedFactor:      0.012,
    landingSpinX:          12,
    landingSpinZ:          10,
    landingFriction:     0.84,
    airDrag:             0.72,
    groundFriction:      0.12,
    wallRestitution:     0.78,
    wallSpinY:           0.03,
    wallSpinZ:          0.022,
    collisionRestitution: 0.82,
    collisionGap:           2,
    collisionSpin:       0.09,
    collisionHopThreshold: 35,
    collisionHopBase:       5,
    collisionHopFactor:  0.022,
    landBounceVel:          9,
    glideSpeed:         0.001,
  };
  if (!saved) return defaults;
  try { return Object.assign({}, defaults, JSON.parse(saved)); } catch { return defaults; }
})();

// ─── Portal setup ────────────────────────────────────────────────────
const incoming   = Portal.readPortalParams();
const nextTarget = await Portal.pickPortalTarget();

// ─── Audio Engine (Web Audio API, no library) ────────────────────────
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// ─── Volume state ────────────────────────────────────────────────────
let musicVolume = parseFloat(localStorage.getItem('ff_musicVol') ?? '0.5');
let sfxVolume   = parseFloat(localStorage.getItem('ff_sfxVol')   ?? '0.8');
let dragSlider  = null; // 'music' | 'sfx' | null

let _masterNode   = null;
let _sfxGainNode  = null;
function getMaster() {
  if (_masterNode) return _masterNode;
  const ac   = getAudio();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 8;
  comp.ratio.value = 6;       comp.attack.value = 0.003; comp.release.value = 0.1;
  const g = ac.createGain(); g.gain.value = 0.88;
  _sfxGainNode = ac.createGain(); _sfxGainNode.gain.value = sfxVolume;
  comp.connect(g); g.connect(_sfxGainNode); _sfxGainNode.connect(ac.destination);
  _masterNode = comp;
  return comp;
}

// ─── Background music ─────────────────────────────────────────────────
const bgMusic    = new Audio('./bg-music.mp3');
bgMusic.loop     = true;
bgMusic.volume   = musicVolume;
let   bgStarted  = false;
function ensureBgMusic() {
  if (bgStarted) return;
  bgStarted = true;
  bgMusic.play().catch(() => { bgStarted = false; });
}

function playTone(freq, type, duration, gainVal = 0.18, delay = 0, pitchEnd = 0) {
  try {
    const ac = getAudio(), t0 = ac.currentTime + delay;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.connect(g); g.connect(getMaster());
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (pitchEnd > 0) osc.frequency.exponentialRampToValueAtTime(Math.max(10, pitchEnd), t0 + duration * 0.75);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainVal, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.start(t0); osc.stop(t0 + duration + 0.05);
  } catch {}
}

function playNoise(duration, gainVal = 0.12, delay = 0, filterFreq = 800, filterQ = 0.9) {
  try {
    const ac = getAudio(), t0 = ac.currentTime + delay;
    const len = Math.floor(ac.sampleRate * (duration + 0.05));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(), g = ac.createGain();
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = filterFreq; flt.Q.value = filterQ;
    src.buffer = buf; src.connect(flt); flt.connect(g); g.connect(getMaster());
    g.gain.setValueAtTime(gainVal, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.start(t0); src.stop(t0 + duration + 0.05);
  } catch {}
}

const SFX = {
  roll() {
    playNoise(0.055, 0.22, 0, 1400, 0.8);
    playNoise(0.10,  0.10, 0.03, 500, 0.9);
    playTone(100, 'triangle', 0.09, 0.09, 0, 55);
  },
  lock() {
    playTone(900, 'square',   0.035, 0.10);
    playTone(450, 'sine',     0.13,  0.07, 0.008);
    playTone(1350,'sine',     0.05,  0.05, 0.004);
  },
  unlock() {
    playTone(675, 'sine', 0.07, 0.07);
    playTone(450, 'sine', 0.10, 0.05, 0.02);
  },
  playHand() {
    playNoise(0.05, 0.07, 0, 2200);
    playTone(330, 'triangle', 0.16, 0.11);
    playTone(494, 'triangle', 0.13, 0.09, 0.04);
    playTone(659, 'triangle', 0.11, 0.07, 0.08);
  },
  combo(tier) {
    const roots = [261,294,330,370,392,440,494,523,587];
    const root  = roots[Math.min(tier, roots.length-1)];
    const notes = [root, root*1.25, root*1.5];
    if (tier >= 5) notes.push(root*2);
    if (tier >= 7) notes.push(root*2.5);
    notes.forEach((f,i) => {
      playTone(f,   'triangle', 0.24+i*0.04, 0.13+tier*0.007, i*0.055);
      if (tier >= 4) playTone(f*2, 'sine', 0.14, 0.04, i*0.055+0.012);
    });
    if (tier >= 6) playTone(root*0.5, 'sine', 0.38, 0.16, 0);
  },
  tick(score, add=0) {
    const si    = scoreIntensity(score);
    const addSI = Math.min(1, Math.log2(Math.max(1, add)) / 4.5);
    const pent  = [261,294,330,392,440,523,587,659,784,1047];
    const idx   = Math.min(Math.floor((si*0.55 + addSI*0.45) * (pent.length-1)), pent.length-1);
    const f     = pent[idx];
    const vol   = 0.026 + si*0.024 + addSI*0.024;
    // Core + chorus detune
    playTone(f,        'triangle', 0.06+addSI*0.04, vol);
    playTone(f*1.005,  'sine',     0.04+addSI*0.02, vol*0.45, 0.005);
    // Sub snap
    playTone(f*0.5,    'sine',     0.022,            vol*0.55, 0,    f*0.06);
    // Harmonics grow with add size
    if (addSI > 0.25) playTone(f*2,    'sine', 0.036, vol*0.52, 0.010);
    if (addSI > 0.50) playTone(f*3,    'sine', 0.026, vol*0.36, 0.018);
    if (addSI > 0.70) playTone(f*4,    'sine', 0.018, vol*0.26, 0.026);
    if (addSI > 0.75) playTone(f*0.25, 'sine', 0.038, vol*0.70, 0.000);
    // Attack transient noise for big hits
    if (addSI > 0.60) playNoise(0.018, 0.018, 0, 1400);
  },
  multTick(m=1) {
    const si   = Math.min(1, Math.log2(Math.max(1, m)) / 4);
    const base = 220 + si*160;
    // Warm chord: root + chorus + fifth + octave
    playTone(base,        'triangle', 0.09, 0.08+si*0.06);
    playTone(base*1.004,  'sine',     0.06, 0.05+si*0.03, 0.006);
    playTone(base*1.5,    'sine',     0.07, 0.045,         0.016);
    if (si > 0.30) playTone(base*2,   'sine', 0.055, 0.030, 0.026);
    if (si > 0.55) playTone(base*4,   'sine', 0.030, 0.016, 0.040);
    if (si > 0.50) playTone(base*0.5, 'sine', 0.042, 0.038, 0.000);
  },
  mult(m=1) {
    const si   = Math.min(1, Math.log2(Math.max(1,m))/4);
    const base = 110+si*150;
    // Sub bass foundation
    playTone(base*0.5,    'sine',     0.36, 0.16+si*0.10, 0.000);
    // Root + chorus
    playTone(base,        'sine',     0.38, 0.14+si*0.12, 0.010);
    playTone(base*1.003,  'triangle', 0.30, 0.09+si*0.06, 0.010);
    // Fifth
    playTone(base*1.5,    'triangle', 0.30, 0.09+si*0.07, 0.028);
    // Octave
    playTone(base*2,      'sine',     0.26, 0.07+si*0.06, 0.048);
    // Upper harmonics
    if (si>0.30) playTone(base*3,    'sine', 0.18, 0.05+si*0.04, 0.065);
    if (si>0.55) playTone(base*4,    'sine', 0.13, 0.035,          0.080);
    if (si>0.70) playTone(base*6,    'sine', 0.09, 0.022,          0.095);
    // Noise body
    playNoise(0.09+si*0.06, 0.06+si*0.05, 0,     260+si*180);
    if (si>0.50) playNoise(0.045, 0.035, 0.030, 1800+si*800);
  },
  bigScore(score=0) {
    const si   = scoreIntensity(score);
    const root = 261*(1+si*1.4);
    // Deep sub bass hits
    playTone(root*0.25,   'sine',     0.40, 0.22+si*0.12, 0.000);
    playTone(root*0.5,    'sine',     0.46, 0.20+si*0.10, 0.006);
    // Main chord arpeggio — triangle + chorus sine for each note
    [1, 1.25, 1.5, 2, 2.5, 3].forEach((r, i) => {
      playTone(root*r,        'triangle', 0.42+si*0.18, 0.15+si*0.09, i*0.048);
      playTone(root*r*1.004,  'sine',     0.24+si*0.08, 0.07+si*0.04, i*0.048+0.009);
    });
    // Sparkle bell layer — high bright tones
    if (si>0.20) playTone(root*4,  'sine', 0.18, 0.05+si*0.04, 0.060);
    if (si>0.40) playTone(root*5,  'sine', 0.14, 0.035,          0.080);
    if (si>0.60) playTone(root*6,  'sine', 0.10, 0.025,          0.100);
    if (si>0.75) playTone(root*8,  'sine', 0.07, 0.016,          0.115);
    if (si>0.85) playTone(root*10, 'sine', 0.05, 0.010,          0.130);
    // Noise layers: body + sub thud + air
    playNoise(0.11+si*0.09, 0.09+si*0.07, 0.000, 900+si*700);
    if (si>0.30) playNoise(0.07,   0.06,           0.028, 380+si*250);
    if (si>0.55) playNoise(0.05,   0.04,           0.055, 2400+si*1200);
    if (si>0.75) playNoise(0.04,   0.025,          0.090, 180);
  },
  oracle()  { [523,659,784,1047].forEach((f,i)=>{ playTone(f,'sine',0.24,0.09,i*0.07); playTone(f*1.006,'sine',0.18,0.03,i*0.07+0.01); }); },
  clear()   {
    [392,523,659,784,1047].forEach((f,i)=>{ playTone(f,'triangle',0.28,0.13,i*0.07); playTone(f*0.5,'sine',0.22,0.05,i*0.07); });
    playNoise(0.12, 0.04, 0.22, 650);
  },
  win()     { [261,330,392,523,659,784].forEach((f,i)=>{ playTone(f,'triangle',0.42,0.13,i*0.10); playTone(f*2,'sine',0.32,0.04,i*0.10+0.03); }); },
  fail()    {
    [440,330,247,185].forEach((f,i)=>{ playTone(f,'sawtooth',0.30,0.11,i*0.09); playTone(f*0.75,'square',0.22,0.05,i*0.09+0.02); });
    playNoise(0.10, 0.04, 0.28, 200);
  },
  portal()  {
    playNoise(0.4, 0.06, 0, 300);
    [261,330,523,659].forEach((f,i)=>{ playTone(f,'sine',0.32,0.08,i*0.08); playTone(f*1.01,'sine',0.26,0.03,i*0.08+0.01); });
  },
};

// ─── Particles ────────────────────────────────────────────────────────
const particles = [];

// Ring bursts — expanding hollow circles for impacts
const rings = [];
function ring(x, y, color, maxR = 55, duration = 0.4) {
  rings.push({ x, y, color, maxR, duration, age: 0 });
}
function updateRings(dt) {
  for (let i = rings.length-1; i >= 0; i--) {
    rings[i].age += dt;
    if (rings[i].age >= rings[i].duration) rings.splice(i, 1);
  }
}
function drawRings() {
  for (const r of rings) {
    const t    = r.age / r.duration;
    const ease = 1 - Math.pow(1-t, 2);
    const rad  = r.maxR * ease;
    const alp  = (1-t) * 0.88;
    const thick = (r.maxR > 100 ? 4 : 2.5) * (1-t) + 0.5;
    ctx.save();
    ctx.globalAlpha  = alp;
    ctx.strokeStyle  = r.color;
    ctx.shadowColor  = r.color;
    ctx.shadowBlur   = (r.maxR > 80 ? 22 : 12) * (1-t);
    ctx.lineWidth    = thick;
    ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, rad), 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
}

// Rapid shockwave: fires `count` rings in quick succession
function shockwave(x, y, color, count = 3, baseR = 40, gap = 35, dt = 60) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => ring(x, y, color, baseR + i * gap, 0.30 + i * 0.05), i * dt);
  }
}

// Sparks — fast thin streaks with gravity
function spark(x, y, color, n = 6, speed = 9) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.5 + Math.random()*0.5) * speed;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 1.5,
      r: 1.5, color, alpha: 1,
      life: 0.38 + Math.random()*0.22 + speed*0.010, age: 0,
      gravity: true, spark: true, len: 4 + speed*0.55 + Math.random()*5 });
  }
}

function burst(x, y, color, n = 10, speed = 4) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.4 + Math.random() * 0.6) * speed;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      r: 2.5 + Math.random()*3.5 + speed*0.18, color, alpha: 1,
      life: 0.65 + Math.random()*0.65 + speed*0.012, age: 0 });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.lavaDrop) {
      p.vy += 0.42;
      p.vx *= 0.98;
    } else {
      if (p.gravity) p.vy += 0.22;
      p.vx *= 0.88; p.vy *= 0.88;
    }
    p.x += p.vx; p.y += p.vy;
    p.age += dt;
    p.alpha = 1 - p.age / p.life;
    if (p.age >= p.life || (p.lavaDrop && p.y > H + 30)) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    if (p.spark) {
      const spd = Math.hypot(p.vx, p.vy);
      if (spd > 0.2) {
        const len = (p.len || 5) * (1 - p.age/p.life);
        ctx.strokeStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 4;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx/spd)*len, p.y - (p.vy/spd)*len);
        ctx.stroke();
      }
    } else if (p.lavaDrop) {
      const spd    = Math.hypot(p.vx, p.vy);
      const stretch = Math.max(1.3, 1 + spd * 0.20);
      const angle  = Math.atan2(p.vy, p.vx) - Math.PI / 2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      // Outer glow blob
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = p.r * 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 0.75, p.r * stretch, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pointed teardrop cap (trailing end = top before rotation)
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(-p.r * 0.6, -p.r * stretch * 0.6);
      ctx.quadraticCurveTo(0, -p.r * stretch * 2.2, p.r * 0.6, -p.r * stretch * 0.6);
      ctx.fill();
      // Hot core
      ctx.globalAlpha = Math.max(0, p.alpha) * 0.75;
      ctx.fillStyle = '#ffee66'; ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 0.32, p.r * stretch * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

// ─── Floating labels ──────────────────────────────────────────────────
const floaters = [];

function floatText(x, y, text, color, size = 18, opts = {}) {
  floaters.push({
    x, y, vy: -(opts.vy || 2.2), text, color, size, alpha: 1,
    life: opts.life || 1.5, age: 0, scale: 1, ts: 0,
    rot: (Math.random()-0.5) * 0.2,
    glow: opts.glow || 6, popScale: opts.popScale || 1.8,
  });
}

function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y += f.vy; f.vy *= 0.93;          // spring up and slow
    f.age += dt; f.ts += dt;
    // Bounce-pop: 1.6× → 0.9× → 1× over first 280ms
    const ps = f.popScale || 1.8;
    if (f.ts < 0.12)       f.scale = 1 + (ps - 1) * (f.ts / 0.12);
    else if (f.ts < 0.28)  f.scale = ps - (ps - 0.88) * ((f.ts - 0.12) / 0.16);
    else                   f.scale = 0.88 + 0.12 * Math.min(1, (f.ts - 0.28) / 0.14);
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
    ctx.shadowColor = f.color; ctx.shadowBlur = f.glow || 6;
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
// 0–1 log scale relative to max goal score (~50k)
function scoreIntensity(val) { return Math.min(1, Math.log10(Math.max(10, val)) / 4.7); }

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

// ─── Rapier init ──────────────────────────────────────────────────────
let RAPIER_LIB = null;  // set after dynamic import resolves

async function initRapier() {
  try {
    const mod = await import('./rapier/rapier.mjs');
    await mod.init({ module_or_path: './rapier/rapier_wasm3d_bg.wasm' });
    RAPIER_LIB = mod;
  } catch (e) {
    console.warn('Rapier unavailable, using legacy physics:', e.message);
    return;
  }

  const R   = RAPIER_LIB;
  const world = new R.World({ x: 0, y: -14, z: 0 });

  const tHW = (CP.w  - 20) / 2 / PHYS_SCALE;  // table half-width  ≈ 5.16
  const tHD = (BOARD_H - 20) / 2 / PHYS_SCALE; // table half-depth  ≈ 2.50
  const wH  = 3;

  // Floor — top surface at y = 0
  world.createCollider(
    R.ColliderDesc.cuboid(tHW + 1, 0.1, tHD + 1)
      .setTranslation(0, -0.1, 0).setRestitution(0.55).setFriction(0.25)
  );
  // Four walls
  world.createCollider(R.ColliderDesc.cuboid(0.1, wH, tHD + 1).setTranslation(-tHW - 0.1, wH, 0).setRestitution(0.55).setFriction(0.1));
  world.createCollider(R.ColliderDesc.cuboid(0.1, wH, tHD + 1).setTranslation( tHW + 0.1, wH, 0).setRestitution(0.55).setFriction(0.1));
  world.createCollider(R.ColliderDesc.cuboid(tHW + 1, wH, 0.1).setTranslation(0, wH, -tHD - 0.1).setRestitution(0.55).setFriction(0.1));
  world.createCollider(R.ColliderDesc.cuboid(tHW + 1, wH, 0.1).setTranslation(0, wH,  tHD + 0.1).setRestitution(0.55).setFriction(0.1));

  rapierWorld = world;
  console.log('Rapier3D ready — physics world active');
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

// Given accumulated render Euler angles, return the nearest canonical face (1-6)
function eulerToFace(rx, ry, rz) {
  let bestFace = 1, bestErr = Infinity;
  for (const [face, rot] of Object.entries(FACE_ROT)) {
    const dx = nearestCanon(rx, rot[0]) - rx;
    const dy = nearestCanon(ry, rot[1]) - ry;
    const dz = nearestCanon(rz, rot[2]) - rz;
    const err = dx*dx + dy*dy + dz*dz;
    if (err < bestErr) { bestErr = err; bestFace = +face; }
  }
  return bestFace;
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
const SERIF = "'Cinzel Decorative',Cinzel,'Palatino Linotype',Georgia,serif";

// Draws a dark-stone layered frame with corner sigils and an inner hairline.
function ornamentFrame(x, y, w, h, accent = '#5522bb', opts = {}) {
  const { bg = 'rgba(4,4,16,0.96)', inner = 'rgba(100,60,220,0.25)', corner = 8 } = opts;
  // Outer void-stone fill with a gentle vertical gradient
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, bg);
  g.addColorStop(1, 'rgba(3,2,12,0.97)');
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
  const hm = accent.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  const [ar, ag, ab] = hm ? [parseInt(hm[1],16), parseInt(hm[2],16), parseInt(hm[3],16)] : [200,153,96];
  const grad = ctx.createLinearGradient(cx - half, lineY, cx + half, lineY);
  grad.addColorStop(0,   `rgba(${ar},${ag},${ab},0)`);
  grad.addColorStop(0.5, `rgba(${ar},${ag},${ab},0.55)`);
  grad.addColorStop(1,   `rgba(${ar},${ag},${ab},0)`);
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

const EMBERS = Array.from({ length: 52 }, (_, i) => ({
  x: Math.random()*W, y: Math.random()*H,
  r: 0.6 + Math.random()*1.6, ph: Math.random()*Math.PI*2,
  drift: 0.06 + Math.random()*0.18,
  cyan: i % 3 === 0, // one-third are cyan, rest violet
}));

function drawBG(t) {
  ctx.fillStyle = '#040410';
  ctx.fillRect(0, 0, W, H);

  // Electric void bloom from top-center
  const g1 = ctx.createRadialGradient(W*0.5, -H*0.05, 20, W*0.5, H*0.4, W*0.75);
  g1.addColorStop(0,   'rgba(90,35,220,0.18)');
  g1.addColorStop(0.5, 'rgba(55,18,140,0.07)');
  g1.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

  // Deep cyan seep from bottom
  const g2 = ctx.createRadialGradient(W*0.5, H*1.05, 10, W*0.5, H*0.85, W*0.6);
  g2.addColorStop(0,   'rgba(0,90,170,0.10)');
  g2.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  // Slow void pulse
  const pulse = 0.975 + 0.025 * Math.sin(t * 0.7);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${Math.floor(165*pulse)},${Math.floor(170*pulse)},${Math.floor(220*pulse)},1)`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Arcane rings — slow-rotating concentric circles with tick marks
  ctx.save();
  const ringDefs = [
    { r: 148, color: '#7733ee', ticks: 6, speed:  0.040 },
    { r: 240, color: '#22aadd', ticks: 8, speed: -0.025 },
    { r: 332, color: '#5522bb', ticks: 6, speed:  0.016 },
  ];
  for (const rd of ringDefs) {
    const rot = t * rd.speed;
    ctx.globalAlpha = 0.055;
    ctx.strokeStyle = rd.color;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(W/2, H/2, rd.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 1.2;
    for (let k = 0; k < rd.ticks; k++) {
      const a = rot + (k / rd.ticks) * Math.PI * 2;
      const cos = Math.cos(a), sin = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(W/2 + cos * (rd.r - 6), H/2 + sin * (rd.r - 6));
      ctx.lineTo(W/2 + cos * (rd.r + 6), H/2 + sin * (rd.r + 6));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Drifting void motes — violet and cyan circles
  for (const s of EMBERS) {
    const a = 0.07 + 0.12 * Math.sin(t * 0.9 + s.ph);
    const y = (s.y - t * 5 * s.drift) % H;
    const yy = y < 0 ? y + H : y;
    ctx.fillStyle = s.cyan
      ? `rgba(34,170,220,${a.toFixed(2)})`
      : `rgba(110,55,230,${a.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(s.x, yy, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Heavy corner vignette — darkness presses in
  const g3 = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.22, W/2, H/2, Math.max(W,H)*0.78);
  g3.addColorStop(0,   'rgba(0,0,0,0)');
  g3.addColorStop(1,   'rgba(0,0,0,0.80)');
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
// Replace with your Firebase Realtime Database URL (e.g. https://your-project-default-rtdb.firebaseio.com/scores)
const FIREBASE_URL    = 'https://fortunefallacy-9908c-default-rtdb.firebaseio.com/scores';

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
  { id:'iron', name:'Iron Die', shortName:'IRON', icon:'⬡', color:'#aab8cc', cost:3, desc:'Minimum score value is 4', scoreMin:4 },
  { id:'lead', name:'Lead Die', shortName:'LEAD', icon:'⬡', color:'#4d4d4d', cost:5, desc:'Triggers 2x, but cannot be rerolled', noReroll:true, triggers:2 },
  { id:'gold', name:'Gold Die', shortName:'Gold', icon:'⚄', color:'#e1a523', cost:8, desc:'Triggers Twice', triggers:2, visual:{shape:'round',decoration:'text',label:'⚄',overlayOutline:'diamond'} },
  { id:'Aluminum', name:'Aluminum Die', shortName:'ALUMINUM', icon:'⚄', color:'#888899', cost:2, desc:'Tends to roll lower numbers', rollMin:1, rollMax:3, visual:{shape:'round',decoration:'pips',label:'⚄',pipPattern:'triangle'} },
  { id:'platinum', name:'Platinum Die', shortName:'PLAT', icon:'⚄', color:'#ffffff', cost:10, desc:'Triggers 3x' },
  { id:'brass', name:'Brass Die', shortName:'BRASS', icon:'⚄', color:'#98935d', cost:4, desc:'+2 Mult', multBonus:2 },
  { id:'copper', name:'Copper Die', shortName:'COPPER', icon:'⚄', color:'#b68d5d', cost:5, desc:'Tends to Roll Higher Numbers', rollMin:4, rollMax:6 },
  { id:'silver', name:'Silver', shortName:'SILVER', icon:'⚄', color:'#b5b5b5', cost:5, desc:'x1.5 Multipier', scoreMultiplier:1.5, visual:{shape:'round',decoration:'outline',label:'⚄',outlineShape:'diamond'} }
];

// ─── Rune definitions ─────────────────────────────────────────────────
const ALL_RUNES = [
  { id:'amplify',   name:'Amplify',   tier:'common',   icon:'⬆', color:'#7799ee', cost:2,
    desc:'+2 to scored value',           scoreBonus:2 },
  { id:'gilded',    name:'Gilded',    tier:'common',   icon:'◆', color:'#c89960', cost:2,
    desc:'+1 ◆ shard on score',          shardsBonus:1 },
  { id:'blessed',   name:'Blessed',   tier:'common',   icon:'✦', color:'#ddcc55', cost:3,
    desc:'Scores at least 4',            scoreMin:4 },
  { id:'sharpened', name:'Sharpened', tier:'common',   icon:'▲', color:'#88bbaa', cost:3,
    desc:'+1 Mult when scoring',         multBonus:1 },
  { id:'echo',      name:'Echo',      tier:'uncommon', icon:'◎', color:'#55ccaa', cost:5,
    desc:'Scores one extra time',        triggers:2 },
  { id:'dark',      name:'Dark',      tier:'uncommon', icon:'☽', color:'#9955dd', cost:4,
    desc:'Score = 7 − face value',       invert:true },
  { id:'volatile',  name:'Volatile',  tier:'uncommon', icon:'?', color:'#ff6644', cost:4,
    desc:'Scores a random d10',          volatile:10 },
  { id:'surge',     name:'Surge',     tier:'uncommon', icon:'⚡', color:'#ffcc22', cost:5,
    desc:'+1 Mult per reroll used',      rerollMult:true },
  { id:'anchor',    name:'Anchor',    tier:'rare',     icon:'⚓', color:'#aabbcc', cost:7,
    desc:'×2 score — cannot reroll',     scoreMultiplier:2, noReroll:true },
  { id:'mirror_r',  name:'Mirror',    tier:'rare',     icon:'◈', color:'#88ddff', cost:8,
    desc:'Copies highest held face',     mirror:true },
  { id:'resonance', name:'Resonance', tier:'rare',     icon:'≋', color:'#cc88ff', cost:7,
    desc:'+3 Chips per die collision',   collisionBonus:3 },
  { id:'sovereign', name:'Sovereign', tier:'legendary',icon:'♛', color:'#ffaa44', cost:12,
    desc:'Scores three times',           triggers:3 },
];
const RUNE_TIERS = { common:'#778899', uncommon:'#44bb66', rare:'#9955ee', legendary:'#c89960' };
const MAX_RUNE_SLOTS = 2;

// ─── Unlockable items ─────────────────────────────────────────────────
const UNLOCKABLE_DICE = [
  { id:'void_die',   name:'Void Die',   shortName:'VOID', icon:'◈', color:'#aa44ff', cost:7,
    desc:'Scores 0 chips but +5 Mult',
    voidBonus:5, noReroll:true,
    unlock:{ id:'void_die',   label:'Score a Five of a Kind', req:{type:'score_combo',value:'five_of_a_kind'} },
    visual:{ shape:'round', decoration:'outline', outlineShape:'hexagram' } },
  { id:'lucky_die',  name:'Lucky Die',  shortName:'LUCK', icon:'☘', color:'#ffdd44', cost:5,
    desc:'Min score 3 — +1 Mult per reroll used',
    scoreMin:3, rerollMult:true,
    unlock:{ id:'lucky_die',  label:'Clear Goal 2', req:{type:'clear_goal',value:2} },
    visual:{ shape:'round', decoration:'text', label:'☘' } },
  { id:'runic_die',  name:'Runic Die',  shortName:'RUNE', icon:'✦', color:'#cc44ff', cost:8,
    desc:'Score ×2 — −1 Mult',
    scoreMultiplier:2, multPenalty:1,
    unlock:{ id:'runic_die',  label:'Clear Goal 5', req:{type:'clear_goal',value:5} },
    visual:{ shape:'hex', decoration:'text', label:'✦' } },
];

const UNLOCKABLE_RUNES = [
  { id:'rune_haste',    name:'Haste',    tier:'uncommon', icon:'⚑', color:'#44ddaa', cost:5,
    desc:'+2 ◆ shards on score',  shardsBonus:2,
    unlock:{ id:'rune_haste',    label:'Spend 15 shards in a single run', req:{type:'spend_shards',value:15} } },
  { id:'rune_potent',   name:'Potent',   tier:'rare',     icon:'⚜', color:'#ff88cc', cost:7,
    desc:'+3 to score and +1 Mult', scoreBonus:3, multBonus:1,
    unlock:{ id:'rune_potent',   label:'Clear Goal 3', req:{type:'clear_goal',value:3} } },
  { id:'rune_overload', name:'Overload', tier:'legendary',icon:'⚡', color:'#ff4400', cost:12,
    desc:'Score ×3 — cannot reroll this die', scoreMultiplier:3, noReroll:true,
    unlock:{ id:'rune_overload', label:'Clear Goal 6', req:{type:'clear_goal',value:6} } },
];

const UNLOCKABLE_ORACLES = [
  { id:'the_gambler',  name:'The Gambler',   tier:'uncommon', icon:'🎲', color:'#ff6644',
    effect:'+2 Mult for each reroll you have left when scoring',
    flavor:'"Fortune favours the reckless."',
    unlock:{ id:'the_gambler',  label:'Clear Goal 1', req:{type:'clear_goal',value:1} },
    apply(combo, faces, chips, mult) { return [chips, mult + rerollsLeft * 2]; } },
  { id:'momentum',     name:'Momentum',      tier:'rare',     icon:'▶', color:'#44ccff',
    effect:'+1 Mult for each consecutive hand played without rerolling (stacks this round)',
    flavor:'"Keep moving. Never stop."',
    unlock:{ id:'momentum',     label:'Clear Goal 4', req:{type:'clear_goal',value:4} },
    apply(combo, faces, chips, mult, meta) {
      if (!meta.lastReroll) momentumStreak++;
      else momentumStreak = 0;
      return [chips, mult + Math.max(0, momentumStreak - 1)];
    } },
  { id:'the_collector',name:'The Collector', tier:'legendary',icon:'♜', color:'#ffaa44',
    effect:'+3 Chips for each unique die upgrade type in your pool',
    flavor:'"Every piece matters."',
    unlock:{ id:'the_collector',label:'Own 4 or more upgraded dice', req:{type:'own_upgrades',value:4} },
    apply(combo, faces, chips, mult) {
      const types = new Set(diceUpgrades.filter(Boolean).map(d => d.id)).size;
      return [chips + types * 3, mult];
    } },
];

// ─── Combo tier colours ───────────────────────────────────────────────
// tier 0→8: chance → pair → two-pair → three-kind → sm-straight → full-house → lg-straight → four-kind → five-kind
const COMBO_COLORS = ['#556677','#5577bb','#6688cc','#7799dd','#88aaee','#dd4477','#cc44ff','#ff8833','#ffffff'];

// ─── Game state ───────────────────────────────────────────────────────
let screen = 'title';
let runGoal = 0;
let endless = false;
const ENDLESS_BASE = 100000;

let roundScore       = 0;
let displayRoundScore = 0;
let displayScoreBounce    = 0;   // 0–1, scale-pulse while counter ticks
let firstHandSpectrumGoal = -1;  // runGoal value when goal was cleared first-hand
let handsLeft        = HANDS_PER_ROUND;
let rerollsLeft      = REROLLS_PER_HAND;
let totalFateScore   = 0;

let dice       = [];
let rolledOnce = false;
let handInProgress = false;

let heldOracles  = [];
let comboStreak  = { id: null, count: 0 };
let lastHandMeta = { lastReroll: false };

let shopStock = { oracles: [], runes: [], upgrades: [] };
let shopTab   = 'oracles';
let highScores  = [];
let onlineScores  = [];
let onlineLoading = false;
let onlineFetched = false;
let scoresTab     = 'global';

let hoverX = -1, hoverY = -1;

// ─── Tray order / drag state ──────────────────────────────────────────
let trayOrder       = [];   // dice indices in held-tray slot order
let traySelSlot     = -1;
let pendingDragSlot = -1;   // slot pressed but not yet confirmed as drag
let dragTraySlot    = -1;   // active visual drag (-1 = none)
let dragStartX      = 0;
let dragStartY      = 0;
let dragOccurred    = false; // suppresses click event after a real drag

let scoringState    = null; // { chips, mult } — live display during hand scoring
let rollCollisions  = [];  // unique die-pair collisions recorded during current hand

let shards             = 0;
let diceUpgrades       = [];   // null | upgrade object, indexed by dice slot
let hubEarnedShards    = 0;
let forgeTab           = 'dice';
let forgeChoices       = { upgrades: [], oracles: [] };
let forgeSelectedUpgrade = null;

// ─── Rune state ───────────────────────────────────────────────────────
let runeInventory   = [];  // rune objects the player owns
let diceRunes       = [];  // Array(DICE_COUNT) of Array(MAX_RUNE_SLOTS): equipped runes
let runeSelInv      = null;  // index in runeInventory currently selected (null = none)
let runeSelSlot     = null;  // {die:i, slot:j} currently selected slot (null = none)

// ─── Pause state ─────────────────────────────────────────────────────
let paused        = false;
let pauseTab      = 'unlockables'; // 'unlockables' | 'quick' | 'audio'
let forgeOrigin   = 'hub';
let runeOrigin    = 'hub';

// ─── Unlock state ────────────────────────────────────────────────────
let unlockedIds    = new Set();
let runStats       = { fiveOfAKindScored: false, totalShardsSpent: 0, maxNoRerollStreak: 0, _noRerollCur: 0, handsPlayed: 0, combosScored: {}, runCompleted: false };
let momentumStreak = 0;
const UNLOCKS_KEY  = 'fortunefallacy_unlocks';

function loadUnlocks() {
  try { const d = JSON.parse(localStorage.getItem(UNLOCKS_KEY)); if (d) unlockedIds = new Set(d); } catch {}
}
function saveUnlocks() {
  try { localStorage.setItem(UNLOCKS_KEY, JSON.stringify([...unlockedIds])); } catch {}
}
function allUnlockableItems() {
  return [...UNLOCKABLE_DICE, ...UNLOCKABLE_RUNES, ...UNLOCKABLE_ORACLES];
}
function isUnlocked(id) { return unlockedIds.has(id); }

function evalUnlockReq(req) {
  if (!req) return false;
  switch (req.type) {
    case 'clear_goal':    return runGoal >= req.value;
    case 'score_combo':   return !!(runStats.combosScored[req.value]);
    case 'spend_shards':  return runStats.totalShardsSpent >= req.value;
    case 'own_upgrades':  return diceUpgrades.filter(Boolean).length >= req.value;
    case 'score_hands':   return runStats.handsPlayed >= req.value;
    case 'win_run':       return runStats.runCompleted;
    default:              return false;
  }
}

function checkUnlocks() {
  let any = false;
  for (const item of allUnlockableItems()) {
    const uid = item.unlock.id;
    if (unlockedIds.has(uid)) continue;
    if (evalUnlockReq(item.unlock.req)) {
      unlockedIds.add(uid);
      any = true;
      const name = item.name;
      setTimeout(() => showBanner(`✦ UNLOCKED: ${name} ✦`, item.color || '#c89960'), any ? 400 : 0);
    }
  }
  if (any) saveUnlocks();
}

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
  submitOnlineScore(name, score, mode);
}

async function fetchOnlineScores() {
  if (onlineLoading || FIREBASE_URL === 'YOUR_FIREBASE_URL_HERE') return;
  onlineLoading = true;
  try {
    const res = await fetch(`${FIREBASE_URL}.json?orderBy="$key"&limitToLast=200`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    onlineScores = data
      ? Object.values(data).sort((a, b) => b.score - a.score).slice(0, 10)
      : [];
  } catch {
    onlineScores = [];
  } finally {
    onlineLoading = false;
    onlineFetched = true;
  }
}

async function submitOnlineScore(name, score, mode) {
  if (FIREBASE_URL === 'YOUR_FIREBASE_URL_HERE') return;
  try {
    const res = await fetch(`${FIREBASE_URL}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, mode, date: Date.now() }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[FortuneFallacy] Score submit failed:', res.status, text);
      return;
    }
    onlineFetched = false;
    console.log('[FortuneFallacy] Score submitted:', name, score);
  } catch (e) {
    console.error('[FortuneFallacy] Score submit error:', e);
  }
}
function endlessUnlocked() {
  try { return !!localStorage.getItem('fortunefallacy_endless'); } catch { return false; }
}
function unlockEndless() {
  try { localStorage.setItem('fortunefallacy_endless', '1'); } catch {} }

// ─── Run management ───────────────────────────────────────────────────
function initDice() {
  rollCollisions = [];
  if (rapierWorld && dice) {
    for (const d of dice) {
      if (d.physBody) { rapierWorld.removeRigidBody(d.physBody); d.physBody = null; }
    }
  }
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
      pvx: 0, pvy: 0, physBody: null,
    };
  });
  rolledOnce      = false;
  trayOrder       = [];
  traySelSlot     = -1;
  pendingDragSlot = -1;
  dragTraySlot    = -1;
  dragOccurred    = false;
}

function startRun(isEndless = false) {
  endless        = isEndless;
  runGoal        = 0;
  totalFateScore = 0;
  heldOracles    = [];
  comboStreak    = { id:null, count:0 };
  shards         = 0;
  diceUpgrades   = Array(DICE_COUNT).fill(null);
  diceRunes      = Array.from({length: DICE_COUNT}, () => Array(MAX_RUNE_SLOTS).fill(null));
  runeInventory  = [];
  runeSelInv  = null;
  runeSelSlot = null;
  runStats    = { fiveOfAKindScored: false, totalShardsSpent: 0, maxNoRerollStreak: 0, _noRerollCur: 0, handsPlayed: 0, combosScored: {}, runCompleted: false };
  momentumStreak = 0;
  nameEntry   = playerName;
  screen      = 'nameentry';
}

function grantRune(tier = 'common') {
  const allRunes = [...ALL_RUNES, ...UNLOCKABLE_RUNES.filter(r => isUnlocked(r.unlock.id))];
  const pool = allRunes.filter(r => r.tier === tier);
  if (pool.length) runeInventory.push(pool[Math.floor(Math.random() * pool.length)]);
}

function confirmPlayerName() {
  playerName = nameEntry.trim() || 'Wanderer';
  nameEntry  = playerName;
  localStorage.setItem('fortunefallacy_player', playerName);
  screen = 'hub';
}

function startRound() {
  roundScore        = 0;
  displayRoundScore     = 0;
  displayScoreBounce    = 0;
  firstHandSpectrumGoal = -1;
  handsLeft             = HANDS_PER_ROUND;
  rerollsLeft       = REROLLS_PER_HAND;
  handInProgress    = false;
  lastHandMeta      = { lastReroll: false };
  momentumStreak    = 0;
  initDice();
}

function sellDie(idx) {
  if (diceUpgrades.length <= 1) return; // keep at least 1 die
  for (const r of (diceRunes[idx] || [])) { if (r) runeInventory.push(r); }
  const upg = diceUpgrades[idx];
  const refund = upg ? Math.floor(upg.cost / 2) : 1;
  shards += refund;
  if (refund > 0) floatText(W/2, H/2 - 30, `+◆${refund}`, '#b8a874', 16);
  diceUpgrades.splice(idx, 1);
  diceRunes.splice(idx, 1);
  trayOrder = trayOrder.filter(i => i !== idx).map(i => i > idx ? i - 1 : i);
  if (traySelSlot >= trayOrder.length) traySelSlot = -1;
  SFX.unlock();
  burst(W/2, H/2, '#ff4466', 8, 3);
}

function currentTarget() {
  if (!endless) return GOAL_TARGETS[runGoal];
  return Math.floor(ENDLESS_BASE * Math.pow(2, runGoal));
}

function goalLabel() {
  return endless ? `Endless ${runGoal + 1}` : `Goal ${runGoal + 1} / ${GOAL_TARGETS.length}`;
}

// ─── Natural settle (Rapier path) ─────────────────────────────────────
function settleDie(d, dIdx) {
  if (!d.rolling) return;
  if (d.physBody && rapierWorld) {
    const tr = d.physBody.translation();
    const hs = DICE_SIZE / 2;
    const bL = CP.x + 10 + hs, bR = CP.x + CP.w - 10 - hs;
    const bT = BOARD_Y + 10 + hs, bB = BOARD_Y + BOARD_H - 10 - hs;
    d.absX    = Math.max(bL, Math.min(bR, PHYS_CX + tr.x * PHYS_SCALE));
    d.absY    = Math.max(bT, Math.min(bB, PHYS_CZ + tr.z * PHYS_SCALE));
    d.bounceY = 0;
    rapierWorld.removeRigidBody(d.physBody);
    d.physBody = null;
  }
  const rawFace = eulerToFace(d.rx, d.ry, d.rz);
  d.face = Math.max(d.faceMin ?? 1, Math.min(d.faceMax ?? 6, rawFace));
  d.rolling  = false;
  d.settling = false;
  d.pvx = 0; d.pvy = 0;
  d.homeX = d.absX; d.homeY = d.absY;
  const [trx, try_, trz] = FACE_ROT[d.face];
  d.rx = trx; d.ry = try_; d.rz = trz;
  d.landT = 0;
  d.revealT = 0;
  d.bounceVY = -PHYSICS.landBounceVel;
  const upgC = diceUpgrades[dIdx] ? diceUpgrades[dIdx].color : '#c89960';
  burst(d.absX, d.absY + DICE_SIZE * 0.35, upgC,    10, 3.2);
  burst(d.absX, d.absY + DICE_SIZE * 0.35, '#ffffff',  5, 4.0);
  spark(d.absX, d.absY + DICE_SIZE * 0.35, upgC, 8, 10);
  ring(d.absX, d.absY, upgC, 38, 0.32);
  playTone(130 + d.face * 22, 'triangle', 0.15 + scoreIntensity(roundScore) * 0.10, 0.12 + scoreIntensity(roundScore) * 0.06);
  playTone(260 + d.face * 22, 'sine', 0.06, 0.18);
  screenShake(6 + d.face * 0.6 + scoreIntensity(roundScore) * 6);
  if (!dice.some(x => x.rolling)) {
    rolledOnce = true;
    screenShake(8 + scoreIntensity(roundScore) * 8);
  }
}

// ─── Dice rolling ─────────────────────────────────────────────────────
function rollDice() {
  if (handInProgress) return;
  const targets = rolledOnce
    ? dice.filter((d,i) => !d.locked && !diceUpgrades[i]?.noReroll && !(diceRunes[i]||[]).some(r=>r?.noReroll))
    : dice;
  if (targets.length === 0) return;
  SFX.roll();
  screenShake(4 + scoreIntensity(roundScore) * 6);

  targets.forEach((d, i) => {
    const dIdx = dice.indexOf(d);
    const rupg = diceUpgrades[dIdx];
    d.faceMin = rupg?.rollMin ?? 1;
    d.faceMax = rupg?.rollMax ?? 6;
    d.rolling = true;
    d.rollT   = 0;
    d.rollDur = PHYSICS.rollDurBase + i * PHYSICS.rollDurStagger + Math.random() * PHYSICS.rollDurRand;
    d.settling = false;
    d.settleFrames = 0;
    // Wild spin
    d.vx = (Math.random() - 0.5) * PHYSICS.initSpinXY;
    d.vy = (Math.random() - 0.5) * PHYSICS.initSpinXY;
    d.vz = (Math.random() - 0.5) * PHYSICS.initSpinZ;
    // Anticipation bounce — stronger launch
    d.bounceY  = 0;
    d.bounceVY = -(PHYSICS.launchBounceBase + Math.random() * PHYSICS.launchBounceRand);
    // Table throw — guaranteed minimum speed so every die travels visibly
    const throwAngle = Math.random() * Math.PI * 2;
    const throwMin   = PHYSICS.throwSpeedX * 0.45;
    const throwMax   = PHYSICS.throwSpeedX * 1.0;
    const throwMag   = throwMin + Math.random() * (throwMax - throwMin);
    d.pvx = Math.cos(throwAngle) * throwMag;
    d.pvy = Math.sin(throwAngle) * throwMag * (PHYSICS.throwSpeedY / PHYSICS.throwSpeedX);
    d.bounceCount = 0;
    if (rapierWorld && RAPIER_LIB) {
      // Rapier path: face determined on natural settle — set placeholder for safety
      d.face = 1;
      if (d.physBody) { rapierWorld.removeRigidBody(d.physBody); d.physBody = null; }
      const R = RAPIER_LIB;
      const physX = (d.absX - PHYS_CX) / PHYS_SCALE;
      const physZ = (d.absY - PHYS_CZ) / PHYS_SCALE;
      const physY = RAPIER_DIE_HALF + 0.4 + Math.random() * 0.4;
      d.physBody = rapierWorld.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(physX, physY, physZ)
          .setLinearDamping(0.05)
          .setAngularDamping(0.3)
      );
      rapierWorld.createCollider(
        R.ColliderDesc.cuboid(RAPIER_DIE_HALF, RAPIER_DIE_HALF, RAPIER_DIE_HALF)
          .setRestitution(0.5).setFriction(0.3),
        d.physBody
      );
      // Velocity: X/Z = table throw, Y = upward bounce launch
      d.physBody.setLinvel({ x: d.pvx / PHYS_SCALE, y: -d.bounceVY / PHYS_SCALE, z: d.pvy / PHYS_SCALE }, true);
      // Angular velocity coupled to throw direction so die looks like it's rolling
      const physVX = d.pvx / PHYS_SCALE, physVZ = d.pvy / PHYS_SCALE;
      const rollX = physVZ / RAPIER_DIE_HALF + (Math.random() - 0.5) * 6;
      const rollZ = -physVX / RAPIER_DIE_HALF + (Math.random() - 0.5) * 6;
      d.physBody.setAngvel({ x: rollX, y: (Math.random() - 0.5) * 4, z: rollZ }, true);
    } else {
      // Legacy path: predetermine face now
      d.face = d.faceMin + Math.floor(Math.random() * (d.faceMax - d.faceMin + 1));
      const [trx, try_, trz] = FACE_ROT[d.face];
      d.tRx = trx; d.tRy = try_; d.tRz = trz;
    }
  });

  // Legacy path: timer-based forced settle (Rapier uses per-die natural settle in update loop)
  if (!rapierWorld) {
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
          d.revealT = 0;
          d.bounceVY = -PHYSICS.landBounceVel;
          const upgC = diceUpgrades[dice.indexOf(d)] ? diceUpgrades[dice.indexOf(d)].color : '#c89960';
          burst(d.absX, d.absY + DICE_SIZE * 0.35, upgC,    10, 3.2);
          burst(d.absX, d.absY + DICE_SIZE * 0.35, '#ffffff',  5, 4.0);
          spark(d.absX, d.absY + DICE_SIZE * 0.35, upgC, 8, 10);
          ring(d.absX, d.absY, upgC, 38, 0.32);
          playTone(130 + d.face * 22, 'triangle', 0.15 + scoreIntensity(roundScore) * 0.10, 0.12 + scoreIntensity(roundScore) * 0.06);
          playTone(260 + d.face * 22, 'sine',     0.06, 0.18);
          screenShake(6 + d.face * 0.6 + scoreIntensity(roundScore) * 6);
        }, i * 60);
      });
      rolledOnce = true;
      setTimeout(() => screenShake(8 + scoreIntensity(roundScore) * 8), targets.length * 60);
    }, (maxDur + 0.12) * 1000);
  }
}

// ─── Play hand ────────────────────────────────────────────────────────
function playHand() {
  if (!rolledOnce || handInProgress) return;
  const heldEntries = trayOrder.map(i => ({ die: dice[i], upg: diceUpgrades[i] }));
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
    if (tier >= 6) {
      screenFlash(0.4);
      screenShake((tier >= 7 ? 10 : 6) + scoreIntensity(roundScore) * 6);
      ring(CP.x + CP.w/2, BOARD_Y + BOARD_H/2, '#c89960', 80 + tier*8, 0.55);
      spark(CP.x + CP.w/2, BOARD_Y + BOARD_H/2, '#c89960', 12, 12);
    }
    const burstN = [4,8,12,16,20,26,34,44,60][tier] || 10;
    const burstSpd = 4 + tier * 0.7;
    burst(W/2, H/2, COMBO_COLORS[tier] || '#c89960', burstN, burstSpd);
    if (tier >= 5) burst(W/2, H/2, '#ffffff', Math.floor(burstN/3), burstSpd * 1.3);

    const scoreQueue = [];
    for (let ei = 0; ei < heldEntries.length; ei++) {
      const entry   = heldEntries[ei];
      const dieIdx  = dice.indexOf(entry.die);
      const baseT   = (entry.upg && entry.upg.triggers > 1) ? entry.upg.triggers : 1;
      const runeT   = (diceRunes[dieIdx] || []).reduce((s, r) => s + (r && r.triggers > 1 ? r.triggers - 1 : 0), 0);
      const t       = baseT + runeT;
      for (let ti = 0; ti < t; ti++) scoreQueue.push(entry);
    }
    let dieIdx = 0;

    function scoreNext() {
      if (dieIdx >= scoreQueue.length) { applyModifiers(); return; }
      const entry = scoreQueue[dieIdx];
      const d   = entry.die;
      const upg = entry.upg;
      dieIdx++;
      d.scoring = true;
      d.scoringT = 0;
      let add   = d.face;
      const multBefore = mult;
      if (upg) {
        if (upg.scoreMin !== undefined)                    add = Math.max(add, upg.scoreMin);
        if (upg.faceRemap && add === upg.faceRemap.from)   add = upg.faceRemap.to;
        if (upg.invert)                                    add = 7 - d.face;
        if (upg.volatile !== undefined)                    add = 1 + Math.floor(Math.random() * upg.volatile);
        if (upg.mirror)                                    add = Math.max(...heldEntries.map(e => e.die.face));
        if (upg.collisionBonus !== undefined)              add += rollCollisions.length * upg.collisionBonus;
        if (upg.voidBonus !== undefined)                   { add = 0; mult += upg.voidBonus; scoringState.mult = mult; scoringState.multPunch = 1; }
        if (upg.scoreMultiplier !== undefined)             add = Math.round(add * upg.scoreMultiplier);
        if (upg.rerollMult)                                { mult += rerollsLeft; scoringState.mult = mult; scoringState.multPunch = 1; }
        if (upg.multBonus !== undefined)                   { mult += upg.multBonus; scoringState.mult = mult; scoringState.multPunch = 1; }
        if (upg.multPenalty !== undefined)                 { mult = Math.max(1, mult - upg.multPenalty); scoringState.mult = mult; }
        if (upg.shardsBonus !== undefined)                 { shards += upg.shardsBonus; floatText(d.absX, d.absY - 60, `+${upg.shardsBonus} ◆`, '#b8a874', 13); }
      }
      // Apply equipped rune effects
      const _dieIdx = dice.indexOf(d);
      for (const rune of (diceRunes[_dieIdx] || [])) {
        if (!rune) continue;
        if (rune.scoreBonus !== undefined)      add += rune.scoreBonus;
        if (rune.scoreMin !== undefined)        add = Math.max(add, rune.scoreMin);
        if (rune.invert)                        add = 7 - d.face;
        if (rune.volatile !== undefined)        add = 1 + Math.floor(Math.random() * rune.volatile);
        if (rune.mirror)                        add = Math.max(...heldEntries.map(e => e.die.face));
        if (rune.collisionBonus !== undefined)  add += rollCollisions.length * rune.collisionBonus;
        if (rune.scoreMultiplier !== undefined) add = Math.round(add * rune.scoreMultiplier);
        if (rune.rerollMult)                    { mult += rerollsLeft; scoringState.mult = mult; scoringState.multPunch = 1; }
        if (rune.multBonus !== undefined)       { mult += rune.multBonus; scoringState.mult = mult; scoringState.multPunch = 1; }
        if (rune.shardsBonus !== undefined)     { shards += rune.shardsBonus; floatText(d.absX, d.absY - 75, `+${rune.shardsBonus} ◆`, rune.color, 11); }
      }
      chips += add;
      scoringState.chips = chips;
      scoringState.chipPunch = 1;
      if (upg && upg.multPenalty) scoringState.multPunch = 1;

      const multDelta = mult - multBefore;

      // Progressive bar fill — update display score as chips land
      displayRoundScore = roundScore + chips;
      const addSI = Math.min(1, Math.log2(Math.max(1, add)) / 4.5);
      displayScoreBounce = Math.max(displayScoreBounce, 0.22 + addSI * 0.78);

      // Chip effects
      if (add > 0) {
        const txtColor = upg ? upg.color
          : add >= 25 ? '#ffffff' : add >= 15 ? '#ffe066' : add >= 8 ? '#ffb040' : '#c89960';
        const txtGlow  = 8 + addSI * 44;
        const txtPop   = 1.9 + addSI * 1.4;
        const txtLife  = 1.4 + addSI * 0.7;
        const txtSize  = 14 + Math.min(72, add * 5);
        floatText(d.absX, d.absY - 40, `+${add}`, txtColor, txtSize,
          { glow: txtGlow, popScale: txtPop, life: txtLife });

        // Tier label for big hits
        if      (add >= 35) floatText(d.absX, d.absY - 85, 'INSANE!!', '#ff2200', 30, {life:1.9, glow:50, popScale:3.2});
        else if (add >= 22) floatText(d.absX, d.absY - 82, 'MASSIVE!', '#ff6600', 26, {life:1.8, glow:38, popScale:2.8});
        else if (add >= 14) floatText(d.absX, d.absY - 78, 'HUGE!',    '#ffaa00', 22, {life:1.6, glow:26, popScale:2.4});
        else if (add >= 9)  floatText(d.absX, d.absY - 74, 'BIG!',     '#ffe066', 18, {life:1.4, glow:16, popScale:2.0});

        const burstN = 8 + Math.min(100, add * 6);
        burst(d.absX, d.absY, txtColor,    burstN,                    5  + addSI * 9);
        burst(d.absX, d.absY, '#ffffff',   Math.floor(burstN * 0.5),  7  + addSI * 10);
        if (add >= 7)  burst(d.absX, d.absY, '#ffee88', Math.floor(burstN * 0.3), 10 + addSI * 7);
        if (add >= 15) burst(d.absX, d.absY, '#ff6644', Math.floor(burstN * 0.2), 14 + addSI * 6);

        ring(d.absX, d.absY, txtColor, 30 + add * 5,  0.30 + addSI * 0.20);
        if (add >= 3)  ring(d.absX, d.absY, 'rgba(255,255,255,0.4)', 20 + add * 3, 0.24);
        if (add >= 5)  ring(RP.x + RP.w/2, RP.y + 91, txtColor, 22 + add * 4, 0.30);
        if (add >= 8)  ring(d.absX, d.absY, txtColor, 70 + add * 7, 0.46);
        if (add >= 13) ring(W/2, H/2, 'rgba(255,255,255,0.20)', 90 + add * 5, 0.62);

        if (add >= 8)  shockwave(d.absX, d.absY, txtColor, 2, 28, 38, 55);
        if (add >= 15) shockwave(d.absX, d.absY, txtColor, 3, 24, 44, 50);
        if (add >= 22) shockwave(W/2, H/2, 'rgba(255,255,255,0.22)', 3, 65, 55, 70);

        if (add >= 2)  spark(d.absX, d.absY, txtColor,  3 + Math.min(45, Math.floor(add * 2.2)), 8  + addSI * 14);
        if (add >= 6)  spark(d.absX, d.absY, '#ffffff', Math.floor(add * 0.9),                   11 + addSI * 11);
        if (add >= 13) spark(d.absX, d.absY, '#ffee88', Math.floor(add * 0.6),                   15 + addSI * 9);
        if (add >= 22) spark(W/2, H/2, txtColor,        Math.floor(add * 0.4),                   18 + addSI * 8);

        if (add >= 4)  screenFlash(0.04 + addSI * 0.28);
        if (add >= 10) screenFlash(0.12 + addSI * 0.52);
        screenShake(2 + Math.min(30, add * 1.1 + scoreIntensity(chips) * 10));
        SFX.tick(chips, add);
      }

      // Separate mult cue when this die also bumped the multiplier
      if (multDelta > 0) {
        const multLabel = Number.isInteger(multDelta) ? `×+${multDelta}` : `×+${multDelta.toFixed(1)}`;
        const multDelay = add > 0 ? 75 : 0;
        setTimeout(() => {
          floatText(d.absX, d.absY - (add > 0 ? 62 : 40), multLabel, '#ff9944', 14 + Math.min(10, multDelta * 2));
          burst(d.absX, d.absY, '#ff9944', 6 + Math.min(12, multDelta * 2), 3);
          ring(d.absX, d.absY, '#ff9944', 22 + multDelta * 3, 0.22);
          SFX.multTick(mult);
        }, multDelay);
      }

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

      const multSI = Math.min(1, Math.log2(Math.max(1, mult)) / 4);
      const multTxtSize = 22 + Math.min(48, mult * 4);
      SFX.mult(mult);
      floatText(W/2, H/2 + 30, `×${mult} Mult`, '#ff9944', multTxtSize,
        { glow: 12 + multSI * 50, popScale: 2.0 + multSI * 1.6, life: 1.6 + multSI * 0.6 });
      if (mult >= 8) floatText(W/2, H/2 + 5, 'MULTIPLIER!', '#ffcc44', 20, {life:1.5, glow:32, popScale:2.4});

      const mBN = 18 + Math.floor(multSI * 70);
      burst(W/2, H/2 + 30, '#ff9944',  mBN,                    5.5 + multSI * 8);
      burst(W/2, H/2 + 30, '#ffffff',  Math.floor(mBN * 0.55), 7.5 + multSI * 8);
      if (multSI > 0.15) burst(W/2, H/2 + 30, '#ffcc66', Math.floor(mBN * 0.35), 10 + multSI * 6);
      if (multSI > 0.50) burst(W/2, H/2,       '#ff6622', Math.floor(mBN * 0.20), 14 + multSI * 5);

      ring(W/2, H/2 + 30, '#ff9944', 50 + mult * 7,  0.38 + multSI * 0.22);
      ring(W/2, H/2 + 30, '#ffffff', 32 + mult * 4,  0.28 + multSI * 0.16);
      if (mult >= 2) ring(W/2, H/2, 'rgba(255,153,68,0.28)', 90 + mult * 9, 0.55);
      if (mult >= 3) ring(W/2, H/2, '#ff9944', 140 + mult * 12, 0.68);

      shockwave(W/2, H/2 + 30, '#ff9944', 2 + Math.floor(multSI * 4), 40, 50, 58);
      if (multSI > 0.5) shockwave(W/2, H/2, 'rgba(255,200,100,0.30)', 3, 80, 60, 75);

      if (mult >= 3) spark(W/2, H/2 + 30, '#ff9944', 8  + Math.floor(mult * 2.2), 9  + multSI * 12);
      if (mult >= 4) spark(W/2, H/2 + 30, '#ffffff', Math.floor(mult * 1.1),       12 + multSI * 9);
      if (mult >= 6) spark(W/2, H/2,       '#ffcc44', Math.floor(mult * 0.8),       15 + multSI * 8);

      if (multSI > 0.25) screenFlash(0.06 + multSI * 0.38);
      screenShake(8 + multSI * 26 + scoreIntensity(mult * chips) * 12);

      setTimeout(() => {
        const si = scoreIntensity(handScore);
        const scoreSize = 22 + Math.min(62, Math.log10(Math.max(1, handScore)) * 13);
        floatText(W/2, H/2 + 60, `= ${handScore.toLocaleString()}`, '#fff', scoreSize,
          { glow: 14 + si * 60, popScale: 2.2 + si * 1.8, life: 1.8 + si * 0.8, vy: 2.8 });

        const scoreBN = 24 + Math.floor(si * 120);
        burst(W/2, H/2 + 60, '#c89960',  scoreBN,                     6   + si * 9);
        burst(W/2, H/2 + 60, '#ffffff',  Math.floor(scoreBN * 0.60),   9   + si * 10);
        burst(W/2, H/2,       '#c89960', Math.floor(scoreBN * 0.40),   7   + si * 8);
        if (si > 0.20) burst(W/2, H/2 + 60, '#ffee88', Math.floor(scoreBN * 0.40), 12 + si * 8);
        if (si > 0.45) burst(W/2, H/2 + 60, '#ff8844', Math.floor(scoreBN * 0.25), 16 + si * 7);
        if (si > 0.70) burst(W/2, H/2,       '#ffffff', Math.floor(scoreBN * 0.20), 20 + si * 6);

        ring(W/2, H/2 + 60, '#c89960', 60  + si * 130, 0.50 + si * 0.24);
        ring(W/2, H/2 + 60, '#ffffff', 40  + si *  90, 0.38 + si * 0.22);
        ring(W/2, H/2,       '#c89960', 100 + si * 150, 0.65 + si * 0.20);
        if (si > 0.20) ring(W/2, H/2, 'rgba(255,255,255,0.22)', 150 + si * 120, 0.80);
        if (si > 0.55) ring(W/2, H/2, '#ffee88', 200 + si * 100, 0.90);

        shockwave(W/2, H/2 + 60, '#c89960', 3 + Math.floor(si * 5), 50,  55, 55);
        shockwave(W/2, H/2,       '#ffffff', 3 + Math.floor(si * 4), 80,  65, 65);
        if (si > 0.40) shockwave(W/2, H/2, '#ffee88', 3, 130, 70, 80);
        if (si > 0.70) shockwave(W/2, H/2, 'rgba(255,100,50,0.35)', 4, 100, 80, 60);

        spark(W/2, H/2 + 60, '#c89960', 10 + Math.floor(si * 45), 11 + si * 15);
        spark(W/2, H/2 + 60, '#ffffff', 6  + Math.floor(si * 30), 14 + si * 12);
        if (si > 0.35) spark(W/2, H/2, '#ffee88',  Math.floor(si * 28), 17 + si * 10);
        if (si > 0.60) spark(W/2, H/2, '#ff8844',  Math.floor(si * 20), 20 + si * 9);
        if (si > 0.80) spark(W/2, H/2, '#ffffff',  Math.floor(si * 15), 24 + si * 8);

        screenShake(11 + si * 42);
        screenFlash(Math.min(0.95, 0.18 + si * 0.77));
        SFX.bigScore(handScore);

        animateTicker(displayRoundScore, newTotal, 0.60, v => { displayRoundScore = v; displayScoreBounce = Math.max(displayScoreBounce, 0.9); }, () => {
          roundScore = newTotal; displayRoundScore = newTotal;
          handsLeft--; rerollsLeft = REROLLS_PER_HAND;
          rolledOnce = false; handInProgress = false; scoringState = null;
          // Track run stats for unlock conditions
          if (combo.id === 'five_of_a_kind') runStats.fiveOfAKindScored = true;
          runStats.handsPlayed++;
          runStats.combosScored[combo.id] = (runStats.combosScored[combo.id] || 0) + 1;
          if (!lastHandMeta.lastReroll) runStats._noRerollCur++;
          else runStats._noRerollCur = 0;
          runStats.maxNoRerollStreak = Math.max(runStats.maxNoRerollStreak, runStats._noRerollCur);
          checkUnlocks();
          initDice();

          if (roundScore >= currentTarget()) {
            if (handsLeft === HANDS_PER_ROUND - 1) firstHandSpectrumGoal = runGoal;
            advanceGoal();
          } else if (handsLeft <= 0) {
            setTimeout(() => {
              SFX.fail();
              const name = nameEntry.trim() || incoming.username || 'Wanderer';
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
  ring(CP.x + CP.w/2, BOARD_Y + BOARD_H/2, '#c89960', 160, 0.65);
  ring(CP.x + CP.w/2, BOARD_Y + BOARD_H/2, '#ffffff',  90, 0.45);
  spark(CP.x + CP.w/2, BOARD_Y + BOARD_H/2, '#c89960', 18, 14);
  burst(W/2, H/2, '#c89960', 50, 7);
  burst(W/2, H/2, '#aa66ff', 25, 5);
  burst(W/2, H/2, '#ffffff', 18, 9);

  setTimeout(() => {
    const clearedTarget = currentTarget();
    runGoal++;
    if (!endless && runGoal >= GOAL_TARGETS.length) {
      SFX.win();
      unlockEndless();
      runStats.runCompleted = true;
      checkUnlocks();
      nameEntry       = '';
      nameEntryActive = false;
      screen = 'win';
      return;
    }
    // Award shards for goal clear
    const earned = Math.max(3, Math.floor(5 + (roundScore - clearedTarget) / 200));
    shards += earned;
    hubEarnedShards = earned;
    // Check unlocks after goal advance
    checkUnlocks();
    forgeChoices = { upgrades: [], oracles: [] };
    openShop();
  }, 1800);
}

function openShop() {
  // Anomalies — weighted pool (legendaries scarce)
  const allOraclesFull = [...ALL_ORACLES, ...UNLOCKABLE_ORACLES.filter(o => isUnlocked(o.unlock.id))];
  const unownedO = allOraclesFull.filter(o => !heldOracles.find(h => h.id === o.id));
  const oWeights = { common: 3, uncommon: 2, rare: 1.3, legendary: 0.5 };
  const oPool = [];
  unownedO.forEach(o => {
    const n = Math.round((oWeights[o.tier || 'common']) * 2);
    for (let i = 0; i < n; i++) oPool.push(o);
  });
  const pickedO = [];
  while (pickedO.length < 3 && oPool.length > 0) {
    const i = Math.floor(Math.random() * oPool.length);
    const o = oPool[i];
    if (!pickedO.find(p => p.id === o.id)) pickedO.push(o);
    oPool.splice(i, 1);
  }
  shopStock.oracles = pickedO;

  // Runes — random selection from all available
  const allRunesFull = [...ALL_RUNES, ...UNLOCKABLE_RUNES.filter(r => isUnlocked(r.unlock.id))];
  shopStock.runes = [...allRunesFull].sort(() => Math.random() - 0.5).slice(0, 3);

  // Dice upgrades — random selection
  const allDice = [...DICE_UPGRADES, ...UNLOCKABLE_DICE.filter(d => isUnlocked(d.unlock.id))];
  shopStock.upgrades = [...allDice].sort(() => Math.random() - 0.5).slice(0, 3);

  shopTab = 'oracles';
  screen = 'shop';
}

function openForge() {
  if (forgeChoices.upgrades.length === 0) {
    const allDice = [...DICE_UPGRADES, ...UNLOCKABLE_DICE.filter(d => isUnlocked(d.unlock.id))];
    forgeChoices.upgrades = [...allDice].sort(() => Math.random()-0.5).slice(0, 3);
  }
  if (forgeChoices.oracles.length === 0) {
    // Weighted oracle pool: legendaries scarce, rares uncommon; ensure variety by tier
    const allOraclesFull = [...ALL_ORACLES, ...UNLOCKABLE_ORACLES.filter(o => isUnlocked(o.unlock.id))];
    const unowned = allOraclesFull.filter(o => !heldOracles.find(h => h.id === o.id));
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
  burst(W - 44, H/2, '#22aadd', 24, 5);
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
let playerName      = localStorage.getItem('fortunefallacy_player') || '';

function submitScore() {
  const name = nameEntry.trim() || incoming.username || 'Wanderer';
  saveScore(name, totalFateScore, endless ? 'endless' : 'run');
  nameEntryActive = false;
  loadScores();
  screen = 'scores';
}

// ─── Layout constants ─────────────────────────────────────────────────
const LP = { x:8,   w:196, y:8, h:H-16 };
const CP = { x:212, w:536, y:8, h:H-16 };
const RP = { x:756, w:196, y:8, h:H-16 };

const DICE_SIZE  = 38;
const DICE_GAP   = 22;
const DICE_Y     = CP.y + 95;
const DICE_ROW_W = DICE_COUNT * DICE_SIZE + (DICE_COUNT-1) * DICE_GAP;
const DICE_X0    = CP.x + (CP.w - DICE_ROW_W)/2;
const BOARD_Y    = DICE_Y - 33;
const BOARD_H    = 270;

// ─── Rapier3D physics constants ────────────────────────────────────────
const PHYS_SCALE      = 50;       // canvas pixels per physics unit
const RAPIER_DIE_HALF = DICE_SIZE / 2 / PHYS_SCALE;  // ~0.44 units
const PHYS_CX         = CP.x + CP.w * 0.5;            // canvas centre-X of play area
const PHYS_CZ         = BOARD_Y + BOARD_H * 0.5;      // canvas centre-Y of play area
let rapierWorld       = null;

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
function canvasXY(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (W / rect.width),
    y: (clientY - rect.top)  * (H / rect.height),
  };
}

function pointerMove(mx, my) {
  hoverX = mx; hoverY = my;
  // Promote pending press to active drag once the pointer has moved far enough
  if (pendingDragSlot !== -1 && Math.hypot(mx - dragStartX, my - dragStartY) > 22) {
    dragTraySlot    = pendingDragSlot;
    pendingDragSlot = -1;
    // Teleport die to cursor so the glide-back on release starts from here, not the old slot
    const di = trayOrder[dragTraySlot];
    if (di !== undefined && dice[di]) { dice[di].absX = mx; dice[di].absY = my; }
  }
  if (dragSlider) {
    const pw=680, px=(W-pw)/2;
    const tx = px+76, tw = pw-152;
    const val = Math.max(0, Math.min(1, (mx - tx) / tw));
    if (dragSlider === 'music') {
      musicVolume = val; bgMusic.volume = val;
      localStorage.setItem('ff_musicVol', val);
    } else {
      sfxVolume = val;
      if (_sfxGainNode) _sfxGainNode.gain.value = val;
      localStorage.setItem('ff_sfxVol', val);
    }
  }
}

function pointerDown(mx, my) {
  hoverX = mx; hoverY = my;
  if (paused && pauseTab === 'audio') {
    const pw=680, ph=480, px=(W-pw)/2, py=(H-ph)/2;
    const tx=px+76, tw=pw-152;
    const my1=py+176, my2=py+294;
    if (mx>=tx-8 && mx<=tx+tw+8 && Math.abs(my-my1)<=12) { dragSlider='music'; }
    if (mx>=tx-8 && mx<=tx+tw+8 && Math.abs(my-my2)<=12) { dragSlider='sfx';   }
  }
  // Record press on a tray slot — drag activates in pointerMove once threshold is crossed
  if (screen === 'game' && rolledOnce && !handInProgress && trayOrder.length > 1) {
    const slotTop = HOLD_Y + (HOLD_H - HOLD_SLOT_W) / 2;
    for (let slot = 0; slot < trayOrder.length; slot++) {
      const slotX = HOLD_X0 + slot * (HOLD_SLOT_W + HOLD_GAP);
      if (mx >= slotX && mx <= slotX + HOLD_SLOT_W && my >= slotTop && my <= slotTop + HOLD_SLOT_W) {
        pendingDragSlot = slot;
        dragStartX      = mx;
        dragStartY      = my;
        break;
      }
    }
  }
}

function pointerUp(mx, my) {
  dragSlider      = null;
  pendingDragSlot = -1;   // cancel any uncommitted press
  if (dragTraySlot !== -1) {
    let best = dragTraySlot, bestDist = Infinity;
    for (let slot = 0; slot < trayOrder.length; slot++) {
      const cx = HOLD_X0 + slot * (HOLD_SLOT_W + HOLD_GAP) + HOLD_SLOT_W / 2;
      const d  = Math.abs(mx - cx);
      if (d < bestDist) { bestDist = d; best = slot; }
    }
    if (best !== dragTraySlot) {
      const item = trayOrder.splice(dragTraySlot, 1)[0];
      trayOrder.splice(best, 0, item);
      SFX.unlock();
      dragOccurred = true;  // real reorder — suppress click
    }
    // If dropped back on the same slot, don't suppress the click so a
    // shaky tap still toggles the die's lock state
    dragTraySlot = -1;
  }
}

// Mouse events
canvas.addEventListener('mousemove', e => {
  const {x, y} = canvasXY(e.clientX, e.clientY);
  pointerMove(x, y);
});
canvas.addEventListener('mousedown', e => {
  const {x, y} = canvasXY(e.clientX, e.clientY);
  pointerDown(x, y);
  e.preventDefault();
});
canvas.addEventListener('mouseup', e => {
  const {x, y} = canvasXY(e.clientX, e.clientY);
  pointerUp(x, y);
});
canvas.addEventListener('click', e => {
  getAudio(); ensureBgMusic();
  if (dragOccurred) { dragOccurred = false; return; }
  const {x, y} = canvasXY(e.clientX, e.clientY);
  handleClick(x, y);
});

// Touch events — map to same pointer helpers; synthesise click on tap
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  getAudio(); ensureBgMusic();
  const t = e.changedTouches[0];
  const {x, y} = canvasXY(t.clientX, t.clientY);
  pointerDown(x, y);
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const {x, y} = canvasXY(t.clientX, t.clientY);
  pointerMove(x, y);
}, { passive: false });
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const {x, y} = canvasXY(t.clientX, t.clientY);
  pointerUp(x, y);
  if (!dragOccurred) {
    handleClick(x, y);
  } else {
    dragOccurred = false;
  }
}, { passive: false });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (paused) { paused = false; e.preventDefault(); return; }
    const pauseable = ['game','hub','rune','shop','scores','howto'];
    if (pauseable.includes(screen) && !nameEntryActive) {
      paused = true; e.preventDefault(); return;
    }
  }
  if (paused) return;
  if (screen === 'nameentry') {
    if (e.key === 'Backspace') { nameEntry = nameEntry.slice(0, -1); e.preventDefault(); return; }
    if (e.key === 'Enter') { confirmPlayerName(); return; }
    if (e.key.length === 1 && nameEntry.length < 20) { nameEntry += e.key; return; }
    return;
  }
  if (nameEntryActive) {
    if (e.key === 'Backspace') nameEntry = nameEntry.slice(0, -1);
    else if (e.key === 'Enter') submitScore();
    else if (e.key.length === 1 && nameEntry.length < 16) nameEntry += e.key;
    return;
  }
  if (screen === 'title') startRun(false);
});

function handleClick(mx, my) {
  if (paused) {
    const pw = 680, ph = 480, px = (W-pw)/2, py = (H-ph)/2;
    // Tabs — three equal columns
    if (inRect(mx,my,{x:px+20,  y:py+48, w:206, h:28})) { pauseTab='unlockables'; return; }
    if (inRect(mx,my,{x:px+237, y:py+48, w:206, h:28})) { pauseTab='quick';       return; }
    if (inRect(mx,my,{x:px+454, y:py+48, w:206, h:28})) { pauseTab='audio';       return; }
    // Quick Access buttons
    if (pauseTab === 'quick') {
      if (inRect(mx,my,{x:px+60,y:py+130,w:560,h:60})) { runeOrigin='game'; runeSelInv=null; runeSelSlot=null; paused=false; screen='rune'; return; }
      if (inRect(mx,my,{x:px+60,y:py+220,w:560,h:60})) { paused=false; triggerExitPortal(); return; }
    }
    // Resume button
    if (inRect(mx, my, {x:W/2-80, y:py+ph-52, w:160, h:36})) { paused = false; return; }
    return;
  }
  if (screen === 'howto') {
    if (inRect(mx,my,{x:W/2-100,y:H-52,w:200,h:36})) { screen='title'; return; }
    return;
  }
  if (screen === 'title') {
    const tfy = (H - 360) / 2;
    if (inRect(mx,my,{x:W/2-130,y:tfy+200,w:260,h:48})) { startRun(false); return; }
    if (endlessUnlocked() && inRect(mx,my,{x:W/2-130,y:tfy+256,w:260,h:42})) { startRun(true); return; }
    if (inRect(mx,my,{x:W/2-235,y:tfy+304,w:210,h:36})) { loadScores(); screen='scores'; return; }
    if (inRect(mx,my,{x:W/2+25, y:tfy+304,w:210,h:36})) { screen='howto'; return; }
    startRun(false);
    return;
  }
  if (screen === 'nameentry') {
    if (inRect(mx,my,{x:W/2-130,y:H/2+54,w:260,h:50})) { confirmPlayerName(); return; }
    if (inRect(mx,my,{x:W/2-90,y:H-68,w:180,h:40})) { screen='title'; return; }
    return;
  }
  if (screen === 'scores') {
    if (inRect(mx,my,{x:W/2-100,y:H-68,w:200,h:40})) { screen='title'; return; }
    if (inRect(mx,my,{x:W/2-85,y:77,w:80,h:22})) { scoresTab='local'; return; }
    if (inRect(mx,my,{x:W/2+5,y:77,w:80,h:22})) {
      scoresTab='global';
      if (!onlineFetched && !onlineLoading) fetchOnlineScores();
      return;
    }
    return;
  }
  if (screen === 'win') {
    // portal clicks
    if (inRect(mx,my,{x:W-94,y:H/2-40,w:68,h:80})) { triggerExitPortal(); return; }
    if (incoming.ref && inRect(mx,my,{x:26,y:H/2-40,w:68,h:80})) { triggerReturnPortal(); return; }
    if (!nameEntryActive && inRect(mx,my,{x:W/2-130,y:H/2+86,w:260,h:46})) { nameEntryActive=true; return; }
    if (nameEntryActive) { submitScore(); return; }
    return;
  }
  if (screen === 'shop') {
    // Continue button
    if (inRect(mx,my,{x:W/2-240,y:H-54,w:190,h:40})) { screen='hub'; return; }
    // Tab switching
    if (inRect(mx,my,{x:W/2-260,y:72,w:162,h:34})) { shopTab='oracles';  return; }
    if (inRect(mx,my,{x:W/2-82, y:72,w:154,h:34})) { shopTab='runes';    return; }
    if (inRect(mx,my,{x:W/2+82, y:72,w:162,h:34})) { shopTab='upgrades'; return; }

    if (shopTab === 'oracles') {
      const cW=218,cH=238,cGap=20;
      const cTotal=shopStock.oracles.length*(cW+cGap)-cGap;
      const cX0=W/2-cTotal/2;
      for (let i=0;i<shopStock.oracles.length;i++) {
        const ox=cX0+i*(cW+cGap);
        const cost=oracleCost(shopStock.oracles[i]);
        if (inRect(mx,my,{x:ox+18,y:134+cH+6,w:cW-36,h:32})) {
          if (shards>=cost && heldOracles.length<MAX_ORACLES) {
            shards-=cost;
            runStats.totalShardsSpent+=cost;
            const o=shopStock.oracles.splice(i,1)[0];
            heldOracles.push(o); SFX.oracle(); burst(W/2,H/2,o.color,15,5);
            checkUnlocks();
          }
          return;
        }
      }
      if (inRect(mx,my,{x:W/2+100,y:H-54,w:140,h:40}) && shards>=3) {
        shards-=3;
        const allO=[...ALL_ORACLES,...UNLOCKABLE_ORACLES.filter(o=>isUnlocked(o.unlock.id))];
        const unowned=allO.filter(o=>!heldOracles.find(h=>h.id===o.id));
        const wts={common:3,uncommon:2,rare:1.3,legendary:0.5};
        const wp=[]; unowned.forEach(o=>{const n=Math.round((wts[o.tier||'common'])*2);for(let i=0;i<n;i++)wp.push(o);});
        const picked=[]; while(picked.length<3&&wp.length>0){const i=Math.floor(Math.random()*wp.length);const o=wp[i];if(!picked.find(p=>p.id===o.id))picked.push(o);wp.splice(i,1);}
        shopStock.oracles=picked;
        SFX.roll(); burst(W/2+170,H-34,'#aa66ff',10,4); return;
      }
    }

    if (shopTab === 'runes') {
      const rW=218,rH=170,rGap=20;
      const rTotal=shopStock.runes.length*(rW+rGap)-rGap;
      const rX0=W/2-rTotal/2;
      for (let i=0;i<shopStock.runes.length;i++) {
        const rx=rX0+i*(rW+rGap);
        if (inRect(mx,my,{x:rx,y:140,w:rW,h:rH})) {
          const r=shopStock.runes[i];
          if (shards>=r.cost) {
            shards-=r.cost;
            runStats.totalShardsSpent+=r.cost;
            runeInventory.push({...r});
            shopStock.runes.splice(i,1);
            SFX.oracle();
            const tc=RUNE_TIERS[r.tier]||'#888';
            burst(mx,my,tc,12,4); floatText(mx,my-18,`+${r.name}`,tc,12);
          }
          return;
        }
      }
      if (inRect(mx,my,{x:W/2+100,y:H-54,w:140,h:40}) && shards>=3) {
        shards-=3;
        const allR=[...ALL_RUNES,...UNLOCKABLE_RUNES.filter(r=>isUnlocked(r.unlock.id))];
        shopStock.runes=allR.sort(()=>Math.random()-0.5).slice(0,3);
        SFX.roll(); burst(W/2+170,H-34,'#55cc88',10,4); return;
      }
    }

    if (shopTab === 'upgrades') {
      const upgW=188,upgH=138,upgGap=14;
      const upgTotal=shopStock.upgrades.length*(upgW+upgGap)-upgGap;
      const upgX0=W/2-upgTotal/2;
      const poolFull=diceUpgrades.length>=MAX_DICE;
      for (let i=0;i<shopStock.upgrades.length;i++) {
        const ux=upgX0+i*(upgW+upgGap);
        if (inRect(mx,my,{x:ux,y:134,w:upgW,h:upgH})) {
          const upg=shopStock.upgrades[i];
          if (shards>=upg.cost && !poolFull) {
            shards-=upg.cost;
            runStats.totalShardsSpent+=upg.cost;
            diceUpgrades.push({...upg});
            diceRunes.push(Array(MAX_RUNE_SLOTS).fill(null));
            shopStock.upgrades.splice(i,1);
            SFX.oracle(); burst(mx,my,upg.color,14,4.5);
            floatText(mx,my-18,`+${upg.shortName} die`,upg.color,13);
            checkUnlocks();
          }
          return;
        }
      }
      if (inRect(mx,my,{x:W/2+100,y:H-54,w:140,h:40}) && shards>=3) {
        shards-=3;
        const allD=[...DICE_UPGRADES,...UNLOCKABLE_DICE.filter(d=>isUnlocked(d.unlock.id))];
        shopStock.upgrades=[...allD].sort(()=>Math.random()-0.5).slice(0,3);
        SFX.roll(); burst(W/2+170,H-34,'#c89960',10,4); return;
      }
    }
    return;
  }
  if (screen === 'hub') {
    const BY = H - 84;
    if (inRect(mx,my,{x:W/2-310,y:BY,w:260,h:50})) { runeOrigin='hub'; runeSelInv=null; runeSelSlot=null; screen='rune'; return; }
    if (inRect(mx,my,{x:W/2+50, y:BY,w:260,h:50})) { startRound(); screen='game'; return; }
    return;
  }
  if (screen === 'rune') {
    // Back button
    if (inRect(mx,my,{x:W/2-80,y:H-58,w:160,h:40})) { const o=runeOrigin; runeOrigin='hub'; screen=o; if(o==='game') paused=true; return; }
    const {dieCardX, dieCardY, dieCardW, dieCardH, dieCardGap, poolSize} = runeTableLayout();
    const sc = dieCardW / 148;
    // Die slot and sell button clicks
    for (let di = 0; di < poolSize; di++) {
      const cx = dieCardX + di*(dieCardW+dieCardGap);
      // Sell / drop button
      const upg = diceUpgrades[di];
      const isExtra = di >= DICE_COUNT;
      if (upg || isExtra) {
        const btnY = dieCardY + dieCardH + 4;
        if (inRect(mx,my,{x:cx,y:btnY,w:dieCardW,h:20})) {
          // Unequip all runes on this die back to inventory
          if (diceRunes[di]) {
            for (const r of diceRunes[di]) { if (r) runeInventory.push(r); }
          }
          const refund = upg ? Math.floor(upg.cost / 2) : 0;
          shards += refund;
          if (refund > 0) floatText(cx + dieCardW/2, dieCardY + dieCardH - 10, `+◆${refund}`, '#b8a874', 14);
          if (isExtra) {
            diceUpgrades.splice(di, 1);
            diceRunes.splice(di, 1);
          } else {
            diceUpgrades[di] = null;
            diceRunes[di] = Array(MAX_RUNE_SLOTS).fill(null);
          }
          runeSelInv = null; runeSelSlot = null;
          SFX.unlock(); burst(cx + dieCardW/2, dieCardY + dieCardH/2, '#ff4466', 8, 3);
          return;
        }
      }
      // Rune slot clicks
      const slotW = Math.round(dieCardW/2 - 14*sc);
      const slotH = Math.round(46*sc);
      const slotY = dieCardY + dieCardH - Math.round(58*sc);
      for (let si = 0; si < MAX_RUNE_SLOTS; si++) {
        const sx = cx + Math.round(10*sc) + si * (slotW + Math.round(8*sc));
        if (inRect(mx,my,{x:sx,y:slotY,w:slotW,h:slotH})) {
          if (runeSelInv !== null) {
            // Place selected inventory rune into this slot
            const prev = diceRunes[di][si];
            diceRunes[di][si] = runeInventory[runeSelInv];
            runeInventory.splice(runeSelInv, 1);
            if (prev) runeInventory.push(prev);
            runeSelInv = null;
          } else if (diceRunes[di][si]) {
            // Unequip rune back to inventory
            runeInventory.push(diceRunes[di][si]);
            diceRunes[di][si] = null;
          } else {
            runeSelSlot = {die:di, slot:si};
          }
          return;
        }
      }
    }
    // Inventory rune clicks
    const invY = dieCardY + dieCardH + 32;
    for (let ri = 0; ri < runeInventory.length; ri++) {
      const rx = 80 + ri * 90;
      if (inRect(mx,my,{x:rx,y:invY,w:80,h:100})) {
        runeSelInv = (runeSelInv === ri) ? null : ri;
        runeSelSlot = null;
        return;
      }
    }
    runeSelInv = null; runeSelSlot = null;
    return;
  }
  if (screen === 'game') {
    // Pause button (top-right corner of right panel)
    if (inRect(mx,my,{x:RP.x+RP.w-36,y:RP.y+5,w:28,h:22})) { paused=!paused; return; }
    if (rolledOnce && !handInProgress) {
      for (let i = 0; i < dice.length; i++) {
        // Locked dice in the tray get the full slot as their touch target; board dice use die size
        const hs = dice[i].locked ? HOLD_SLOT_W / 2 : DICE_SIZE / 2;
        if (inRect(mx,my,{x:dice[i].absX-hs, y:dice[i].absY-hs, w:hs*2, h:hs*2})) {
          if (!dice[i].locked && heldCount() >= MAX_HELD) {
            floatText(dice[i].absX, dice[i].absY - 30, `Held full (${MAX_HELD})`, '#ff8844', 12);
            return;
          }
          dice[i].locked = !dice[i].locked;
          if (dice[i].locked) {
            trayOrder.push(i);
          } else {
            trayOrder = trayOrder.filter(x => x !== i);
            if (traySelSlot >= trayOrder.length) traySelSlot = -1;
          }
          SFX[dice[i].locked ? 'lock' : 'unlock']();
          const lc = diceUpgrades[i] ? diceUpgrades[i].color : '#c89960';
          burst(dice[i].absX, dice[i].absY, dice[i].locked ? lc : '#ffffff', dice[i].locked ? 10 : 6, dice[i].locked ? 3.5 : 2.5);
          ring(dice[i].absX, dice[i].absY, lc, dice[i].locked ? 32 : 22, 0.28);
          if (dice[i].locked) { dice[i].bounceVY = -8; screenShake(3); }
          return;
        }
      }
    }
    if (inRect(mx,my,BTN_ROLL) && !handInProgress) {
      if (!rolledOnce) { rollDice(); return; }
      if (rerollsLeft > 0) { rerollsLeft--; rollDice(); return; }
    }
    if (inRect(mx,my,BTN_PLAY) && rolledOnce && !handInProgress && trayOrder.length > 0) { playHand(); return; }
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
// Draw a chamfered-corner polygon path for quad q[] with corner rounding amt (0..1 fraction of edge)
function chamferPath(q, amt) {
  ctx.beginPath();
  for (let i = 0; i < q.length; i++) {
    const prev = q[(i + q.length - 1) % q.length];
    const cur  = q[i];
    const next = q[(i + 1) % q.length];
    // Point amt along edge coming into cur
    const ax = cur[0] + (prev[0] - cur[0]) * amt;
    const ay = cur[1] + (prev[1] - cur[1]) * amt;
    // Point amt along edge leaving cur
    const bx = cur[0] + (next[0] - cur[0]) * amt;
    const by2 = cur[1] + (next[1] - cur[1]) * amt;
    if (i === 0) ctx.moveTo(ax, ay);
    else ctx.lineTo(ax, ay);
    ctx.quadraticCurveTo(cur[0], cur[1], bx, by2);
  }
  ctx.closePath();
}

function drawDie3D(die, cx, cy, size, upg) {
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

  // Upgrade color components (default ivory)
  const upgColor = upg ? upg.color : null;
  let ur = 1, ug = 1, ub = 1;
  if (upgColor) {
    const m = upgColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (m) { ur = parseInt(m[1],16)/255; ug = parseInt(m[2],16)/255; ub = parseInt(m[3],16)/255; }
  }
  // Glow/flash color for this die
  const glowColor = upgColor || '#7733ee';

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
      const p = 1 + wz * 0.18; // perspective
      return [cx + wx*hs*p, cy + by + wy*hs*p];
    });

    // Pip world positions
    const pips = (PIP_LAYOUTS[cf.n] || []).map(([pu,pv]) => {
      const ux = (pu-0.5)*1.4, vv = (pv-0.5)*1.4;
      const ox = cf.normal[0] + cf.u[0]*ux + cf.v[0]*vv;
      const oy = cf.normal[1] + cf.u[1]*ux + cf.v[1]*vv;
      const oz = cf.normal[2] + cf.u[2]*ux + cf.v[2]*vv;
      const [wx,wy,wz] = rotate3(ox, oy, oz, die.rx, die.ry, die.rz);
      const p = 1 + wz * 0.35;
      return [cx + wx*hs*p, cy + by + wy*hs*p];
    });

    rendered.push({ quads, pips, nx, ny, nz, faceN: cf.n });
  }
  rendered.sort((a,b) => a.nz - b.nz); // painter: draw furthest first

  const CH = 0.16; // chamfer fraction

  ctx.save();
  for (const fd of rendered) {
    // Directional lighting
    const diffuse = Math.max(0, fd.nx * 0.413 + fd.ny * (-0.566) + fd.nz * 0.713);
    const br      = 0.18 + 0.82 * diffuse;
    const spec    = Math.pow(Math.max(0, fd.nx * 0.223 + fd.ny * (-0.306) + fd.nz * 0.925), 28);
    const isTop   = fd.nz > 0.7;
    const q       = fd.quads;

    // Face center
    const fcx = (q[0][0]+q[1][0]+q[2][0]+q[3][0]) / 4;
    const fcy = (q[0][1]+q[1][1]+q[2][1]+q[3][1]) / 4;

    // Chamfered face path
    chamferPath(q, CH);

    // Diffuse gradient along light direction
    const gSpan  = hs * 1.0;
    const grad   = ctx.createLinearGradient(
      fcx + 0.413*gSpan, fcy - 0.566*gSpan,
      fcx - 0.413*gSpan, fcy + 0.566*gSpan
    );
    const brLit  = Math.min(1, br + spec * 0.55);
    const brDark = br * 0.68;
    if (die.locked) {
      grad.addColorStop(0,    `rgb(${(brLit*255)|0},${(brLit*232)|0},${(brLit*120)|0})`);
      grad.addColorStop(0.55, `rgb(${(br*225)|0},${(br*200)|0},${(br*82)|0})`);
      grad.addColorStop(1,    `rgb(${(brDark*185)|0},${(brDark*140)|0},${(brDark*40)|0})`);
    } else if (upgColor) {
      // Tint face with upgrade color
      grad.addColorStop(0,    `rgb(${(brLit*(255*0.55+ur*255*0.45))|0},${(brLit*(255*0.55+ug*255*0.45))|0},${(brLit*(255*0.55+ub*255*0.45))|0})`);
      grad.addColorStop(0.55, `rgb(${(br*(200*0.5+ur*200*0.5))|0},${(br*(200*0.5+ug*200*0.5))|0},${(br*(200*0.5+ub*200*0.5))|0})`);
      grad.addColorStop(1,    `rgb(${(brDark*(150*0.4+ur*150*0.6))|0},${(brDark*(150*0.4+ug*150*0.6))|0},${(brDark*(150*0.4+ub*150*0.6))|0})`);
    } else {
      grad.addColorStop(0,    `rgb(${(brLit*255)|0},${(brLit*255)|0},${(brLit*248)|0})`);
      grad.addColorStop(0.55, `rgb(${(br*238)|0},${(br*232)|0},${(br*218)|0})`);
      grad.addColorStop(1,    `rgb(${(brDark*185)|0},${(brDark*178)|0},${(brDark*160)|0})`);
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // Specular gloss overlay
    if (spec > 0.04) {
      const litX = fcx + 0.413 * hs * 0.42, litY = fcy - 0.566 * hs * 0.42;
      const sg   = ctx.createRadialGradient(litX, litY, 0, litX, litY, hs * 0.9);
      sg.addColorStop(0,   `rgba(255,255,255,${(spec * 0.52).toFixed(3)})`);
      sg.addColorStop(0.4, `rgba(255,255,255,${(spec * 0.10).toFixed(3)})`);
      sg.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fill();
    }

    // Outer edge — dark border
    ctx.lineWidth   = 2.2;
    ctx.strokeStyle = die.locked
      ? `rgba(100,60,0,${0.6+0.3*br})`
      : `rgba(22,10,40,${0.55+0.35*br})`;
    ctx.stroke();

    // Chamfer highlight ring — bright inner stroke along chamfered shape
    ctx.save();
    chamferPath(q, CH * 1.9);
    ctx.lineWidth   = 1.2;
    ctx.strokeStyle = die.locked
      ? `rgba(255,240,180,${0.30 + 0.35*br})`
      : upgColor
        ? `rgba(${(ur*255+180)|0>255?255:(ur*255+180)|0},${(ug*255+180)|0>255?255:(ug*255+180)|0},${(ub*255+180)|0>255?255:(ub*255+180)|0},${0.24 + 0.38*br})`
        : `rgba(255,255,255,${0.22 + 0.35*br})`;
    ctx.stroke();
    ctx.restore();

    // Hover/locked glow stroke on top face only
    if ((die.locked || isHov) && isTop) {
      ctx.save();
      ctx.lineWidth   = 2.2;
      ctx.strokeStyle = die.locked ? `rgba(200,153,96,${0.5+0.4*br})` : `rgba(119,51,238,${0.5+0.4*br})`;
      ctx.shadowColor = die.locked ? '#c89960' : glowColor;
      ctx.shadowBlur  = die.locked ? 14 : 9;
      ctx.stroke();
      ctx.restore();
    }

    // Face-reveal flash — white bloom on top face right after landing
    if (isTop && die.revealT !== undefined && die.revealT < 0.28) {
      const rf = die.revealT / 0.28;
      const alpha = (1 - rf) * 0.55;
      ctx.save();
      chamferPath(q, CH);
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.fill();
      ctx.restore();
    }

    // Top face upgrade decoration — icon label
    if (isTop && upg && upg.icon) {
      ctx.save();
      ctx.font      = `bold ${(hs * 0.55)|0}px ui-sans-serif,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = upgColor || '#ffffff';
      ctx.fillText(upg.icon, fcx, fcy);
      ctx.restore();
    }

    // Pips
    const isOne = fd.faceN === 1;
    const pipR  = hs * 0.135;
    let pipCore, pipEdge;
    if (die.locked) {
      pipCore = `rgba(50,25,0,${br})`;   pipEdge = `rgba(100,60,5,${br})`;
    } else if (upgColor) {
      // Dark tinted pips matching upgrade
      const dr = (ur*120)|0, dg = (ug*80)|0, db = (ub*120)|0;
      pipCore = `rgba(${dr},${dg},${db},${br})`;
      pipEdge = `rgba(${Math.min(255,(dr+50)|0)},${Math.min(255,(dg+40)|0)},${Math.min(255,(db+50)|0)},${br})`;
    } else if (isOne) {
      pipCore = `rgba(150,8,8,${br})`;   pipEdge = `rgba(210,50,50,${br})`;
    } else {
      pipCore = `rgba(10,4,28,${br})`;   pipEdge = `rgba(40,22,70,${br})`;
    }

    for (const [px,py] of fd.pips) {
      if (isTop) {
        ctx.save();
        ctx.shadowColor = die.locked ? 'rgba(80,40,0,0.5)' : upgColor ? `rgba(${(ur*180)|0},${(ug*120)|0},${(ub*180)|0},0.45)` : isOne ? 'rgba(200,20,20,0.45)' : 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
      }
      const pg = ctx.createRadialGradient(px - pipR*0.3, py - pipR*0.3, 0, px, py, pipR);
      pg.addColorStop(0, pipEdge);
      pg.addColorStop(1, pipCore);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, pipR, 0, Math.PI*2);
      ctx.fill();
      if (isTop) ctx.restore();

      if (isTop) {
        ctx.fillStyle = (die.locked || upgColor) ? 'rgba(255,240,200,0.40)' : isOne ? 'rgba(255,180,180,0.55)' : 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(px - pipR*0.35, py - pipR*0.35, pipR*0.32, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // Scoring flash
  if (die.scoring) {
    const t = die.scoringT || 0;
    ctx.save();
    ctx.shadowColor = upgColor || '#ffe066'; ctx.shadowBlur = 14;
    ctx.strokeStyle = upgColor ? `rgba(${(ur*255)|0},${(ug*255)|0},${(ub*255)|0},0.95)` : 'rgba(255,228,60,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy + by, hs * 1.20, hs * 1.13, 0, 0, Math.PI * 2);
    ctx.stroke();
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

  // Land impulse ring
  if (die.landT !== undefined && die.landT < 0.28 && !die.rolling) {
    const lt = die.landT / 0.28;
    ctx.save();
    ctx.globalAlpha = (1 - lt) * 0.7;
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2.5 * (1 - lt) + 0.5;
    ctx.shadowColor = glowColor; ctx.shadowBlur = 4;
    const rr = hs * (0.95 + lt * 1.2);
    ctx.beginPath();
    ctx.ellipse(cx, cy + by, rr, rr * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Glow halo for locked / hovered
  if (die.locked || isHov) {
    ctx.shadowColor = die.locked ? '#c89960' : glowColor;
    ctx.shadowBlur  = die.locked ? 24 : 14;
    ctx.strokeStyle = die.locked ? 'rgba(200,153,96,0.75)' : upgColor ? `rgba(${(ur*255)|0},${(ug*200)|0},${(ub*255)|0},0.65)` : 'rgba(119,51,238,0.65)';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy + by, hs * 1.13, hs * 1.06, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Drop shadow on board
  {
    const lift = Math.max(0, -by);
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
  // Obsidian divination table under the dice
  const bx = cx - width/2, bw = width, bh = height;
  ctx.save();
  // Deep void-stone — cool dark core fading to near-black edges
  const gr = ctx.createRadialGradient(cx, topY + bh*0.4, 10, cx, topY + bh*0.4, bw*0.55);
  gr.addColorStop(0,   'rgba(18,10,48,0.92)');
  gr.addColorStop(0.6, 'rgba(8,5,22,0.94)');
  gr.addColorStop(1,   'rgba(2,1,8,0.96)');
  roundRect(bx, topY, bw, bh, 14);
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,44,220,0.45)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Violet inner glow border
  ctx.shadowColor = 'rgba(120,60,255,0.18)';
  ctx.shadowBlur  = 8;
  ctx.strokeStyle = 'rgba(100,55,210,0.20)';
  ctx.lineWidth   = 1;
  roundRect(bx+4, topY+4, bw-8, bh-8, 11);
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // Grid lines converging to vanishing point
  ctx.strokeStyle = 'rgba(100,70,200,0.09)';
  ctx.lineWidth   = 0.8;
  const lines = 8;
  for (let i = 0; i <= lines; i++) {
    const f  = i / lines;
    const xp = bx + bw * f;
    const yTop = topY + 4;
    const yBot = topY + bh - 4;
    ctx.beginPath();
    ctx.moveTo(xp, yTop);
    ctx.lineTo(cx + (xp-cx)*0.55, topY + bh*0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xp, yBot);
    ctx.lineTo(cx + (xp-cx)*0.55, topY + bh*0.5);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Button drawing ───────────────────────────────────────────────────
function drawBtn(r, label, enabled, hot = false) {
  const hover = inRect(hoverX, hoverY, r) && enabled;
  const isActive = hot && hover;
  const bg    = !enabled ? '#080614' : isActive ? '#1c0850' : hot ? '#150638' : hover ? '#110530' : '#0c0420';
  const bdr   = !enabled ? '#1c1438' : isActive ? '#aa66ff' : hot ? '#8844ee' : hover ? '#6633cc' : '#3a2670';
  ctx.save();
  const grd = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  grd.addColorStop(0, bg);
  grd.addColorStop(1, 'rgba(0,0,0,0.5)');
  drawRoundRect(r.x, r.y, r.w, r.h, 8, grd, bdr, 1.5);
  // Inner hairline
  ctx.strokeStyle = enabled
    ? (isActive ? 'rgba(160,100,255,0.35)' : 'rgba(110,66,200,0.20)')
    : 'rgba(80,60,130,0.10)';
  ctx.lineWidth = 1;
  roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 6);
  ctx.stroke();
  // Glow on active/hover
  if (enabled && (hover || hot)) {
    ctx.shadowColor = isActive ? '#aa66ff' : '#7733ee';
    ctx.shadowBlur  = isActive ? 18 : 9;
  }
  ctx.fillStyle = enabled ? (isActive ? '#eedeff' : hot ? '#d8c8f8' : hover ? '#c8b8ee' : '#b8aad8') : '#443860';
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

function dieTooltipBody(dieIndex) {
  const upg = diceUpgrades[dieIndex];
  const parts = upg ? [upgradeTooltipBody(upg)] : ['A standard d6. Scores its face value.'];
  const runes = (diceRunes[dieIndex] || []).filter(Boolean);
  if (runes.length) {
    parts.push('Runes: ' + runes.map(r => `${r.icon} ${r.name} — ${r.desc}`).join(' | '));
  }
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
  const bg = owned ? '#0a0820' : hover ? '#120a30' : '#0c0820';
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
  ctx.font        = `${owned ? 16 : 26}px ui-sans-serif,sans-serif`;
  ctx.textAlign   = 'center';
  ctx.fillText(oracle.icon, x+(owned?22:w/2), y+(owned?h/2+6:34));

  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#fff';
  ctx.font       = `bold ${owned?9:13}px ui-sans-serif,sans-serif`;
  if (owned) {
    ctx.textAlign = 'left';
    const label = oracle.name.length > 16 ? oracle.name.slice(0,15)+'…' : oracle.name;
    ctx.fillText(label, x+38, y+h/2-2);
    ctx.fillStyle = oracle.color;
    ctx.font = `8px ui-sans-serif,sans-serif`;
    const eff = oracle.effect.length > 32 ? oracle.effect.slice(0,31)+'…' : oracle.effect;
    ctx.fillText(eff, x+38, y+h/2+10);
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(oracle.name, x+w/2, y+58);
  }

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

// ─── SCREEN: How To Play ─────────────────────────────────────────────
function drawHowToPlay(t) {
  drawBG(t);

  const fw = 920, fh = 516;
  const fx = (W - fw) / 2, fy = (H - fh) / 2;
  ornamentFrame(fx, fy, fw, fh, '#4422aa', { bg: 'rgba(4,3,16,0.97)', inner: 'rgba(110,60,220,0.35)' });

  // Title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c89960'; ctx.shadowColor = '#c89960'; ctx.shadowBlur = 8;
  ctx.font = `bold 24px ${SERIF}`;
  ctx.fillText('✦  HOW TO PLAY  ✦', W/2, fy + 44);
  ctx.restore();

  // Horizontal rule below title + vertical centre divider
  ctx.save();
  ctx.strokeStyle = 'rgba(200,153,96,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx + 28, fy + 56); ctx.lineTo(fx + fw - 28, fy + 56);
  ctx.moveTo(W/2, fy + 60);    ctx.lineTo(W/2, fy + fh - 52);
  ctx.stroke();
  ctx.restore();

  // ── LEFT COLUMN ───────────────────────────────────────────────────────
  const lx = fx + 32;
  let   ly = fy + 74;
  const lw = fw / 2 - 50;

  const sectionHeader = (label, y) => {
    txt(label, lx, y, {size:10, color:'#8855ee', bold:true});
    ctx.save();
    ctx.strokeStyle = 'rgba(119,51,238,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const tw = ctx.measureText(label).width + 8;
    ctx.moveTo(lx + tw, y - 4); ctx.lineTo(lx + lw, y - 4);
    ctx.stroke();
    ctx.restore();
  };

  const row = (label, desc, y) => {
    txt(label, lx + 6, y, {size:12, color:'#c89960', bold:true});
    txt(desc,  lx + 110, y, {size:11, color:'rgba(215,195,145,0.82)'});
  };

  sectionHeader('THE BASICS', ly);
  ly += 20;
  row('Roll',       'Roll all unlocked dice',                                  ly); ly += 21;
  row('Lock',       'Click a die to hold it for scoring',                      ly); ly += 21;
  row('Play Hand',  'Score your locked dice and earn points',                  ly); ly += 21;
  row('Reroll',     'Re-roll unlocked dice (2 per hand)',                       ly); ly += 21;
  row('Goal',       'Hit the target score to advance (3 hands)',               ly); ly += 28;

  sectionHeader('ORACLES & FORGE', ly);
  ly += 20;
  row('Oracle',     'Free powerup granted after each cleared goal',            ly); ly += 21;
  row('Forge',      'Buy dice upgrades or extra oracles with Shards',          ly); ly += 21;
  row('Shards',     'Earned by clearing goals — more overshoot = more shards', ly); ly += 21;
  row('Streak',     'Same combo twice in a row gives a bonus ×3 mult',         ly); ly += 28;

  sectionHeader('TIPS', ly);
  ly += 20;
  const tips = [
    'Beat all 8 goals to unlock Endless Mode',
    'Oracles stack — build powerful combos',
    'Score = (die faces + combo chips) × mult',
  ];
  for (const tip of tips) {
    ctx.save();
    ctx.fillStyle = 'rgba(180,165,110,0.65)';
    ctx.font = `italic 11px ${SERIF}`;
    ctx.textAlign = 'left';
    ctx.fillText('✦  ' + tip, lx + 6, ly);
    ctx.restore();
    ly += 19;
  }

  // ── RIGHT COLUMN ──────────────────────────────────────────────────────
  const rx = W/2 + 18;
  let   ry = fy + 74;

  sectionHeader('COMBOS', ry);
  txt('score = (faces + chips) × mult', rx + 72, ry, {size:10, color:'rgba(200,153,96,0.45)'});
  ry += 18;

  // Table header
  ctx.save();
  ctx.fillStyle = 'rgba(200,153,96,0.45)';
  ctx.font = 'bold 10px ui-sans-serif,sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('COMBO',  rx + 6,   ry);
  ctx.fillText('CHIPS',  rx + 248, ry);
  ctx.fillText('×MULT',  rx + 320, ry);
  ctx.restore();
  ry += 5;

  ctx.save();
  ctx.strokeStyle = 'rgba(200,153,96,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 400, ry); ctx.stroke();
  ctx.restore();
  ry += 10;

  const comboRows = [
    { name:'Five of a Kind',  chips:100, mult:20, tier:8 },
    { name:'Four of a Kind',  chips:60,  mult:12, tier:7 },
    { name:'Large Straight',  chips:40,  mult:7,  tier:6 },
    { name:'Full House',      chips:35,  mult:8,  tier:5 },
    { name:'Small Straight',  chips:30,  mult:5,  tier:4 },
    { name:'Three of a Kind', chips:30,  mult:5,  tier:3 },
    { name:'Two Pair',        chips:20,  mult:3,  tier:2 },
    { name:'One Pair',        chips:10,  mult:2,  tier:1 },
    { name:'Chance',          chips:0,   mult:1,  tier:0 },
  ];

  for (const c of comboRows) {
    const col = COMBO_COLORS[c.tier] || '#c89960';
    const bold = c.tier >= 6;
    if (bold) drawRoundRect(rx - 4, ry - 14, 414, 22, 4, 'rgba(200,153,96,0.05)', col, 0.5);
    txt(c.name,                     rx + 6,   ry, {size:13, color:col, bold});
    txt(c.chips > 0 ? `+${c.chips}` : '—', rx + 254, ry, {size:12, color:'rgba(120,190,255,0.85)'});
    txt(`×${c.mult}`,               rx + 326, ry, {size:12, color:'rgba(255,140,90,0.9)', bold: c.mult >= 8});
    ry += 22;
  }

  // Back button
  drawBtn({x:W/2-100, y:fy + fh - 44, w:200, h:36}, '← Back to Menu', true);

  drawParticles(); drawFloaters();
}

// ─── SCREEN: Title ────────────────────────────────────────────────────
function drawTitle(t) {
  drawBG(t);

  // Ornate central parchment frame
  const fw = 560, fh = 360;
  const fx = (W - fw) / 2, fy = (H - fh) / 2;
  ornamentFrame(fx, fy, fw, fh, '#4422aa', { bg: 'rgba(4,3,18,0.95)', inner: 'rgba(200,153,96,0.42)' });

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
  ctx.shadowColor = '#6622cc'; ctx.shadowBlur = 14;
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
  drawBtn({x:W/2-235,y:fy + 304,w:210,h:36}, '🏆  High Scores', true);
  drawBtn({x:W/2+25, y:fy + 304,w:210,h:36}, '?  How to Play', true);

  const pulse = 0.5 + 0.4*Math.sin(t*2.3);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(200,170,120,${pulse})`;
  ctx.font = `italic 11px ${SERIF}`;
  ctx.fillText('— press any key to begin —', W/2, H - 26);
  ctx.restore();
}

// ─── SCREEN: Name Entry ───────────────────────────────────────────────
function drawNameEntry(t) {
  drawBG(t);

  txt('WHO IS PLAYING?', W/2, H/2 - 110, {size:28,color:'#c89960',align:'center',bold:true,shadow:'#c89960'});
  txt('Your name will appear on the high score board', W/2, H/2 - 70, {size:13,color:'#b8a874',align:'center'});

  // Input box
  const bx = W/2 - 160, by = H/2 - 46, bw = 320, bh = 52;
  drawRoundRect(bx, by, bw, bh, 10, '#100828', '#c89960', 2);
  const cursor = Math.floor(t*2) % 2 === 0 ? '|' : ' ';
  const display = (nameEntry || '') + cursor;
  txt(display, W/2, by + 34, {size:20,color:'#f7e0b0',align:'center'});
  if (!nameEntry) txt('Enter name…', W/2, by + 34, {size:16,color:'rgba(200,153,96,0.35)',align:'center'});

  drawBtn({x:W/2-130,y:H/2+54,w:260,h:50}, '▶  Begin Run', true, true);
  drawBtn({x:W/2-90,y:H-68,w:180,h:40}, '← Back', true, false);
}

// ─── SCREEN: Game ─────────────────────────────────────────────────────
function drawGame(t) {
  drawBG(t);

  // Left panel
  ornamentFrame(LP.x, LP.y, LP.w, LP.h, '#2a1880');
  panelHeader(LP.x + LP.w/2, LP.y + 22, LP.w - 20, 'Anomalies', '#9966ee', '☽');

  const cardH = 50; const cardW = LP.w - 16;
  for (let i = 0; i < MAX_ORACLES; i++) {
    const cy = LP.y + 38 + i*(cardH+4);
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
  ornamentFrame(CP.x, CP.y, CP.w, CP.h, '#2a1880');
  // Ornate title with goal label (replaces plain header)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c89960';
  ctx.font = `bold 20px ${SERIF}`;
  ctx.fillText(goalLabel(), CP.x + CP.w/2, CP.y + 30);
  ctx.restore();
  panelHeader(CP.x + CP.w/2, CP.y + 46, CP.w - 40, `${handsLeft} hand${handsLeft!==1?'s':''} remaining`, '#8877cc', '✦');

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
    // Slot outlines — highlight drag source (dashed) and drop target (violet glow)
    const held = heldCount();
    // Find nearest drop-target slot while dragging
    let dropTarget = -1;
    if (dragTraySlot !== -1) {
      let bestDist = Infinity;
      for (let slot = 0; slot < trayOrder.length; slot++) {
        const cx = HOLD_X0 + slot*(HOLD_SLOT_W+HOLD_GAP) + HOLD_SLOT_W/2;
        const d2 = Math.abs(hoverX - cx);
        if (d2 < bestDist) { bestDist = d2; dropTarget = slot; }
      }
    }
    for (let si = 0; si < MAX_HELD; si++) {
      const sx  = HOLD_X0 + si*(HOLD_SLOT_W + HOLD_GAP);
      const sy  = HOLD_Y + (HOLD_H - HOLD_SLOT_W) / 2;
      const isDragSrc  = si === dragTraySlot;
      const isDropTgt  = si === dropTarget && dragTraySlot !== -1 && si !== dragTraySlot;
      const filled     = si < held && !isDragSrc;
      ctx.save();
      if (isDragSrc) {
        ctx.strokeStyle = 'rgba(200,153,96,0.18)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
      } else if (isDropTgt) {
        ctx.strokeStyle = 'rgba(180,100,255,0.9)';
        ctx.shadowColor = '#aa55ff'; ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = filled ? 'rgba(200,153,96,0.45)' : 'rgba(200,153,96,0.12)';
        ctx.setLineDash(filled ? [] : [3, 3]);
        ctx.lineWidth = 1;
      }
      roundRect(sx, sy, HOLD_SLOT_W, HOLD_SLOT_W, 6);
      ctx.stroke();
      ctx.restore();
      // Slot order number (subtle, inside each filled slot)
      if (si < trayOrder.length && trayOrder.length > 1 && !isDragSrc) {
        txt(`${si+1}`, sx + HOLD_SLOT_W/2, HOLD_Y + HOLD_H - 5, {size:7, color:'rgba(200,160,255,0.35)', align:'center', bold:true});
      }
    }
  }

  // Dice (3D) — positions driven by absX/absY physics; skip dragged die (drawn as ghost at cursor)
  for (let i = 0; i < dice.length; i++) {
    if (dragTraySlot !== -1 && i === trayOrder[dragTraySlot]) continue;
    const d = dice[i];
    drawDie3D(d, d.absX, d.absY, DICE_SIZE, diceUpgrades[i]);
    const upg = diceUpgrades[i];
    // Upgrade icon + rune dots below die
    {
      const labelY = d.absY + DICE_SIZE/2 + 13;
      const equippedRunes = (diceRunes[i] || []).filter(Boolean);
      ctx.save();
      ctx.textAlign = 'center';
      if (upg) {
        ctx.fillStyle = upg.color; ctx.shadowColor = upg.color; ctx.shadowBlur = 2;
        ctx.font = '11px ui-sans-serif,sans-serif';
        ctx.fillText(upg.icon, d.absX, labelY);
      }
      if (equippedRunes.length) {
        ctx.shadowBlur = 0;
        ctx.font = '8px ui-sans-serif,sans-serif';
        const spacing = 9;
        const totalW = (equippedRunes.length - 1) * spacing;
        equippedRunes.forEach((r, ri) => {
          const rx2 = d.absX - totalW/2 + ri * spacing;
          ctx.fillStyle = RUNE_TIERS[r.tier] || '#aaaaaa';
          ctx.fillText(r.icon, rx2, labelY + (upg ? 11 : 0));
        });
      }
      ctx.restore();
    }
    if (!d.rolling) {
      const hs = DICE_SIZE / 2;
      const hoverH = DICE_SIZE + ((diceUpgrades[i] || (diceRunes[i]||[]).some(Boolean)) ? 24 : 0);
      if (inRect(hoverX, hoverY, { x: d.absX-hs, y: d.absY-hs, w: DICE_SIZE, h: hoverH })) {
        const _tipName = upg ? upg.name : 'Plain Die';
        const _tipColor = upg ? upg.color : '#e0d3b8';
        markHover(`gameDie:${i}`, _tipName, dieTooltipBody(i), { color: _tipColor });
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
    ctx.fillStyle = '#ee3388'; ctx.shadowColor = '#ee3388'; ctx.shadowBlur = 3 + multPunch * 10;
    ctx.font = 'bold 22px ui-sans-serif,sans-serif';
    ctx.fillText(mult, 0, 0);
    ctx.restore();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(238,51,136,0.55)';
    ctx.font = '9px ui-sans-serif,sans-serif';
    ctx.fillText('mult', cx2 + 58, sy + 13);
    ctx.restore();
    // Decay punches
    scoringState.chipPunch = Math.max(0, chipPunch - 0.08);
    scoringState.multPunch = Math.max(0, multPunch - 0.08);
  } else if (rolledOnce && !handInProgress) {
    if (trayOrder.length > 0) {
      const heldFaces = trayOrder.map(i => dice[i].face);
      const combo = detectCombo(heldFaces);
      const col   = COMBO_COLORS[combo.tier]||'#fff';
      txt(combo.name, CP.x+CP.w/2, BOARD_Y + BOARD_H - 12, {size:15,color:col,align:'center',bold:true,shadow:col});
    } else {
      txt(`Hold 1–${MAX_HELD} dice to play`, CP.x+CP.w/2, BOARD_Y + BOARD_H - 12, {size:13,color:'rgba(200,170,120,0.55)',align:'center'});
    }
  }

  const canRoll = !handInProgress && (!rolledOnce || rerollsLeft > 0);
  const canPlay = rolledOnce && !handInProgress && trayOrder.length > 0;
  const prev = canPlay ? previewHand() : null;
  const oneShot = prev && (prev.total + roundScore >= currentTarget());

  drawBtn(BTN_ROLL, rolledOnce ? `Reroll  (${rerollsLeft} left)` : 'Roll Dice', canRoll);

  // One-shot glow + lightning on Play Hand button
  if (oneShot) {
    const pulse = 0.55 + 0.35*Math.sin(t*3.4);
    ctx.save();
    ctx.shadowColor = '#cc44ff'; ctx.shadowBlur = 28 + 16*Math.sin(t*3.4);
    ctx.strokeStyle = `rgba(200,100,255,${pulse})`;
    ctx.lineWidth = 3;
    roundRect(BTN_PLAY.x-4, BTN_PLAY.y-4, BTN_PLAY.w+8, BTN_PLAY.h+8, 12);
    ctx.stroke();
    ctx.restore();
    for (let li = 0; li < 2; li++) {
      if (Math.random() < 0.32) {
        const lx = BTN_PLAY.x + 8 + Math.random()*(BTN_PLAY.w-16);
        const ly = BTN_PLAY.y + 6 + Math.random()*(BTN_PLAY.h-12);
        ctx.save();
        ctx.globalAlpha = 0.55 + Math.random()*0.45;
        ctx.strokeStyle = Math.random()<0.5 ? '#dd88ff' : '#ffffff';
        ctx.lineWidth = 1.2; ctx.shadowColor = '#aa44ff'; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        const dx1=(Math.random()-0.5)*18, dy1=(Math.random()-0.5)*18;
        ctx.lineTo(lx+dx1, ly+dy1);
        ctx.lineTo(lx+dx1+(Math.random()-0.5)*10, ly+dy1+(Math.random()-0.5)*10);
        ctx.stroke(); ctx.restore();
      }
    }
  }
  drawBtn(BTN_PLAY, 'Play Hand  ✦', canPlay, canPlay || oneShot);

  if (rolledOnce && !handInProgress)
    txt(trayOrder.length > 1 ? 'Click to hold · drag held dice to reorder' : 'Click dice to hold / release them',
      CP.x+CP.w/2, BTN_PLAY.y+BTN_PLAY.h+16, {size:10,color:'rgba(200,170,120,0.55)',align:'center'});

  // Right panel
  ornamentFrame(RP.x, RP.y, RP.w, RP.h, '#2a1880');
  panelHeader(RP.x + RP.w/2, RP.y + 22, RP.w - 20, 'Score', '#c89960', '⚝');

  // Score number — scale-bounces while counting, lava glow on first-hand clear
  {
    const scoreStr = Math.floor(displayRoundScore).toLocaleString();
    const sx = RP.x + RP.w/2, sy = RP.y + 62;
    const sc = 1 + displayScoreBounce * 0.14;
    const isLava = firstHandSpectrumGoal === runGoal;
    ctx.save();
    ctx.translate(sx, sy); ctx.scale(sc, sc); ctx.translate(-sx, -sy);
    ctx.font = `bold 32px ${SERIF}`; ctx.textAlign = 'center';
    if (isLava) {
      // Pulsing lava glow passes
      const lavaC = ['#ff2200','#ff6600','#ffaa00','#ff4400','#ffee44','#ff1100'];
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.globalAlpha = 0.22 + Math.sin(t * 4 + i) * 0.08;
        ctx.shadowColor = lavaC[i];
        ctx.shadowBlur  = 26 + Math.sin(t * 3 + i * 1.1) * 10;
        ctx.fillStyle   = lavaC[i];
        ctx.fillText(scoreStr, sx, sy);
        ctx.restore();
      }
      ctx.fillStyle   = '#fff8e0';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur  = 14 + Math.sin(t * 6) * 5;
    } else {
      ctx.fillStyle = '#e0c590'; ctx.shadowColor = '#6622cc'; ctx.shadowBlur = 4;
    }
    ctx.fillText(scoreStr, sx, sy);
    ctx.restore();
  }
  txt('/ '+currentTarget().toLocaleString(), RP.x+RP.w/2, RP.y+74, {size:11,color:'rgba(200,180,255,0.55)',align:'center'});

  // Progress bar
  const prog = Math.min(1, displayRoundScore/currentTarget());
  const bx=RP.x+12, by=RP.y+84, bw=RP.w-24, bh=14;
  const isLava = firstHandSpectrumGoal === runGoal;
  drawRoundRect(bx, by, bw, bh, 5, '#0a0818', '#2a1866');
  if (prog>0) {
    ctx.save();
    if (isLava) {
      const fillW   = bw * prog;
      const lavaPhase = (t * 42) % (bw * 0.6);

      // Clip everything to the bar shape
      ctx.save();
      roundRect(bx, by, fillW, bh, 5);
      ctx.clip();

      // Base scrolling gradient
      const rg = ctx.createLinearGradient(bx - lavaPhase, by, bx - lavaPhase + bw * 1.6, by);
      [ [0.00,'#1a0100'],[0.08,'#cc1800'],[0.17,'#ff4400'],
        [0.26,'#ff8800'],[0.33,'#ffcc00'],[0.40,'#ff3300'],
        [0.48,'#150100'],[0.56,'#dd2000'],[0.65,'#ff6600'],
        [0.73,'#ffaa00'],[0.80,'#ff2200'],[0.88,'#150100'],
        [0.94,'#ff5500'],[1.00,'#ffcc00'],
      ].forEach(([p,c]) => rg.addColorStop(p, c));
      ctx.fillStyle = rg;
      ctx.fillRect(bx - lavaPhase, by, bw * 1.6 + lavaPhase, bh);

      // Dark rock islands — slow-drifting ellipses
      for (let i = 0; i < 7; i++) {
        const rx = bx + ((i * 41 + lavaPhase * 0.65) % Math.max(1, fillW));
        const ry = by + bh * 0.5 + Math.sin(i * 2.1 + t * 1.4) * (bh * 0.28);
        const rr = 3.5 + (i % 3) * 2;
        ctx.save();
        ctx.globalAlpha = 0.62 + Math.sin(i * 1.7 + t * 0.8) * 0.14;
        ctx.fillStyle   = '#100100';
        ctx.beginPath();
        ctx.ellipse(rx, ry, rr * 2.2, rr * 0.8, Math.sin(i * 0.6) * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Yellow hotspot veins
      for (let i = 0; i < 4; i++) {
        const hx = bx + ((i * 59 + lavaPhase * 1.4) % Math.max(1, fillW));
        const hy = by + bh * (0.22 + (i % 3) * 0.30);
        ctx.save();
        ctx.globalAlpha = 0.28 + Math.sin(i * 3.1 + t * 3.8) * 0.14;
        ctx.fillStyle   = '#ffee44';
        ctx.shadowColor = '#ffee44'; ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(hx, hy, 10 + (i % 2) * 4, 2.2, Math.sin(i) * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore(); // end clip

      // Pulsing edge glow
      ctx.save();
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur  = 18 + Math.sin(t * 4.5) * 9;
      roundRect(bx, by, fillW, bh, 5);
      ctx.strokeStyle = 'rgba(255,80,0,0.45)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.restore();

      // Bright molten tip flicker
      if (prog < 0.99) {
        ctx.save();
        ctx.globalAlpha = 0.7 + Math.sin(t * 9) * 0.20;
        ctx.fillStyle   = '#ffee44';
        ctx.shadowColor = '#ffee44'; ctx.shadowBlur = 24;
        ctx.fillRect(bx + fillW - 3, by + 1, 3, bh - 2);
        ctx.restore();
      }

      // Spawn lava drips from bottom edge
      if (Math.random() < 0.40) {
        const cols = ['#ff2200','#ff4400','#ff6600','#ff8800','#ffaa00','#ffcc44'];
        particles.push({
          x: bx + Math.random() * fillW,
          y: by + bh,
          vx: (Math.random() - 0.5) * 0.9,
          vy: 0.4 + Math.random() * 1.2,
          r:  2.2 + Math.random() * 2.8,
          color: cols[Math.floor(Math.random() * cols.length)],
          alpha: 1, age: 0,
          life: 1.0 + Math.random() * 1.2,
          lavaDrop: true,
        });
      }
    } else {
      // Void gradient — left=deep violet, right=electric white; fill edge reveals progress
      const rg = ctx.createLinearGradient(bx, by, bx+bw, by);
      rg.addColorStop(0.00, '#0a0420');
      rg.addColorStop(0.18, '#220a60');
      rg.addColorStop(0.38, '#4422aa');
      rg.addColorStop(0.56, '#6633cc');
      rg.addColorStop(0.72, '#8844ee');
      rg.addColorStop(0.84, '#aa77ff');
      rg.addColorStop(0.93, '#ccbbff');
      rg.addColorStop(0.97, '#eeddff');
      rg.addColorStop(1.00, '#ffffff');
      ctx.shadowColor = prog>0.82?'#aa77ff':prog>0.52?'#7744ee':'#3311aa';
      ctx.shadowBlur  = 4 + prog * 22;
      drawRoundRect(bx, by, bw*prog, bh, 5, rg, null);
    }
    ctx.restore();
  }

  // Goal dots
  if (!endless) {
    txt('Run Progress', RP.x+RP.w/2, RP.y+116, {size:9,color:'rgba(200,170,120,0.55)',align:'center'});
    for (let i = 0; i < GOAL_TARGETS.length; i++) {
      const dx = RP.x + 14 + i*(RP.w-28)/(GOAL_TARGETS.length-1);
      ctx.save();
      if (i<runGoal) { ctx.fillStyle='#c89960'; ctx.shadowColor='#c89960'; ctx.shadowBlur=2; }
      else if (i===runGoal) { ctx.fillStyle='#7733ee'; ctx.shadowColor='#7733ee'; ctx.shadowBlur=4; }
      else { ctx.fillStyle='#1a1240'; }
      ctx.beginPath(); ctx.arc(dx, RP.y+128, 5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  } else {
    txt(`Stage ${runGoal+1}`, RP.x+RP.w/2, RP.y+120, {size:13,color:'#8844ee',align:'center',bold:true});
  }

  txt(`Rerolls: ${rerollsLeft} / ${REROLLS_PER_HAND}`, RP.x+RP.w/2, RP.y+150, {size:10,color:'rgba(200,170,120,0.55)',align:'center'});
  txt('Total Score', RP.x+RP.w/2, RP.y+176, {size:9,color:'rgba(200,170,120,0.55)',align:'center'});
  txt((totalFateScore+roundScore).toLocaleString(), RP.x+RP.w/2, RP.y+196, {size:15,color:'#e6c590',align:'center',bold:true});

  // Exit portal
  exitPortalPulse += 0.05;
  const epLabel = (nextTarget?.title ?? 'Jam Hub').slice(0,14);
  drawPortalRing(RP.x+RP.w/2, RP.y+RP.h-44, 24, '#22aadd', exitPortalPulse, epLabel, true);

  // Pause button
  const pbx=RP.x+RP.w-36, pby=RP.y+5, pbw=28, pbh=22;
  drawRoundRect(pbx,pby,pbw,pbh,4,'rgba(10,6,24,0.85)',paused?'#c89960':'#2a1860');
  txt('⏸', pbx+pbw/2, pby+pbh/2+5, {size:11,color:paused?'#c89960':'#887060',align:'center'});

  drawParticles();
  drawRings();
  drawFloaters();
  drawComboPop();
  drawBanner();

  // Drag ghost — draw dragged die at cursor with glow
  if (dragTraySlot !== -1 && trayOrder[dragTraySlot] !== undefined) {
    const di = trayOrder[dragTraySlot];
    const pulse = 0.7 + 0.2*Math.sin(t*6);
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.shadowColor = '#aa55ff';
    ctx.shadowBlur  = 18 * pulse;
    drawDie3D(dice[di], hoverX, hoverY, DICE_SIZE, diceUpgrades[di]);
    ctx.restore();
  }

  if (flashAlpha > 0) {
    ctx.save(); ctx.globalAlpha=flashAlpha; ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H); ctx.restore();
    flashAlpha = Math.max(0, flashAlpha - 0.035);
  }
}

// ─── SCREEN: Shop ─────────────────────────────────────────────────────
function drawShop(t) {
  drawBG(t);
  txt('THE SHOP', W/2, 42, {size:24,color:'#aa66ff',align:'center',bold:true,shadow:'#aa66ff'});
  txt(`Goal ${runGoal} cleared!  ·  Spend your shards before continuing.`, W/2, 60, {size:11,color:'rgba(180,160,255,0.55)',align:'center'});
  drawRoundRect(W-158, 14, 144, 34, 8, 'rgba(200,153,96,0.08)', '#b8a874', 1.5);
  txt(`◆ ${shards} Shards`, W - 86, 36, {size:13,color:'#b8a874',align:'center',bold:true});

  // Tabs
  const tabY = 72;
  drawBtn({x:W/2-260, y:tabY, w:162, h:34}, '⚡ Anomalies', true, shopTab==='oracles');
  drawBtn({x:W/2-82,  y:tabY, w:154, h:34}, '⬡ Runes',     true, shopTab==='runes');
  drawBtn({x:W/2+82,  y:tabY, w:162, h:34}, '⚄ Dice',      true, shopTab==='upgrades');

  const rerollCost = 3;
  const canReroll  = shards >= rerollCost;
  drawBtn({x:W/2+100, y:H-54, w:140, h:40}, `🜂 Reroll ◆${rerollCost}`, canReroll, canReroll);
  drawBtn({x:W/2-240, y:H-54, w:190, h:40}, 'Continue →', true, true);

  if (shopTab === 'oracles') {
    txt('BUY ANOMALIES — each grants a passive power for the rest of your run',
      W/2, 122, {size:10,color:'rgba(140,160,200,0.6)',align:'center',bold:true});
    if (shopStock.oracles.length === 0) {
      txt('No anomalies available — you own them all!', W/2, 300, {size:14,color:'rgba(160,180,255,0.45)',align:'center'});
    } else {
      const cW=218, cH=238, cGap=20;
      const cTotal = shopStock.oracles.length * (cW+cGap) - cGap;
      const cX0    = W/2 - cTotal/2;
      shopStock.oracles.forEach((o, i) => {
        const ox = cX0 + i*(cW+cGap), oy = 134;
        const cost = oracleCost(o);
        const canAfford = shards >= cost && heldOracles.length < MAX_ORACLES;
        drawOracleCard(o, ox, oy, cW, cH, false);
        drawBtn({x:ox+18, y:oy+cH+6, w:cW-36, h:32}, `◆ ${cost} Shards`, canAfford, canAfford);
        if (!canAfford && heldOracles.length >= MAX_ORACLES)
          txt('(anomalies full)', ox+cW/2, oy+cH+48, {size:9,color:'rgba(200,180,255,0.35)',align:'center'});
      });
    }

  } else if (shopTab === 'runes') {
    txt('BUY RUNES — equip them to dice in the Rune Table',
      W/2, 122, {size:10,color:'rgba(140,200,160,0.6)',align:'center',bold:true});
    const rW=218, rH=170, rGap=20;
    const rTotal = shopStock.runes.length * (rW+rGap) - rGap;
    const rX0    = W/2 - rTotal/2;
    shopStock.runes.forEach((r, i) => {
      const rx = rX0 + i*(rW+rGap), ry = 140;
      const canAfford = shards >= r.cost;
      const hov = inRect(hoverX, hoverY, {x:rx, y:ry, w:rW, h:rH});
      const tierCol = RUNE_TIERS[r.tier] || '#888';
      ctx.save();
      if (hov && canAfford) { ctx.shadowColor = tierCol; ctx.shadowBlur = 8; }
      drawRoundRect(rx, ry, rW, rH, 10,
        hov ? 'rgba(18,6,36,0.95)' : 'rgba(12,4,28,0.85)',
        canAfford ? (hov ? tierCol : 'rgba(120,80,200,0.65)') : 'rgba(70,50,100,0.35)',
        hov ? 2.5 : 1.5);
      ctx.restore();
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `28px ui-sans-serif,sans-serif`;
      ctx.fillStyle = tierCol; ctx.shadowColor = tierCol; ctx.shadowBlur = 6;
      ctx.fillText(r.icon, rx+rW/2, ry+38);
      ctx.restore();
      txt(r.name,   rx+rW/2, ry+58,  {size:13,color:'#fff',       align:'center',bold:true});
      txt(r.desc,   rx+rW/2, ry+76,  {size:10,color:'#c89960',    align:'center'});
      txt(r.tier.toUpperCase(), rx+rW/2, ry+94, {size:9,color:tierCol,align:'center',bold:true});
      txt(`◆ ${r.cost} Shards`, rx+rW/2, ry+118, {size:11,color:canAfford?'#b8a874':'rgba(180,150,100,0.5)',align:'center',bold:true});
      txt(canAfford?'click to buy':'not enough shards', rx+rW/2, ry+138,
        {size:9,color:canAfford?'rgba(255,200,80,0.7)':'rgba(200,170,120,0.35)',align:'center'});
    });

  } else {
    const poolFull = diceUpgrades.length >= MAX_DICE;
    txt(poolFull ? `POOL FULL (${MAX_DICE} dice max)` : `BUY DICE — adds a new die to your pool  (${diceUpgrades.length}/${MAX_DICE})`,
      W/2, 122, {size:10,color:poolFull?'#ff8844':'rgba(200,170,120,0.55)',align:'center',bold:true});
    const upgW=188, upgH=138, upgGap=14;
    const upgTotal = shopStock.upgrades.length * (upgW+upgGap) - upgGap;
    const upgX0    = W/2 - upgTotal/2;
    shopStock.upgrades.forEach((upg, i) => {
      const ux = upgX0 + i*(upgW+upgGap), uy = 134;
      const canAfford = shards >= upg.cost && !poolFull;
      const hov = inRect(hoverX, hoverY, {x:ux, y:uy, w:upgW, h:upgH});
      if (hov) markHover(`shopDie:${upg.id}:${i}`, upg.name, upgradeTooltipBody(upg), {color:upg.color,cost:upg.cost});
      ctx.save();
      if (hov && canAfford) { ctx.shadowColor = upg.color; ctx.shadowBlur = 6; }
      drawRoundRect(ux, uy, upgW, upgH, 10,
        hov ? 'rgba(18,6,36,0.95)' : 'rgba(12,4,28,0.85)',
        canAfford ? (hov ? upg.color : 'rgba(140,90,220,0.65)') : 'rgba(70,50,100,0.35)',
        hov ? 2.5 : 1.5);
      ctx.restore();
      drawDieMini(ux+upgW/2, uy+26, 36, upg);
      txt(upg.name,  ux+upgW/2, uy+52,  {size:12,color:'#fff',  align:'center'});
      txt(upg.desc,  ux+upgW/2, uy+68,  {size:10,color:'#c89960',align:'center'});
      txt(`◆ ${upg.cost} Shards`, ux+upgW/2, uy+92, {size:11,color:canAfford?'#b8a874':'rgba(180,150,100,0.5)',align:'center',bold:true});
      txt(canAfford?'click to buy':poolFull?'pool full':'not enough shards',
        ux+upgW/2, uy+114, {size:9,color:canAfford?'rgba(255,200,80,0.7)':'rgba(200,170,120,0.35)',align:'center'});
    });
  }

  drawParticles(); drawFloaters();
}

// ─── SCREEN: Hub ──────────────────────────────────────────────────────
function drawHub(t) {
  drawBG(t);
  txt('CAMPAIGN MAP', W/2, 44, {size:24,color:'#8844ee',align:'center',bold:true,shadow:'#8844ee'});
  txt(runGoal === 0 ? 'Choose your path — press Next Goal to begin' : `Goal ${runGoal} cleared  ·  +${hubEarnedShards} Shards earned`, W/2, 72, {size:13,color:'#b8a874',align:'center'});

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
    ctx.strokeStyle = i < runGoal ? '#c89960' : 'rgba(60,40,120,0.5)';
    ctx.lineWidth = 3; ctx.setLineDash(i < runGoal ? [] : [6,5]);
    ctx.beginPath(); ctx.moveTo(x1+22, mapY); ctx.lineTo(x2-22, mapY); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }
  for (let i = 0; i < nodes.length; i++) {
    const gx = mapXS + (i/(nodes.length-1))*(mapXE-mapXS);
    const cleared = i < runGoal, current = i === runGoal;
    const col = cleared ? '#c89960' : current ? '#8833ff' : '#1a1240';
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = cleared||current ? 14 : 0;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(gx, mapY, 20, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = cleared ? '#ffe066' : current ? '#aa66ff' : '#2a1e55';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gx, mapY, 20, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = cleared ? '#0a0820' : current ? '#fff' : '#4a3880';
    ctx.font = 'bold 12px ui-sans-serif,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(cleared ? '✓' : String(i+1), gx, mapY+5);
    const lbl = nodes[i]>=10000 ? (nodes[i]/1000|0)+'k' : nodes[i]>=1000 ? (nodes[i]/1000).toFixed(1)+'k' : String(nodes[i]);
    txt(lbl, gx, mapY+38, {size:10,color:cleared?'#c89960':current?'#aa66ff':'rgba(140,120,200,0.5)',align:'center'});
  }

  // Owned oracle row
  if (heldOracles.length > 0) {
    txt('YOUR ANOMALIES', 90, 232, {size:9,color:'rgba(140,160,200,0.6)',align:'left',bold:true});
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
      drawDieMini(ux+24, 366, 30, u);
    });
  }

  // Action buttons — Rune Table + Next Goal
  const BY = H - 84;
  drawBtn({x:W/2-310,y:BY,w:260,h:50}, '✦ Rune Table', true, runeInventory.length > 0);
  txt(`${runeInventory.length} rune${runeInventory.length!==1?'s':''}`, W/2-180, BY+64, {size:9,color:'#cc88ff',align:'center'});
  drawBtn({x:W/2+50,y:BY,w:260,h:50}, 'Next Goal →', true, true);

  drawParticles(); drawFloaters();
}

// ─── Die visual helpers ───────────────────────────────────────────────
function _diePipPos(pattern, count, hs) {
  if (pattern === 'triangle') return [[0,-hs*0.32],[-hs*0.3,hs*0.25],[hs*0.3,hs*0.25]].slice(0,count);
  if (pattern === 'corners')  return [[-hs*0.42,-hs*0.36],[hs*0.42,-hs*0.36],[-hs*0.42,hs*0.36],[hs*0.42,hs*0.36]].slice(0,count);
  if (pattern === 'ring')     return Array.from({length:count},(_,i)=>{const a=(i/count)*Math.PI*2-Math.PI/2;return[hs*0.38*Math.cos(a),hs*0.38*Math.sin(a)];});
  if (pattern === 'row')      return Array.from({length:count},(_,i)=>[((i-(count-1)/2))*hs*0.44,0]);
  return [[0,0]];
}

function _dieDefaultVis(upg) {
  const m = {
    iron:     {shape:'hex',   decoration:'pips',    pipCount:4, pipPattern:'corners'},
    glass:    {shape:'round', decoration:'text',    label:'×1.5', labelSize:0.27, overlayOutline:'diamond'},
    lucky:    {shape:'round', decoration:'pips',    pipCount:3, pipPattern:'triangle', pipStyle:'char', pipChar:'★', pipGlow:true, pipSize:0.3},
    cursed:   {shape:'round', decoration:'text',    label:'×2', sublabel:'−1M', sublabelY:0.25, labelGlow:true},
    volatile: {shape:'round', decoration:'text',    label:'?', labelSize:0.48, sublabel:'d12', sublabelY:-0.3, sublabelAlpha:0.55, labelGlow:true},
    ember:    {shape:'round', decoration:'pips',    pipCount:3, pipPattern:'triangle', pipGlow:true, pipSize:0.11},
    heavy:    {shape:'round', decoration:'text',    label:'×3', sublabel:'⛓', sublabelY:0.25, sublabelAlpha:0.65},
    mirror:   {shape:'round', decoration:'pips',    pipCount:4, pipPattern:'corners', divider:true},
    wicked:   {shape:'round', decoration:'outline', outlineShape:'pentagon', labelGlow:true},
  };
  return m[upg.id] || {shape:'round', decoration:'text', label:upg.icon||'?', labelGlow:true};
}

function drawDieMini(cx, cy, sz, upg) {
  const vis = upg.visual || _dieDefaultVis(upg);
  const hs = sz / 2;
  const color = upg.color;
  const cr = parseInt(color.slice(1,3),16), cg = parseInt(color.slice(3,5),16), cb = parseInt(color.slice(5,7),16);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  if (vis.shape === 'hex') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, cx + hs * Math.cos(a), cy + hs * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = '#1a1e28'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  } else {
    const bg = `rgba(${Math.round(cr*0.09)},${Math.round(cg*0.09)},${Math.round(cb*0.09)},0.96)`;
    drawRoundRect(cx-hs, cy-hs, sz, sz, sz*0.18, bg, color, 1.5);
  }

  if (vis.decoration === 'pips') {
    const pts = _diePipPos(vis.pipPattern||'triangle', vis.pipCount||3, hs);
    if (vis.pipGlow) { ctx.shadowColor = color; ctx.shadowBlur = 6; }
    pts.forEach(([px,py]) => {
      if (vis.pipStyle === 'char') {
        ctx.fillStyle = color; ctx.font = `${sz*(vis.pipSize||0.3)}px sans-serif`;
        ctx.fillText(vis.pipChar||'★', cx+px, cy+py+sz*0.05);
      } else {
        ctx.beginPath(); ctx.arc(cx+px, cy+py, sz*(vis.pipSize||0.09), 0, Math.PI*2);
        ctx.fillStyle = color; ctx.fill();
      }
    });
    ctx.shadowBlur = 0;
  } else if (vis.decoration === 'outline') {
    ctx.strokeStyle = color; ctx.lineWidth = sz*0.06;
    if (vis.labelGlow) { ctx.shadowColor = color; ctx.shadowBlur = 5; }
    ctx.beginPath();
    if (!vis.outlineShape || vis.outlineShape === 'pentagon') {
      for (let i = 0; i < 5; i++) {
        const a = (i*4*Math.PI/5) - Math.PI/2;
        (i ? ctx.lineTo : ctx.moveTo).call(ctx, cx+hs*0.62*Math.cos(a), cy+hs*0.62*Math.sin(a));
      }
      ctx.closePath(); ctx.stroke();
    } else if (vis.outlineShape === 'diamond') {
      ctx.moveTo(cx,cy-hs*0.65); ctx.lineTo(cx+hs*0.55,cy); ctx.lineTo(cx,cy+hs*0.65); ctx.lineTo(cx-hs*0.55,cy); ctx.closePath(); ctx.stroke();
    } else if (vis.outlineShape === 'hexagram') {
      for (let s = 0; s < 2; s++) {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i*2*Math.PI/3)+s*Math.PI/3-Math.PI/6;
          (i ? ctx.lineTo : ctx.moveTo).call(ctx, cx+hs*0.58*Math.cos(a), cy+hs*0.58*Math.sin(a));
        }
        ctx.closePath(); ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
  } else {
    const hasSubl = !!(vis.sublabel);
    const labelY = cy + sz*(vis.labelY||0);
    if (vis.labelGlow !== false) { ctx.shadowColor = color; ctx.shadowBlur = 6; }
    ctx.fillStyle = color; ctx.font = `bold ${sz*(vis.labelSize||0.32)}px sans-serif`;
    ctx.fillText(vis.label||upg.icon||'?', cx, labelY + (hasSubl ? sz*0.08 : 0));
    ctx.shadowBlur = 0;
    if (hasSubl) {
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${vis.sublabelAlpha??0.6})`;
      ctx.font = `${sz*(vis.sublabelSize||0.19)}px sans-serif`;
      ctx.fillText(vis.sublabel, cx, vis.sublabelY !== undefined ? cy+sz*vis.sublabelY : labelY-sz*0.28);
    }
  }

  if (vis.overlayOutline) {
    ctx.shadowBlur = 0; ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.45)`; ctx.lineWidth = 1;
    ctx.beginPath();
    if (vis.overlayOutline === 'diamond') {
      ctx.moveTo(cx,cy-hs*0.68); ctx.lineTo(cx+hs*0.55,cy); ctx.lineTo(cx,cy+hs*0.68); ctx.lineTo(cx-hs*0.55,cy); ctx.closePath();
    }
    ctx.stroke();
  }
  if (vis.divider) {
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(190,215,240,0.4)'; ctx.lineWidth = 0.8;
    ctx.setLineDash([2,2]); ctx.beginPath(); ctx.moveTo(cx-hs*0.7,cy); ctx.lineTo(cx+hs*0.7,cy); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

// ─── SCREEN: Forge ────────────────────────────────────────────────────
// ─── Rune Table ───────────────────────────────────────────────────────
function runeTableLayout() {
  const poolSize   = diceUpgrades.length;
  const gap        = poolSize <= 5 ? 18 : 6;
  const dieCardW   = poolSize <= 5 ? 148 : Math.floor((W - 40 - (poolSize - 1) * gap) / poolSize);
  const dieCardH   = Math.round(dieCardW * 200 / 148);
  const totalW     = poolSize * dieCardW + (poolSize - 1) * gap;
  const dieCardX   = (W - totalW) / 2;
  const dieCardY   = 96;
  return { dieCardX, dieCardY, dieCardW, dieCardH, dieCardGap: gap, poolSize };
}

function drawRuneSlotBox(x, y, w, h, rune, selected) {
  const col = rune ? (RUNE_TIERS[rune.tier] || '#777') : 'rgba(255,255,255,0.07)';
  const bg  = rune ? `rgba(${hexToRgb(col)},0.12)` : 'rgba(255,255,255,0.03)';
  drawRoundRect(x, y, w, h, 7, bg, selected ? '#ffffff' : col, selected ? 2.5 : 1.5);
  if (rune) {
    ctx.fillStyle = col;
    ctx.font = `bold 17px ui-sans-serif,sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(rune.icon, x + w/2, y + h/2 - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `9px ui-sans-serif,sans-serif`;
    ctx.fillText(rune.name, x + w/2, y + h/2 + 10);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '18px ui-sans-serif,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+', x + w/2, y + h/2 + 6);
  }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function drawRuneTable(t) {
  drawBG(t);
  txt('✦ RUNE TABLE', W/2, 44, {size:24, color:'#cc88ff', align:'center', bold:true, shadow:'#9944cc'});
  txt('Enchant your dice — select a rune then click a slot', W/2, 68, {size:12, color:'rgba(180,160,220,0.7)', align:'center'});

  const {dieCardX, dieCardY, dieCardW, dieCardH, dieCardGap, poolSize} = runeTableLayout();
  const sc = dieCardW / 148;

  // Die cards
  for (let di = 0; di < poolSize; di++) {
    const cx = dieCardX + di * (dieCardW + dieCardGap);
    const cy = dieCardY;
    const upg = diceUpgrades[di];
    const tierCol = upg ? upg.color : '#556070';
    const isExtra = di >= DICE_COUNT;

    // Card background
    drawRoundRect(cx, cy, dieCardW, dieCardH, 10, 'rgba(14,10,28,0.92)', tierCol, 1.5);
    if (isExtra) {
      drawRoundRect(cx, cy, dieCardW, dieCardH, 10, 'transparent', '#3355aa', 1);
    }

    // Tooltip for die card (upper portion, above rune slots)
    const slotY_base = cy + dieCardH - Math.round(58 * sc);
    if (inRect(hoverX, hoverY, {x:cx, y:cy, w:dieCardW, h:slotY_base - cy})) {
      const tipName = upg ? upg.name : 'Plain Die';
      const tipColor = upg ? upg.color : '#aab8cc';
      markHover(`runeTableDie:${di}`, tipName, dieTooltipBody(di), { color: tipColor });
    }

    // Die preview
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx+4, cy+4, dieCardW-8, Math.round(100*sc));
    ctx.clip();
    drawDieMini(cx + dieCardW/2, cy + Math.round(52*sc), Math.round(44*sc), upg || {id:'plain', name:'Plain Die', icon:'⚄', color:'#e0d3b8'});
    ctx.restore();

    // Die name
    txt(upg ? upg.name : 'Plain Die', cx + dieCardW/2, cy + Math.round(114*sc),
      {size:Math.max(7, Math.round(10*sc)), color: upg ? upg.color : '#aab8cc', align:'center', bold:true});

    // Rune slots label
    txt('RUNES', cx + dieCardW/2, cy + Math.round(132*sc),
      {size:Math.max(6, Math.round(8*sc)), color:'rgba(180,160,220,0.5)', align:'center', bold:true});

    // 2 rune slots
    const slotW = Math.round(dieCardW/2 - 14*sc);
    const slotH = Math.round(46*sc);
    const slotY = cy + dieCardH - Math.round(58*sc);
    for (let si = 0; si < MAX_RUNE_SLOTS; si++) {
      const sx  = cx + Math.round(10*sc) + si * (slotW + Math.round(8*sc));
      const rune = diceRunes[di] && diceRunes[di][si];
      const selSlot = runeSelSlot && runeSelSlot.die === di && runeSelSlot.slot === si;
      const canDrop = runeSelInv !== null && !rune;
      drawRuneSlotBox(sx, slotY, slotW, slotH, rune, selSlot || canDrop);
      if (inRect(hoverX, hoverY, {x:sx, y:slotY, w:slotW, h:slotH}) && rune) {
        markHover(`runeSlot:${di}:${si}`, rune.name, `${rune.desc}\n\nTier: ${rune.tier}\nClick to unequip`, {color: RUNE_TIERS[rune.tier]});
      }
    }

    // Sell / drop button below card
    if (upg || isExtra) {
      const btnY = cy + dieCardH + 4;
      const btnH = 20;
      const refund = upg ? Math.floor(upg.cost / 2) : 0;
      const label = isExtra ? `Sell ◆${refund}` : `Sell ◆${refund}`;
      const btnHov = inRect(hoverX, hoverY, {x:cx, y:btnY, w:dieCardW, h:btnH});
      drawRoundRect(cx, btnY, dieCardW, btnH, 5,
        btnHov ? 'rgba(200,40,60,0.25)' : 'rgba(160,20,40,0.12)',
        btnHov ? '#ff4466' : '#882244', 1);
      txt(label, cx + dieCardW/2, btnY + 13,
        {size:Math.max(7, Math.round(9*sc)), color: btnHov ? '#ff8899' : '#cc6677', align:'center', bold:true});
      if (btnHov) markHover(`sellDie:${di}`, label, isExtra ? 'Remove this die from your pool' : 'Strip the upgrade off this die slot', {color:'#ff4466'});
    }
  }

  // Inventory section — pushed down to clear sell buttons
  const invY = dieCardY + dieCardH + 32;
  txt('YOUR RUNES', 80, invY - 8, {size:9, color:'rgba(180,160,220,0.55)', align:'left', bold:true});

  if (runeInventory.length === 0) {
    txt('No runes — buy them in the Shop after each round',
      W/2, invY + 44, {size:11, color:'rgba(160,140,200,0.4)', align:'center'});
  }

  for (let ri = 0; ri < runeInventory.length; ri++) {
    const rune = runeInventory[ri];
    const rx   = 80 + ri * 90;
    const ry   = invY;
    const col  = RUNE_TIERS[rune.tier] || '#777';
    const sel  = runeSelInv === ri;
    const cardH_inv = 100;
    drawRoundRect(rx, ry, 80, cardH_inv, 9,
      sel ? `rgba(${hexToRgb(col)},0.22)` : `rgba(${hexToRgb(col)},0.08)`,
      sel ? '#ffffff' : col, sel ? 2.5 : 1.5);
    if (sel) {
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); roundRect(rx, ry, 80, cardH_inv, 9); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = col;
    ctx.font = `bold 22px ui-sans-serif,sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(rune.icon, rx + 40, ry + 28);
    txt(rune.name, rx + 40, ry + 44, {size:8, color:'rgba(255,255,255,0.65)', align:'center', bold:true});
    txt(rune.tier, rx + 40, ry + 55, {size:7, color: col, align:'center'});
    ctx.save();
    ctx.fillStyle = 'rgba(220,200,160,0.75)';
    ctx.font = '7px ui-sans-serif,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rune.desc, rx + 40, ry + 70, 72);
    ctx.restore();
    txt('click to select', rx + 40, ry + 88, {size:6, color:'rgba(255,255,255,0.25)', align:'center'});

    if (inRect(hoverX, hoverY, {x:rx, y:ry, w:80, h:cardH_inv})) {
      markHover(`runeInv:${ri}`, rune.name, `${rune.desc}\n\nTier: ${rune.tier}\nClick to select, then click a die slot`, {color: col});
    }
  }

  // Instruction hint
  if (runeSelInv !== null) {
    const rune = runeInventory[runeSelInv];
    txt(`${rune.icon} ${rune.name} selected — click an empty slot on a die to enchant it`,
      W/2, H - 76, {size:11, color: RUNE_TIERS[rune.tier] || '#cc88ff', align:'center'});
  }

  // Back button
  drawBtn({x:W/2-80, y:H-58, w:160, h:40}, '← Back to Map', true, true);

  drawParticles(); drawFloaters();
}

function drawForge(t) {
  drawBG(t);
  txt('THE FORGE', W/2, 42, {size:24,color:'#b35838',align:'center',bold:true,shadow:'#b35838'});
  drawRoundRect(W-158,14,144,34,8,'rgba(200,153,96,0.08)','#b8a874',1.5);
  txt(`◆ ${shards} Shards`, W-86, 36, {size:13,color:'#b8a874',align:'center',bold:true});

  // Tabs
  const tabY = 64;
  drawBtn({x:W/2-170,y:tabY,w:160,h:34}, '⚄ Dice Upgrades', true, forgeTab==='dice');
  drawBtn({x:W/2+10, y:tabY,w:160,h:34}, '⚡ Anomaly Store', true, forgeTab==='oracles');

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
      drawDieMini(ux+upgW/2, uy+26, 36, upg);
      txt(upg.name, ux+upgW/2, uy+52, {size:12,color:'#fff',align:'center'});
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
      if (ex) drawDieMini(px+poolW/2, py+poolW/2, 28, ex);
      else    txt('⚅', px+poolW/2, py+poolW/2+6, {size:18,color:'#e0d3b8',align:'center'});
    }
    // Reroll offerings
    const rerollCost = 3;
    const canReroll  = shards >= rerollCost;
    drawBtn({x:W/2+90,y:H-54,w:140,h:40}, `🜂 Reroll ◆${rerollCost}`, canReroll, canReroll);
  } else {
    // Oracle store
    txt('BUY ANOMALIES WITH SHARDS', W/2, 122, {size:10,color:'rgba(140,160,200,0.6)',align:'center',bold:true});
    if (forgeChoices.oracles.length === 0) {
      txt('No anomalies available — you own them all!', W/2, 280, {size:14,color:'rgba(160,180,255,0.45)',align:'center'});
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
        if (!canAfford && heldOracles.length>=MAX_ORACLES) txt('(anomalies full)',ox+cW/2,oy+cH+48,{size:9,color:'rgba(200,180,255,0.35)',align:'center'});
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
  if (Math.random()<0.04) burst(Math.random()*W, Math.random()*H, Math.random()<0.5?'#c89960':'#aa66ff', 3, 4);

  ctx.save();
  ctx.textAlign='center'; ctx.shadowColor='#c89960'; ctx.shadowBlur=14;
  ctx.fillStyle='#c89960'; ctx.font='bold 64px ui-sans-serif,sans-serif';
  ctx.fillText('FATE DEFIED', W/2, H/2-92); ctx.restore();

  txt('All 8 Goals conquered!', W/2, H/2-44, {size:18,color:'#fff',align:'center'});
  txt('Total Score:', W/2, H/2+6, {size:13,color:'rgba(200,180,255,0.7)',align:'center'});
  txt(totalFateScore.toLocaleString(), W/2, H/2+44, {size:38,color:'#c89960',align:'center',bold:true,shadow:'#c89960'});
  txt('✦ Endless Mode Unlocked ✦', W/2, H/2+74, {size:14,color:'#b8a874',align:'center',bold:true});

  if (!nameEntryActive) {
    drawBtn({x:W/2-130,y:H/2+90,w:260,h:46}, '🏆  Save Score', true, true);
  } else {
    drawRoundRect(W/2-130, H/2+90, 260, 46, 8, '#100828', '#c89960', 2);
    txt((nameEntry||'') + (Math.floor(t*2)%2?'|':''), W/2, H/2+120, {size:16,color:'#c89960',align:'center'});
    txt('Type name + Enter', W/2, H/2+140, {size:10,color:'rgba(200,153,96,0.5)',align:'center'});
  }

  exitPortalPulse += 0.05; returnPortalPulse += 0.05;
  drawPortalRing(W-52, H/2, 32, '#22aadd', exitPortalPulse, epLabel(), true);
  if (incoming.ref) drawPortalRing(52, H/2, 32, '#b8a874', returnPortalPulse, '← Return', true);

  drawParticles(); drawFloaters();
}

function epLabel() { return (nextTarget?.title ?? 'Jam Hub').slice(0,14); }

// ─── SCREEN: Scores ───────────────────────────────────────────────────
function drawScores(t) {
  if (scoresTab === 'global' && !onlineFetched && !onlineLoading) fetchOnlineScores();

  drawBG(t);
  txt('HIGH SCORES', W/2, 66, {size:34,color:'#c89960',align:'center',bold:true,shadow:'#c89960'});

  // Tab buttons
  ['local','global'].forEach((tab, i) => {
    const tx     = W/2 + (i === 0 ? -85 : 5);
    const active = scoresTab === tab;
    drawRoundRect(tx, 77, 80, 22, 5,
      active ? 'rgba(200,153,96,0.15)' : 'transparent',
      active ? '#c89960' : 'rgba(200,153,96,0.3)', 1);
    txt(tab.toUpperCase(), tx + 40, 91,
      {size:10, color: active ? '#c89960' : 'rgba(200,153,96,0.5)', align:'center', bold:active});
  });

  const headers = ['#','Name','Score','Mode'];
  const cxs     = [W/2-230, W/2-170, W/2+50, W/2+185];
  headers.forEach((h,i) => txt(h, cxs[i], 116, {size:11,color:'#8844ee',align:'left',bold:true}));

  const list = scoresTab === 'global' ? onlineScores : highScores;

  if (scoresTab === 'global' && onlineLoading) {
    txt('Loading…', W/2, 210, {size:16,color:'rgba(200,170,120,0.55)',align:'center'});
  } else if (scoresTab === 'global' && FIREBASE_URL === 'YOUR_FIREBASE_URL_HERE') {
    txt('Online scores not configured.', W/2, 210, {size:14,color:'rgba(200,170,120,0.45)',align:'center'});
  } else if (list.length === 0) {
    txt('No scores yet — go play!', W/2, 210, {size:16,color:'rgba(200,170,120,0.55)',align:'center'});
  } else {
    list.slice(0,8).forEach((s,i) => {
      const y   = 144 + i*38;
      const col = i===0 ? '#c89960' : 'rgba(230,210,160,0.85)';
      if (i===0) drawRoundRect(W/2-248,y-24,496,34,6,'rgba(200,153,96,0.06)','#c89960',1);
      txt(String(i+1),    cxs[0], y, {size:14,color:col,align:'left',bold:i===0});
      txt(s.name||'?',    cxs[1], y, {size:14,color:col,align:'left',bold:i===0});
      txt(Number(s.score).toLocaleString(), cxs[2], y, {size:14,color:col,align:'left',bold:i===0});
      txt(s.mode||'run',  cxs[3], y, {size:11,color:'rgba(200,170,120,0.55)',align:'left'});
    });
  }

  drawBtn({x:W/2-100,y:H-68,w:200,h:40}, '← Back to Menu', true);
}

function drawVolumeSlider(label, x, y, totalW, value) {
  const indent = label ? 70 : 0;
  const tx = x + indent, tw = totalW - indent - 40, trackH = 6, thumbR = 7;
  if (label) txt(label, x, y + 4, {size:10, color:'rgba(200,180,140,0.75)'});
  ctx.save();
  // Track bg
  ctx.fillStyle = 'rgba(30,15,50,0.85)';
  ctx.strokeStyle = 'rgba(100,80,150,0.45)'; ctx.lineWidth = 1;
  roundRect(tx, y - trackH/2, tw, trackH, 3);
  ctx.fill(); ctx.stroke();
  // Fill
  if (value > 0) {
    ctx.fillStyle = '#c89960'; ctx.shadowColor = '#c89960'; ctx.shadowBlur = 5;
    roundRect(tx, y - trackH/2, value * tw, trackH, 3);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // Thumb
  const thumbX = tx + value * tw;
  ctx.fillStyle = dragSlider ? '#fff8e0' : '#e0c590';
  ctx.shadowColor = '#c89960'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(thumbX, y, thumbR, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  txt(`${Math.round(value * 100)}%`, tx + tw + 10, y + 4, {size:9, color:'rgba(180,160,120,0.55)'});
}

// ─── SCREEN: Pause / Unlockables ──────────────────────────────────────
function drawPause(t) {
  // Dim overlay
  ctx.save();
  ctx.fillStyle = 'rgba(4,2,12,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const pw = 680, ph = 480, px = (W-pw)/2, py = (H-ph)/2;
  drawRoundRect(px, py, pw, ph, 14, 'rgba(10,5,22,0.97)', '#443366', 2);

  txt('— PAUSED —', W/2, py+28, {size:18, color:'#c89960', align:'center', bold:true, shadow:'#c89960'});

  // Three equal tabs
  const TABS = [
    { id:'unlockables', label:'✦ Unlockables', ac:['rgba(100,60,180,0.4)','#aa88ff','#cc99ff'], in:['rgba(30,15,50,0.4)','rgba(100,80,160,0.3)','rgba(160,130,220,0.5)'] },
    { id:'quick',       label:'⚙ Quick Access', ac:['rgba(60,100,60,0.4)', '#88cc88','#aaddaa'], in:['rgba(20,30,20,0.4)', 'rgba(80,120,80,0.3)', 'rgba(120,170,120,0.5)'] },
    { id:'audio',       label:'♪ Audio',        ac:['rgba(100,80,30,0.4)', '#c89960','#e0c590'], in:['rgba(30,20,8,0.4)',  'rgba(120,90,40,0.3)', 'rgba(160,130,80,0.5)']  },
  ];
  TABS.forEach(({ id, label, ac, in: ic }, i) => {
    const active = pauseTab === id;
    const tx = px+20 + i*217;
    drawRoundRect(tx, py+48, 206, 28, 6, active?ac[0]:ic[0], active?ac[1]:ic[1], 1);
    txt(label, tx+103, py+66, {size:11, color:active?ac[2]:ic[2], align:'center', bold:active});
  });

  if (pauseTab === 'unlockables') {

  // All unlockable items grouped
  const allItems = [
    ...UNLOCKABLE_DICE.map(d => ({ item:d, type:'die',    desc:d.desc,   color:d.color })),
    ...UNLOCKABLE_RUNES.map(r => ({ item:r, type:'rune',  desc:r.desc,   color:RUNE_TIERS[r.tier]||'#888' })),
    ...UNLOCKABLE_ORACLES.map(o => ({ item:o, type:'anomaly', desc:o.effect, color:o.color })),
  ];

  const cols = 3, cardW = 196, cardH = 92, cardGap = 16;
  const gridW = cols*cardW + (cols-1)*cardGap;
  const gx0 = W/2 - gridW/2, gy0 = py + 92;

  allItems.forEach(({ item, type, desc, color }, idx) => {
    const col = idx % cols, row = Math.floor(idx / cols);
    const cx = gx0 + col*(cardW+cardGap), cy = gy0 + row*(cardH+10);
    const unlocked = isUnlocked(item.unlock.id);
    const borderCol = unlocked ? color : 'rgba(100,80,140,0.4)';
    const bgCol     = unlocked ? `rgba(${hexToRgb(color)},0.08)` : 'rgba(8,4,18,0.7)';

    drawRoundRect(cx, cy, cardW, cardH, 8, bgCol, borderCol, unlocked ? 1.5 : 1);

    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.45;

    // Icon + name row
    txt(`${item.icon}  ${item.name}`, cx+10, cy+18, {size:11, color: unlocked ? color : '#aaaaaa', bold:true});
    // Type badge
    const typeLabel = type === 'die' ? 'DIE' : type === 'rune' ? 'RUNE' : 'ANOMALY';
    txt(typeLabel, cx+cardW-8, cy+18, {size:7, color: unlocked ? color : '#666688', align:'right', bold:true});
    // Description
    ctx.restore();
    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#d0c8b0';
    ctx.font = '9px ui-sans-serif,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(desc, cx+10, cy+36, cardW-20);
    ctx.restore();

    // Unlock condition
    if (unlocked) {
      txt('✓ UNLOCKED', cx+10, cy+56, {size:8, color:'#44cc88', bold:true});
    } else {
      txt('🔒 ' + item.unlock.label, cx+10, cy+56, {size:8, color:'rgba(180,150,220,0.6)'}, cardW-20);
    }

    // Tier/cost info
    const info = type === 'die' ? `◆ ${item.cost} shards` :
                 type === 'rune' ? `${(item.tier||'').toUpperCase()} · ◆ ${item.cost}` :
                 `${(item.tier||'').toUpperCase()}`;
    txt(info, cx+10, cy+74, {size:7, color: unlocked ? 'rgba(200,180,140,0.6)' : 'rgba(120,100,160,0.4)'});

    // Hover tooltip
    if (inRect(hoverX, hoverY, {x:cx, y:cy, w:cardW, h:cardH})) {
      const body = unlocked
        ? `${desc}\n\nStatus: Unlocked ✓`
        : `${desc}\n\nUnlock: ${item.unlock.label}`;
      markHover(`pause:${item.unlock.id}`, item.name, body, {color: unlocked ? color : '#886699'});
    }
  });
  } else if (pauseTab === 'quick') {
    const qaItems = [
      { label:'⬡  Rune Table',  sub:'Equip runes to your dice',                    color:'#cc88ff', by:py+130 },
      { label:'⬡  Exit Portal', sub:'Leave this run and travel to the next game',   color:'#22aadd', by:py+220 },
    ];
    qaItems.forEach(({ label, sub, color, by }) => {
      const bx = px+60, bw = pw-120, bh = 60;
      const hovering = inRect(hoverX, hoverY, {x:bx, y:by, w:bw, h:bh});
      drawRoundRect(bx, by, bw, bh, 8, hovering?'rgba(10,6,28,0.95)':'rgba(6,4,18,0.9)', color, 1.2);
      txt(label, bx+bw/2, by+22, {size:15, color, align:'center', bold:true, shadow:color});
      txt(sub,   bx+bw/2, by+42, {size:10, color:'rgba(200,180,140,0.6)', align:'center'});
    });
  } else if (pauseTab === 'audio') {
    const sx = px+60, sw = pw-120;

    // Music
    drawRoundRect(sx, py+110, sw, 100, 8, 'rgba(20,12,4,0.7)', 'rgba(120,90,40,0.4)', 1);
    txt('♪  Music', sx+16, py+132, {size:13, color:'#c89960', bold:true});
    txt('Background track', sx+16, py+150, {size:9, color:'rgba(180,150,100,0.55)'});
    drawVolumeSlider('', sx+16, py+176, sw-32, musicVolume);

    // SFX
    drawRoundRect(sx, py+228, sw, 100, 8, 'rgba(20,12,4,0.7)', 'rgba(120,90,40,0.4)', 1);
    txt('♫  Sound Effects', sx+16, py+250, {size:13, color:'#c89960', bold:true});
    txt('Dice, score ticks, and UI sounds', sx+16, py+268, {size:9, color:'rgba(180,150,100,0.55)'});
    drawVolumeSlider('', sx+16, py+294, sw-32, sfxVolume);

    // Track name footer
    txt('Now playing: Cinder Card Shuffle', px+pw/2, py+360, {size:9, color:'rgba(150,130,90,0.45)', align:'center'});
  }

  // Resume button (always at bottom)
  drawBtn({x:W/2-80, y:py+ph-52, w:160, h:36}, '▶  Resume', true, true);
}

// ─── Main loop ────────────────────────────────────────────────────────
let lastT = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const t = now / 1000;

  // Assign held dice to tray slots using trayOrder (enables drag reordering)
  {
    for (const d of dice) d.holdSlot = -1;
    for (let slot = 0; slot < trayOrder.length; slot++) {
      if (slot === dragTraySlot) continue; // dragged die floats freely
      const d = dice[trayOrder[slot]];
      if (d) d.holdSlot = slot;
    }
  }

  // Step Rapier physics (once per frame, before reading body state)
  if (rapierWorld && dice.some(d => d.rolling && d.physBody)) rapierWorld.step();

  // Update 3D dice physics
  for (let i = 0; i < dice.length; i++) {
    const d = dice[i];
    if (d.scoring) d.scoringT += dt; else d.scoringT = 0;
    if (d.landT   !== undefined && !d.rolling) d.landT   += dt;
    if (d.revealT !== undefined && !d.rolling) d.revealT += dt;
    if (d.rolling) {
      d.rollT += dt;
      const prog = Math.min(1, d.rollT / d.rollDur);

      if (d.physBody) {
        // Rapier drives angular velocity; remap rapier axes → render axes
        // rapier X→render X, rapier Z→render Y, rapier Y→render Z
        const av = d.physBody.angvel();
        d.vx = av.x; d.vy = av.z; d.vz = av.y;
        d.rx += d.vx * dt; d.ry += d.vy * dt; d.rz += d.vz * dt;
        d.settling = false;
      } else if (prog < PHYSICS.tumblePhase) {
        // Tumble coupling — linear velocity drives rotation axis perpendicular to motion
        const speed = Math.hypot(d.pvx, d.pvy);
        if (speed > 20) {
          const inv = 1 / speed;
          const mx  = d.pvx * inv, my = d.pvy * inv;
          const tumbleRate = speed * PHYSICS.tumbleRate;
          // Moving right → spin around Y; moving down → spin around X
          d.vy = d.vy * (1 - PHYSICS.spinCoupling) + mx * tumbleRate * PHYSICS.spinCoupling;
          d.vx = d.vx * (1 - PHYSICS.spinCoupling) + my * tumbleRate * PHYSICS.spinCoupling;
        }
        d.rx += d.vx * dt;
        d.ry += d.vy * dt;
        d.rz += d.vz * dt;
        const fr = Math.pow(PHYSICS.spinFriction, dt);
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
        const st   = (prog - PHYSICS.tumblePhase) / (1 - PHYSICS.tumblePhase);
        // Ease-out-quart: fast start, decisive stop — no overshoot past the face
        const ease = 1 - Math.pow(1 - Math.min(st, 1), 4);
        d.rx = d.sfRx + (d.tRx - d.sfRx) * ease;
        d.ry = d.sfRy + (d.tRy - d.sfRy) * ease;
        d.rz = d.sfRz + (d.tRz - d.sfRz) * ease;
      }
    }
    if (d.physBody && d.rolling) {
      // Rapier handles position + bounce — read body state directly
      const tr = d.physBody.translation();
      const lv = d.physBody.linvel();
      d.absX    = PHYS_CX + tr.x * PHYS_SCALE;
      d.absY    = PHYS_CZ + tr.z * PHYS_SCALE;
      d.bounceY = (RAPIER_DIE_HALF - tr.y) * PHYS_SCALE;
      d.pvx     = lv.x * PHYS_SCALE;
      d.pvy     = lv.z * PHYS_SCALE;
      // Natural settle: both linear and angular speed below threshold for 8 consecutive frames
      const linSpd = Math.hypot(lv.x, lv.y, lv.z);
      const angSpd = Math.hypot(d.vx, d.vy, d.vz); // set from angvel earlier this frame
      const isStill = linSpd < 0.15 && angSpd < 0.3;
      d.settleFrames = isStill ? (d.settleFrames | 0) + 1 : 0;
      if (d.settleFrames >= 8 || d.rollT > 5.0) settleDie(d, i);
    } else {
      // Legacy bounce physics — gravity + multi-hop while tumbling
      const speed2 = Math.hypot(d.pvx, d.pvy);
      if (d.rolling && d.bounceY >= 0 && d.bounceVY >= -0.01 && speed2 > PHYSICS.hopThreshold && (d.bounceCount|0) < PHYSICS.maxHops) {
        d.bounceVY = -(PHYSICS.hopBaseVel + Math.random() * PHYSICS.hopRandVel + speed2 * PHYSICS.hopSpeedFactor);
        d.bounceCount = (d.bounceCount|0) + 1;
      }
      if (d.bounceY < 0 || d.bounceVY < 0) {
        d.bounceVY += PHYSICS.gravity * dt;
        d.bounceY  += d.bounceVY * dt;
        if (d.bounceY > 0) {
          d.bounceY = 0;
          if (Math.abs(d.bounceVY) > 3) {
            d.bounceVY = -Math.abs(d.bounceVY) * PHYSICS.floorRestitution;
            if (d.rolling) {
              d.vx += (Math.random() - 0.5) * PHYSICS.landingSpinX;
              d.vz += (Math.random() - 0.5) * PHYSICS.landingSpinZ;
              d.pvx *= PHYSICS.landingFriction; d.pvy *= PHYSICS.landingFriction;
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

      // Legacy position physics — dice fly around the table when rolling
      if (d.rolling) {
        const hs = DICE_SIZE / 2;
        const bL = CP.x + 10 + hs, bR = CP.x + CP.w - 10 - hs;
        const bT = BOARD_Y + 10 + hs, bB = BOARD_Y + BOARD_H - 10 - hs;
        d.absX += d.pvx * dt;
        d.absY += d.pvy * dt;
        const inAir = d.bounceY < -0.5;
        const fr = inAir ? Math.pow(PHYSICS.airDrag, dt) : Math.pow(PHYSICS.groundFriction, dt);
        d.pvx *= fr; d.pvy *= fr;
        if (d.absX < bL) {
          d.absX = bL;
          const inV = -d.pvx;
          d.pvx = Math.abs(d.pvx) * PHYSICS.wallRestitution;
          d.vy += inV * PHYSICS.wallSpinY; d.vz += d.pvy * PHYSICS.wallSpinZ;
          if (inV > 80) { burst(bL, d.absY, '#c89960', 3, 2); playTone(140, 'square', 0.03, 0.04); }
        } else if (d.absX > bR) {
          d.absX = bR;
          const inV = d.pvx;
          d.pvx = -Math.abs(d.pvx) * PHYSICS.wallRestitution;
          d.vy -= inV * PHYSICS.wallSpinY; d.vz -= d.pvy * PHYSICS.wallSpinZ;
          if (inV > 80) { burst(bR, d.absY, '#c89960', 3, 2); playTone(140, 'square', 0.03, 0.04); }
        }
        if (d.absY < bT) {
          d.absY = bT;
          const inV = -d.pvy;
          d.pvy = Math.abs(d.pvy) * PHYSICS.wallRestitution;
          d.vx -= inV * PHYSICS.wallSpinY; d.vz += d.pvx * PHYSICS.wallSpinZ;
          if (inV > 80) { burst(d.absX, bT, '#c89960', 3, 2); playTone(140, 'square', 0.03, 0.04); }
        } else if (d.absY > bB) {
          d.absY = bB;
          const inV = d.pvy;
          d.pvy = -Math.abs(d.pvy) * PHYSICS.wallRestitution;
          d.vx += inV * PHYSICS.wallSpinY; d.vz -= d.pvx * PHYSICS.wallSpinZ;
          if (inV > 80) { burst(d.absX, bB, '#c89960', 3, 2); playTone(140, 'square', 0.03, 0.04); }
        }
      }
    }
    // Glide between holding tray and last board position based on lock state
    if (!d.rolling) {
      let tx = null, ty = null;
      if (d.locked && d.holdSlot >= 0) {
        const slot = holdSlotCenter(d.holdSlot);
        tx = slot.x; ty = slot.y;
      } else if (!d.locked && d.homeX != null) {
        tx = d.homeX; ty = d.homeY;
      }
      if (tx != null) {
        const dist = Math.hypot(tx - d.absX, ty - d.absY);
        if (dist < 0.5) { d.absX = tx; d.absY = ty; }
        else {
          const lerp = 1 - Math.pow(0.00001, dt);
          d.absX += (tx - d.absX) * lerp;
          d.absY += (ty - d.absY) * lerp;
        }
      }
    }
  }

  // Dice-to-dice collision — handled by Rapier when active, otherwise manual AABB
  if (!rapierWorld) {
    const hs   = DICE_SIZE / 2;
    const bL   = 18 + hs, bR = W - 18 - hs;
    const bT   = BOARD_Y + 10 + hs, bB = BOARD_Y + BOARD_H - 10 - hs;
    // Visual die footprint is DICE_SIZE * 0.96 (hs = size*0.48). Match the
    // collision box to what the eye sees so dice never bump into empty air.
    const side = DICE_SIZE * 0.96 + PHYSICS.collisionGap;
    const e    = PHYSICS.collisionRestitution;

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
        const spinKick = relTan * PHYSICS.collisionSpin;
        di.vx += spinKick * 0.75; di.vy -= spinKick * 0.75; di.vz += spinKick * 1.1;
        dj.vx -= spinKick * 0.75; dj.vy += spinKick * 0.75; dj.vz -= spinKick * 1.1;

        // Vertical hop from collision — harder hits lift the dice
        const impactMag = Math.abs(dvn);
        if (impactMag > PHYSICS.collisionHopThreshold && di.rolling) {
          di.bounceVY = Math.min(di.bounceVY, -(PHYSICS.collisionHopBase + impactMag * PHYSICS.collisionHopFactor));
          di.bounceCount = (di.bounceCount|0) + 1;
        }
        if (impactMag > PHYSICS.collisionHopThreshold && dj.rolling) {
          dj.bounceVY = Math.min(dj.bounceVY, -(PHYSICS.collisionHopBase + impactMag * PHYSICS.collisionHopFactor));
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
  if (displayScoreBounce > 0) displayScoreBounce = Math.max(0, displayScoreBounce - dt * 5);

  updateParticles(dt);
  updateRings(dt);
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
    case 'howto':      drawHowToPlay(t);  break;
    case 'nameentry':  drawNameEntry(t);  break;
    case 'game':       drawGame(t);       break;
    case 'shop':   drawShop(t);      break;
    case 'hub':    drawHub(t);       break;
    case 'rune':   drawRuneTable(t); break;
    case 'win':    drawWin(t);    break;
    case 'scores': drawScores(t); break;
  }
  ctx.restore();
  if (paused) drawPause(t);
  processTooltips(t);

  requestAnimationFrame(loop);
}

// ─── Boot ─────────────────────────────────────────────────────────────
initRapier(); // fire-and-forget — game starts immediately; Rapier activates when ready
loadScores();
loadUnlocks();
if (incoming.fromPortal) {
  playerName = incoming.username || playerName;
  nameEntry  = playerName;
  startRun(false);
  screen = 'game';
}

requestAnimationFrame(loop);
