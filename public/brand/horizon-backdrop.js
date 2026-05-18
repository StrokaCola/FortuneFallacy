/* ─────────────────────────────────────────────────────────────────────
 * Fortune Fallacy — Horizon Backdrop painter
 *
 * Paints a 2048×1280 silhouette anchored to the bottom, with the upper
 * portion fading to transparent. Six scene presets, each procedural and
 * seeded so reseeding rerolls a fresh layout.
 *
 * Style brief: hard-sci astronomical + brutalist sculpture + 70s sci-fi
 * paperback. Painterly matte texture, not airbrushed digital. Aurora-
 * violet rim glow along the horizon. 2–3 twinkle sparks at high points.
 * ───────────────────────────────────────────────────────────────────── */

const TWEAKS = /*EDITMODE-BEGIN*/{
  "scene": "hub",
  "seed": 137,
  "horizonFrac": 0.18,
  "fadeStart": 0.08,
  "auroraIntensity": 0.60,
  "haze": 0.45,
  "starDensity": 280,
  "sparkCount": 2,
  "painterly": 0.6,
  "grain": 0.35,
  "layers": 3,
  "nebula": 1.00,
  "milkyway": 0.80,
  "brightStars": 8,
  "skyConstellation": true,
  "cosmicFog": 0.85,
  "animate": true,
  "animSpeed": 0.6,
  "twinkleAmount": 0.55,
  "colorDeep":    "#07051a",
  "colorViolet":  "#1c1245",
  "colorAurora":  "#9577ff",
  "colorGold":    "#f5c451",
  "colorBone":    "#f3f0ff"
}/*EDITMODE-END*/;

// Per-scene accent tint. Drives the horizon rim glow and scene-specific
// glowing elements (lanterns, embers, crystal). The base aurora-violet
// of the brief stays as the cosmos atmosphere tint; this rides on top.
const SCENE_ACCENT = {
  hub:         '#9577ff',   // aurora-violet
  shop:        '#f5c451',   // gold leaf
  forge:       '#ff7847',   // ember orange
  astralForge: '#7be3ff',   // cyan
};
function activeAccent(){
  return SCENE_ACCENT[TWEAKS.scene] || TWEAKS.colorAurora;
}

/* ──────────────────────── utility helpers ──────────────────────── */

function makePRNG(seed){
  let s = (seed | 0) || 1;
  return () => {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex){
  const m = hex.replace('#','');
  return [
    parseInt(m.slice(0,2), 16),
    parseInt(m.slice(2,4), 16),
    parseInt(m.slice(4,6), 16),
  ];
}
function rgba(rgb, a){ return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }
function mix(a, b, t){
  return [
    Math.round(a[0]*(1-t) + b[0]*t),
    Math.round(a[1]*(1-t) + b[1]*t),
    Math.round(a[2]*(1-t) + b[2]*t),
  ];
}

/* ──────────────────────── render pipeline ──────────────────────── */

const canvas = document.getElementById('stage');
let   ctx    = canvas.getContext('2d');   // mutable — swapped during cache builds
const mainCtx = ctx;

// ─── Responsive canvas sizing ────────────────────────────────────────
// The composition is authored at a reference height of 1280 (architecture
// sized in pixels relative to this), with width derived from the actual
// container aspect ratio. This means: on narrow viewports the architecture
// stays centered with less cosmos showing on either side; on wide/ultrawide
// viewports the architecture stays the same size and the cosmos extends
// outward. The horizon stays anchored at the bottom 38% in all cases.
const DESIGN_H = 1280;                  // reference height for pixel sizing
const MAX_DPR  = 2;                     // cap DPR so backing stays affordable
let W = canvas.width;
let H = canvas.height;

function fitCanvas(){
  const host = document.getElementById('wrap');
  if(!host) return false;
  const rect = host.getBoundingClientRect();
  if(rect.width < 2 || rect.height < 2) return false;
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  // Internal logical resolution: lock height to DESIGN_H, derive width
  // from the host's actual aspect ratio.
  const aspect = rect.width / rect.height;
  const newH = DESIGN_H;
  const newW = Math.max(640, Math.round(newH * aspect));
  // Backing-store size (sharp on hi-DPR) — but cap to logical resolution
  // since rendering above 1:1 of CSS px wastes work.
  const backingW = Math.round(rect.width  * dpr);
  const backingH = Math.round(rect.height * dpr);
  // Pick whichever is smaller per axis so we never upscale needlessly.
  const finalW = Math.min(newW, backingW);
  const finalH = Math.min(newH, backingH);
  // Maintain aspect on the final backing
  const finalAspect = finalW / finalH;
  const designedAspect = aspect;
  // Snap to the designed aspect so layout math (which uses W,H) matches
  // what the user sees pixel-for-pixel.
  let outW, outH;
  if(finalAspect >= designedAspect){
    outH = finalH;
    outW = Math.round(outH * designedAspect);
  } else {
    outW = finalW;
    outH = Math.round(outW / designedAspect);
  }
  if(canvas.width === outW && canvas.height === outH) return false;
  canvas.width = outW;
  canvas.height = outH;
  W = outW;
  H = outH;
  return true;
}
fitCanvas();

if(window.ResizeObserver){
  const ro = new ResizeObserver(() => {
    if(fitCanvas()){
      staticDirty = true;
      render();
    }
  });
  ro.observe(document.getElementById('wrap'));
} else {
  window.addEventListener('resize', () => {
    if(fitCanvas()){
      staticDirty = true;
      render();
    }
  });
}

// Animation + cache state
let animTime    = 0;             // seconds since start
let rafId       = null;
let staticDirty = true;          // when true, rebuild the heavy caches
let bgCacheA   = null;          // cosmic atmosphere — phase A
let bgCacheB   = null;          // cosmic atmosphere — phase B (for crossfade)
let fogCacheA  = null;          // cosmic fog — drifting cloud layer A
let fogCacheB  = null;          // cosmic fog — drifting cloud layer B (parallax)
let fogCachePad = 0;
let bgCachePad = 0;             // horizontal padding baked into atmosphere caches
let fgCache    = null;          // silhouettes + painterly grain
let starsCache  = [];
let brightStarsCache = [];
let peaksCache  = [];
let baselineCache = 0;
let constellationCache = null;
let sceneMetaCache  = null;        // scene-specific data for per-frame animated features

/** Temporarily redirect the global ctx so paint functions land in `target`. */
function withCtx(target, fn){
  const prev = ctx;
  ctx = target;
  try { fn(); } finally { ctx = prev; }
}

/** Rebuild offscreen caches when tweaks that affect statics change. */
function rebuildStatics(){
  const baselineY = H * (1 - TWEAKS.horizonFrac);
  baselineCache = baselineY;

  // Background atmosphere caches — TWO snapshots, baked at slightly
  // different seeds. The render loop crossfades between them on a long
  // cycle so the nebula gently breathes & migrates without revealing a
  // loop seam. Generous horizontal padding (220) so the parallax drift
  // produces visible migration without exposing transparent edges.
  const PAD = 220;
  function bakeAtmosphere(seedOffset){
    const c = document.createElement('canvas');
    c.width = W + PAD * 2;
    c.height = H;
    withCtx(c.getContext('2d'), () => {
      ctx.translate(PAD, 0);
      paintCosmicAtmosphere(baselineY, seedOffset);
    });
    return c;
  }
  bgCacheA = bakeAtmosphere(0);
  bgCacheB = bakeAtmosphere(5077);
  bgCachePad = PAD;

  // Cosmic fog — separate caches that drift faster than the static
  // atmosphere. Two phases with different seeds so we can crossfade
  // them too (avoids any visible loop pattern over a long session).
  const FOG_PAD = 240;          // generous padding for visible drift
  function bakeFog(seedOffset){
    const c = document.createElement('canvas');
    c.width = W + FOG_PAD * 2;
    c.height = H;
    withCtx(c.getContext('2d'), () => {
      ctx.translate(FOG_PAD, 0);
      paintCosmicFog(baselineY, seedOffset);
    });
    return c;
  }
  fogCacheA = bakeFog(7301);
  fogCacheB = bakeFog(8809);
  fogCachePad = FOG_PAD;

  // Foreground silhouettes + grain cache (also captures peak positions
  // and scene metadata for per-frame animated features like lanterns,
  // ember sparks, hovering crystals).
  fgCache = document.createElement('canvas');
  fgCache.width = W; fgCache.height = H;
  let sceneOut = { peaks: [], meta: null };
  withCtx(fgCache.getContext('2d'), () => {
    const sceneFn = SCENES[TWEAKS.scene] || SCENES.hub;
    sceneOut = sceneFn(baselineY) || sceneOut;
    if(TWEAKS.grain > 0) paintGrain(baselineY);
  });
  peaksCache    = sceneOut.peaks || [];
  sceneMetaCache = sceneOut.meta || null;

  // Pre-roll star positions so we just animate properties at 60fps
  starsCache       = generateStars(baselineY);
  brightStarsCache = generateBrightStars(baselineY);
  constellationCache = pickConstellation(brightStarsCache);

  staticDirty = false;
}

/** Main draw loop — runs every frame when animation is on, or once per
 *  tweak/render call when off. */
function renderFrame(){
  if(staticDirty) rebuildStatics();

  ctx.clearRect(0, 0, W, H);
  drawAtmosphereAnimated(animTime);
  drawCosmicFogAnimated(animTime);
  drawAnimatedStars(starsCache, animTime);
  drawAnimatedBrightStars(brightStarsCache, animTime);
  paintAuroraRim(baselineCache, animTime);
  ctx.drawImage(fgCache, 0, 0);
  // Scene-specific animated features (lanterns, embers, hovering crystal).
  if(sceneMetaCache && SCENES[TWEAKS.scene] && SCENES[TWEAKS.scene].animated){
    SCENES[TWEAKS.scene].animated(sceneMetaCache, animTime);
  }
  paintAnimatedSparks(peaksCache, animTime);
  applyAlphaFade();
}

/** Draw the two atmosphere snapshots, crossfaded across a long cycle,
 *  each with a gentle horizontal parallax drift. The cosmos visibly
 *  breathes: nebula clusters morph in/out, the dust band migrates. */
function drawAtmosphereAnimated(t){
  if(!bgCacheA || !bgCacheB) return;

  // Long crossfade cycle — atmosphere never quite looks the same.
  // 32-second period. cos→sin offset means A and B reach 0/1 at opposite extremes.
  const PERIOD = 32;
  const phase  = (t / PERIOD) * Math.PI * 2;
  const wB = 0.5 - 0.5 * Math.cos(phase);   // 0..1
  const wA = 1 - wB;

  // Parallax drift — meaningful horizontal sway within the cache's
  // padding, different rates per phase so they don't lock in perceived
  // motion. With PAD=220, this gives ~140-150px of visible migration.
  const driftA_x = Math.sin(t * 0.040)        * (bgCachePad * 0.70);
  const driftA_y = Math.cos(t * 0.028 + 1.2)  * 8;
  const driftB_x = Math.sin(t * 0.034 + 1.4)  * (bgCachePad * 0.62);
  const driftB_y = Math.cos(t * 0.032 + 0.3)  * 8;

  // Don't over-attenuate: when both weights are mid (~0.5), gamma-correct
  // so combined visual energy ≈ a single full-opacity cache.
  const gA = Math.sqrt(wA);
  const gB = Math.sqrt(wB);

  ctx.globalAlpha = gA;
  ctx.drawImage(bgCacheA, -bgCachePad + driftA_x, driftA_y);
  ctx.globalAlpha = gB;
  ctx.drawImage(bgCacheB, -bgCachePad + driftB_x, driftB_y);
  ctx.globalAlpha = 1;
}

/** Cosmic fog — drifting cloud layer that visibly migrates across the
 *  canvas. Two phases drift at different rates for a parallax feel; the
 *  fog wraps as a slow back-and-forth across its padding region. */
function drawCosmicFogAnimated(t){
  if(!fogCacheA || !fogCacheB || TWEAKS.cosmicFog <= 0) return;
  // Layer A — primary fog, drifts left-right ~90s period
  const aSpan = fogCachePad * 0.8;
  const aDriftX = Math.sin(t * 0.07)        * aSpan;
  const aDriftY = Math.cos(t * 0.04)        * 8;
  // Layer B — slower, slightly offset, parallax + crossfade
  const bSpan = fogCachePad * 0.65;
  const bDriftX = Math.sin(t * 0.05 + 1.7) * bSpan;
  const bDriftY = Math.cos(t * 0.03 + 0.6) * 6;
  // Long crossfade between phases — gives the fog a feeling of dissolving in/out
  const CYCLE = 48;
  const w = 0.5 - 0.5 * Math.cos((t / CYCLE) * Math.PI * 2);
  ctx.globalAlpha = Math.sqrt(1 - w);
  ctx.drawImage(fogCacheA, -fogCachePad + aDriftX, aDriftY);
  ctx.globalAlpha = Math.sqrt(w);
  ctx.drawImage(fogCacheB, -fogCachePad + bDriftX, bDriftY);
  ctx.globalAlpha = 1;
}

/** Public entry: schedule the next paint. Used by tweak handlers. */
function render(){
  if(TWEAKS.animate){
    if(rafId == null) startLoop();
  } else {
    if(rafId != null){ cancelAnimationFrame(rafId); rafId = null; }
    renderFrame();
  }
}

function startLoop(){
  let last = performance.now();
  // Paint one synchronous frame BEFORE scheduling rAF. Browsers throttle
  // rAF aggressively in backgrounded / iframed / non-visible documents
  // (down to ~1 Hz or paused entirely), which would leave the canvas
  // black until the user reveals the tab. Painting once up front guarantees
  // a visible static composition even when the animation loop is paused.
  try { renderFrame(); } catch(e) { /* swallow — rAF retry will surface */ }
  function tick(now){
    animTime += ((now - last) / 1000) * TWEAKS.animSpeed;
    last = now;
    renderFrame();
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
}

/* ──────────────────────── starfield (deprecated stub) ──────────────────────── */
// Starfield is now generated via generateStars() + drawAnimatedStars()
// to allow per-star twinkle without redrawing positions each frame.

/* ──────────────────────── aurora rim (animated) ──────────────────────── */

function paintAuroraRim(baselineY, t){
  const aurora = hexToRgb(TWEAKS.colorAurora);
  const accent = hexToRgb(activeAccent());
  const rim    = mix(aurora, accent, 0.55);
  const bone   = hexToRgb(TWEAKS.colorBone);

  // Subtle breathing pulse on the rim — ±7% intensity, ~6-second period
  const pulse = 1 + 0.07 * Math.sin((t || 0) * 0.6);
  const I = TWEAKS.auroraIntensity * pulse;

  // ─── Layer 1: vertical aurora curtains rising from the horizon ───
  // Two or three thin vertical washes — feels painted, not airbrushed.
  const cRng = makePRNG(TWEAKS.seed + 619);
  const curtainCount = 3;
  for(let i = 0; i < curtainCount; i++){
    const cx = W * (0.15 + (i + cRng() * 0.5) * 0.65 / curtainCount);
    const cw = 220 + cRng() * 280;
    const ch = 220 + cRng() * 160;
    const op = 0.18 + cRng() * 0.20;
    const curtain = ctx.createLinearGradient(0, baselineY - ch, 0, baselineY);
    curtain.addColorStop(0,    rgba(rim, 0));
    curtain.addColorStop(0.4,  rgba(rim, op * I * 0.6));
    curtain.addColorStop(1,    rgba(rim, op * I));
    ctx.fillStyle = curtain;
    // Tapered: narrower at top, wider at base
    ctx.beginPath();
    ctx.moveTo(cx - cw * 0.18, baselineY - ch);
    ctx.lineTo(cx + cw * 0.18, baselineY - ch);
    ctx.lineTo(cx + cw * 0.50, baselineY);
    ctx.lineTo(cx - cw * 0.50, baselineY);
    ctx.closePath();
    ctx.fill();
  }

  // ─── Layer 2: wide soft wash above + just below the horizon ───
  const above = ctx.createLinearGradient(0, baselineY - 200, 0, baselineY + 20);
  above.addColorStop(0,    rgba(rim, 0));
  above.addColorStop(0.45, rgba(rim, 0.08 * I));
  above.addColorStop(0.85, rgba(rim, 0.30 * I));
  above.addColorStop(1,    rgba(rim, 0.42 * I));
  ctx.fillStyle = above;
  ctx.fillRect(0, baselineY - 200, W, 220);

  // ─── Layer 3: scattered horizon bloom — soft radial blobs ───
  const bRng = makePRNG(TWEAKS.seed + 757);
  const blooms = 5;
  for(let i = 0; i < blooms; i++){
    const cx = W * ((i + 0.3 + bRng() * 0.4) / blooms);
    const cy = baselineY - 4 + (bRng() - 0.5) * 18;
    const rr = 180 + bRng() * 220;
    const tone = bRng() < 0.7 ? rim : mix(rim, bone, 0.25);
    const op = (0.18 + bRng() * 0.20) * I;
    const blob = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    blob.addColorStop(0,   rgba(tone, op));
    blob.addColorStop(0.6, rgba(tone, op * 0.20));
    blob.addColorStop(1,   rgba(tone, 0));
    ctx.fillStyle = blob;
    ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }

  // ─── Layer 4: thin bright horizon line — accent at the exact baseline ───
  // Painted as a tapered slab, brighter in the middle, fading at edges.
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0,    rgba(rim, 0));
  lineGrad.addColorStop(0.18, rgba(rim, 0.42 * I));
  lineGrad.addColorStop(0.5,  rgba(mix(rim, bone, 0.30), 0.62 * I));
  lineGrad.addColorStop(0.82, rgba(rim, 0.42 * I));
  lineGrad.addColorStop(1,    rgba(rim, 0));
  ctx.fillStyle = lineGrad;
  ctx.fillRect(0, baselineY - 2, W, 4);

  // Bottom-soft falloff just under the horizon — bleeds into silhouette band
  const below = ctx.createLinearGradient(0, baselineY, 0, baselineY + 80);
  below.addColorStop(0, rgba(rim, 0.35 * I));
  below.addColorStop(1, rgba(rim, 0));
  ctx.fillStyle = below;
  ctx.fillRect(0, baselineY, W, 80);

  // Haze layer — bone-white smear hugging the horizon
  if(TWEAKS.haze > 0){
    const haze = ctx.createLinearGradient(0, baselineY - 80, 0, baselineY + 20);
    haze.addColorStop(0, rgba(bone, 0));
    haze.addColorStop(1, rgba(bone, 0.06 * TWEAKS.haze));
    ctx.fillStyle = haze;
    ctx.fillRect(0, baselineY - 80, W, 100);
  }
}

/* ──────────────────────── cosmic atmosphere ──────────────────────── */

/** Painterly nebula billows + a milky-way dust band crossing the sky.
 *  Sits BENEATH the starfield so stars punch through cleanly.
 *  seedOffset lets the caller bake multiple snapshots for crossfading. */
function paintCosmicAtmosphere(baselineY, seedOffset = 0){
  if(TWEAKS.nebula <= 0 && TWEAKS.milkyway <= 0) return;

  const baseSeed = TWEAKS.seed + seedOffset;
  const rng = makePRNG(baseSeed + 211);
  const aurora = hexToRgb(TWEAKS.colorAurora);
  const violet = hexToRgb(TWEAKS.colorViolet);
  const bone   = hexToRgb(TWEAKS.colorBone);
  const deep   = hexToRgb(TWEAKS.colorDeep);

  /* ── Milky-way style dust band ─────────────────────────────────────
   *  A diagonal soft band of dust + faint light crossing the upper sky.
   *  Painted as a clipped, rotated rectangle filled with layered
   *  radial gradients (light gas) + dark dust lanes.
   */
  if(TWEAKS.milkyway > 0){
    ctx.save();
    // Anchor + rotate so band crosses the sky diagonally. Keep it inside
    // the visible alpha band — bias toward mid-sky, not the very top
    // (which gets erased to transparent by the final fade).
    const tilt = -0.34 + rng() * 0.20;     // -18° to -30°
    const bandCx = W * (0.42 + rng() * 0.16);
    const bandCy = baselineY * (0.55 + rng() * 0.25);  // lower than before
    ctx.translate(bandCx, bandCy);
    ctx.rotate(tilt);

    const bandW = W * 1.8;
    const bandH = 380;

    // Soft gas wash along the band — denser than before so it reads
    const wash = ctx.createLinearGradient(0, -bandH/2, 0, bandH/2);
    wash.addColorStop(0,    rgba(violet, 0));
    wash.addColorStop(0.45, rgba(mix(violet, aurora, 0.65), 0.34 * TWEAKS.milkyway));
    wash.addColorStop(0.55, rgba(mix(violet, bone,   0.20), 0.28 * TWEAKS.milkyway));
    wash.addColorStop(1,    rgba(violet, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(-bandW/2, -bandH/2, bandW, bandH);

    // Painterly clumpy density — scattered radial blobs along the band
    const clumps = Math.round(110 * TWEAKS.milkyway);
    for(let i = 0; i < clumps; i++){
      const cx = -bandW/2 + rng() * bandW;
      const cy = (rng() - 0.5) * bandH * 0.65;
      const rr = 50 + rng() * 140;
      const tone = rng() < 0.55
        ? mix(violet, aurora, 0.35 + rng() * 0.5)
        : mix(violet, bone,   0.10 + rng() * 0.25);
      const op = 0.10 + rng() * 0.18;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, rgba(tone, op * TWEAKS.milkyway));
      g.addColorStop(1, rgba(tone, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }

    // Dark dust lanes — narrow dark streaks running along the band
    const lanes = 4 + Math.floor(rng() * 3);
    for(let i = 0; i < lanes; i++){
      const ly = (rng() - 0.5) * bandH * 0.5;
      const lw = bandW * (0.45 + rng() * 0.5);
      const lx = -bandW/2 + rng() * (bandW - lw);
      ctx.fillStyle = rgba(deep, 0.28 * TWEAKS.milkyway);
      ctx.beginPath();
      ctx.ellipse(lx + lw/2, ly, lw/2, 5 + rng() * 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ── Nebula billows ──────────────────────────────────────────────
   *  Built from FEW + LARGE soft gradients (haze style, not splotchy
   *  dabs). Each billow is a cluster of overlapping anisotropic blobs;
   *  reads as continuous nebulous gas, not stippled paint. Color leans
   *  toward teal (mixed with aurora-violet) so it feels distinct from
   *  the milky-way band's warmer wash.                                  */
  if(TWEAKS.nebula > 0){
    const teal = hexToRgb('#5ec8d8');
    const billowCount = 3 + Math.floor(rng() * 3);
    for(let n = 0; n < billowCount; n++){
      const cx = W * (0.1 + (n + rng() * 0.6) / billowCount * 0.85);
      const cy = baselineY * (0.40 + rng() * 0.50);
      const rx = 280 + rng() * 340;
      const ry = 130 + rng() * 180;

      // Strongly teal core, teal-violet edges
      const core = mix(teal, bone, 0.10);
      const edge = mix(teal, violet, 0.40);
      const nRng = makePRNG(baseSeed + n * 71 + 41);

      const blobs = 10 + Math.floor(nRng() * 7);
      for(let b = 0; b < blobs; b++){
        const angle = nRng() * Math.PI * 2;
        const dist  = Math.pow(nRng(), 0.55);
        const bx = cx + Math.cos(angle) * dist * rx;
        const by = cy + Math.sin(angle) * dist * ry;
        const isCore = dist < 0.5;
        const tone = isCore
          ? mix(core, bone, nRng() * 0.18)
          : mix(edge, teal, nRng() * 0.3);
        // 2× the previous opacity so the teal actually reads through the
        // violet cosmos field beneath.
        const op = (isCore ? 0.36 : 0.20) * TWEAKS.nebula * (1 - dist * 0.4);
        const br = ry * (0.7 + nRng() * 0.6);
        const stretch  = 1.4 + nRng() * 0.9;
        const rotation = nRng() * Math.PI;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rotation);
        ctx.scale(stretch, 1);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, br);
        g.addColorStop(0,    rgba(tone, op));
        g.addColorStop(0.55, rgba(tone, op * 0.45));
        g.addColorStop(1,    rgba(tone, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-br, -br, br * 2, br * 2);
        ctx.restore();
      }

      // Brighter ember knot — strongly teal
      if(n === Math.floor(billowCount / 2)){
        const ember = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
        ember.addColorStop(0,   rgba(mix(teal, bone, 0.35), 0.65 * TWEAKS.nebula));
        ember.addColorStop(0.5, rgba(teal, 0.22 * TWEAKS.nebula));
        ember.addColorStop(1,   rgba(teal, 0));
        ctx.fillStyle = ember;
        ctx.fillRect(cx - 100, cy - 100, 200, 200);
      }
    }
  }
}

/* ──────────────────────── cosmic fog (drifting clouds) ──────────────────────── */

/** Soft cosmic fog — wide horizontal haze bands. Painted on its own
 *  offscreen so it can drift visibly across the canvas per frame.
 *  Uses FEW + LARGE overlapping radial gradients (rather than many small
 *  dabs) so the fog reads as continuous haze, not stippled noise. */
function paintCosmicFog(baselineY, seedOffset = 0){
  if(TWEAKS.cosmicFog <= 0) return;

  const rng = makePRNG(TWEAKS.seed + seedOffset + 433);
  const aurora = hexToRgb(TWEAKS.colorAurora);
  const violet = hexToRgb(TWEAKS.colorViolet);
  const bone   = hexToRgb(TWEAKS.colorBone);

  // 6-9 large horizontal haze bands. Each band is built from a few
  // overlapping soft blobs along the band's major axis — minimal noise.
  const bandCount = 6 + Math.floor(rng() * 4);
  for(let c = 0; c < bandCount; c++){
    const cx = rng() * W;
    const cy = baselineY * (0.25 + rng() * 0.65);
    // Strongly horizontal — bands stretch sideways like real haze
    const rx = 360 + rng() * 520;
    const ry = 60  + rng() * 90;

    const tone = rng() < 0.55
      ? mix(violet, aurora, 0.25 + rng() * 0.30)
      : mix(violet, bone,   0.04 + rng() * 0.16);
    // 4-6 large overlapping soft blobs along the major axis
    const blobs = 4 + Math.floor(rng() * 3);

    for(let b = 0; b < blobs; b++){
      // Distribute along x with slight jitter so the band feels organic
      const t = (b + 0.5) / blobs;
      const bx = cx + (t - 0.5) * 2 * rx * (0.9 + rng() * 0.2);
      const by = cy + (rng() - 0.5) * ry * 0.5;
      // Each blob is much larger than the per-dab approach
      const br = ry * 1.8 + rng() * ry * 1.2;
      const op = (0.08 + rng() * 0.10) * TWEAKS.cosmicFog;

      // Anisotropic blob — scale the gradient horizontally for an
      // elongated haze look instead of round puffs.
      const stretch = 2.2 + rng() * 0.6;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(stretch, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, br);
      g.addColorStop(0,    rgba(tone, op));
      g.addColorStop(0.55, rgba(tone, op * 0.45));
      g.addColorStop(1,    rgba(tone, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-br, -br, br * 2, br * 2);
      ctx.restore();
    }
  }
}

let LAST_BRIGHT_STARS = [];   // unused legacy stub (kept for any external readers)

/* ──────────────────────── starfield (animated) ──────────────────────── */

/** Pre-roll stars: positions + colors + twinkle phase per star.
 *  Called once per cache rebuild; drawAnimatedStars just sweeps it. */
function generateStars(baselineY){
  const rng = makePRNG(TWEAKS.seed + 7);
  const N = Math.round(TWEAKS.starDensity);
  const stars = [];

  for(let i = 0; i < N; i++){
    const x = rng() * W;
    const y = rng() * (baselineY - 20);
    const isAurora = rng() < 0.20;
    const r = rng() < 0.92 ? (0.6 + rng() * 1.4) : (1.8 + rng() * 1.6);
    const baseOp = rng() < 0.85 ? (0.25 + rng() * 0.35) : (0.65 + rng() * 0.3);
    // ~45% of stars twinkle; the rest are steady. Phase + speed seeded per-star.
    const twinkleAmt = rng() < 0.45 ? (0.25 + rng() * 0.45) : 0;
    const phase = rng() * Math.PI * 2;
    const speed = 0.6 + rng() * 1.8;
    stars.push({ x, y, isAurora, r, baseOp, twinkleAmt, phase, speed });
  }
  return stars;
}

function drawAnimatedStars(stars, t){
  const boneRgb   = hexToRgb(TWEAKS.colorBone);
  const auroraRgb = hexToRgb(TWEAKS.colorAurora);
  const amount = TWEAKS.twinkleAmount;

  for(const s of stars){
    let mult = 1;
    if(s.twinkleAmt > 0 && amount > 0){
      // sine wave in [0,1] → [1-amt, 1]
      const wave = 0.5 - 0.5 * Math.sin(t * s.speed + s.phase);
      mult = 1 - s.twinkleAmt * amount * wave;
    }
    const op = s.baseOp * mult;
    const tint = s.isAurora ? auroraRgb : boneRgb;
    ctx.fillStyle = rgba(tint, op);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ──────────────────────── bright stars (animated) ──────────────────────── */

function generateBrightStars(baselineY){
  const N = TWEAKS.brightStars;
  if(N <= 0) return [];

  const rng = makePRNG(TWEAKS.seed + 313);
  const bone   = hexToRgb(TWEAKS.colorBone);
  const aurora = hexToRgb(TWEAKS.colorAurora);
  const gold   = hexToRgb(TWEAKS.colorGold);

  const yMin = H * 0.22;
  const yMax = baselineY - 60;
  const stars = [];
  for(let i = 0; i < N; i++){
    const cx = W * ((i + 0.3 + rng() * 0.4) / N);
    const cy = yMin + rng() * (yMax - yMin);
    const roll = rng();
    const tint = roll < 0.7  ? bone
              : roll < 0.95 ? aurora
              :                gold;
    const mag = 0.6 + rng() * 0.5;
    const phase = rng() * Math.PI * 2;
    // Slow breathing — bright stars don't twinkle fast like background ones
    const speed = 0.25 + rng() * 0.4;
    const breath = 0.15 + rng() * 0.20;
    stars.push({ x: cx, y: cy, tint, mag, phase, speed, breath });
  }
  return stars;
}

function drawAnimatedBrightStars(stars, t){
  const amount = TWEAKS.twinkleAmount;

  for(const s of stars){
    const wave = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
    const mult = 1 - s.breath * amount * (1 - wave);
    const mag  = s.mag * mult;

    // Soft glow halo
    const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 40 * mag);
    halo.addColorStop(0,    rgba(s.tint, 0.32 * mag));
    halo.addColorStop(0.35, rgba(s.tint, 0.10 * mag));
    halo.addColorStop(1,    rgba(s.tint, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(s.x - 50 * mag, s.y - 50 * mag, 100 * mag, 100 * mag);

    // Diffraction spikes — chart-style cross, not sparkly
    const spikeR = 18 * mag;
    ctx.strokeStyle = rgba(s.tint, 0.55 * mag);
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x - spikeR, s.y); ctx.lineTo(s.x + spikeR, s.y);
    ctx.moveTo(s.x, s.y - spikeR); ctx.lineTo(s.x, s.y + spikeR);
    ctx.stroke();

    // Bright inner core
    ctx.fillStyle = rgba(s.tint, 0.92 * mag);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.8 * mag, 0, Math.PI * 2);
    ctx.fill();
  }

  // Constellation polyline (chart-style) + measurement marks
  if(TWEAKS.skyConstellation && constellationCache && constellationCache.length >= 2){
    const gold = hexToRgb(TWEAKS.colorGold);
    const bone = hexToRgb(TWEAKS.colorBone);
    // Subtle pulse on the polyline itself
    const pulse = 0.55 + 0.10 * Math.sin(t * 0.4);
    const pts = constellationCache;

    // Hairline polyline
    ctx.strokeStyle = rgba(gold, pulse);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => {
      if(i === 0) ctx.moveTo(p.x, p.y);
      else        ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Per-segment measurement marks: a small perpendicular tick at the
    // midpoint of each segment + a bone-white pip dot at each vertex.
    for(let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i + 1];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      // Perpendicular unit vector (90° rotation of segment direction)
      const px = -dy / len, py = dx / len;
      const tickLen = 4;
      ctx.strokeStyle = rgba(gold, pulse * 0.85);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx + px * tickLen, my + py * tickLen);
      ctx.lineTo(mx - px * tickLen, my - py * tickLen);
      ctx.stroke();
    }
    // Bone-white measurement pip at each vertex
    for(const p of pts){
      ctx.fillStyle = rgba(bone, 0.85);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function pickConstellation(stars){
  if(!TWEAKS.skyConstellation || stars.length < 4) return null;
  const rng = makePRNG(TWEAKS.seed + 417);
  const sorted = [...stars].sort((a, b) => a.x - b.x);
  const startIdx = Math.floor(rng() * Math.max(1, sorted.length - 4));
  return sorted.slice(startIdx, startIdx + 4 + (rng() < 0.5 ? 1 : 0));
}

/** Paint a filled silhouette polygon with painterly stipple texture.
 *  pts: array of {x,y} points along the top edge, left to right
 *  baselineY: floor of the silhouette (bottom of polygon = canvas bottom)
 *  baseColor: rgb tuple
 *  depth: 0 = farthest (lighter, hazier), 1 = nearest (darker, sharper) */
function paintSilhouette(pts, baselineY, baseColor, depth){
  if(pts.length < 2) return;

  // Build the closed polygon path — top edge from points, then down to canvas bottom.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineTo(W, H + 4);
  ctx.lineTo(-4, H + 4);
  ctx.closePath();

  // Base fill
  ctx.fillStyle = rgba(baseColor, 1);
  ctx.fill();

  // Painterly stipple: scattered ellipses inside the silhouette with
  // slight color jitter. Clipped to the silhouette so dabs stop at edges.
  if(TWEAKS.painterly > 0){
    ctx.clip();
    const rng = makePRNG(TWEAKS.seed * 31 + Math.round(depth * 100));
    const N = Math.round(2800 * TWEAKS.painterly * (0.7 + depth * 0.5));
    const violetRgb = hexToRgb(TWEAKS.colorViolet);
    const deepRgb   = hexToRgb(TWEAKS.colorDeep);
    const auroraRgb = hexToRgb(TWEAKS.colorAurora);

    // Sample dabs along the top edge primarily (where texture matters most)
    for(let i = 0; i < N; i++){
      const edgeBias = rng() < 0.55;
      let x, y;
      if(edgeBias && pts.length > 1){
        const idx = Math.floor(rng() * (pts.length - 1));
        const p0 = pts[idx], p1 = pts[idx + 1];
        const t = rng();
        x = p0.x + (p1.x - p0.x) * t + (rng() - 0.5) * 32;
        y = p0.y + (p1.y - p0.y) * t + rng() * 80;
      } else {
        x = rng() * W;
        y = baselineY + rng() * (H - baselineY);
      }
      // Slightly varied tone: blend baseColor toward deep or aurora
      const lean = rng();
      let tone;
      if(lean < 0.55)      tone = mix(baseColor, deepRgb,   rng() * 0.4);
      else if(lean < 0.85) tone = mix(baseColor, violetRgb, rng() * 0.3);
      else                 tone = mix(baseColor, auroraRgb, rng() * 0.25);

      const r = 1.5 + rng() * 3.5;
      const op = 0.10 + rng() * 0.25;
      ctx.fillStyle = rgba(tone, op);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aurora rim along top edge (back-lit silhouette)
    for(let i = 0; i < pts.length - 1; i++){
      const p = pts[i];
      const op = 0.06 + 0.10 * (1 - depth);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
      grad.addColorStop(0, rgba(auroraRgb, op));
      grad.addColorStop(1, rgba(auroraRgb, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - 30, p.y - 4, 60, 36);
    }
  }
  ctx.restore();
}

/** Smooth a poly-line by inserting interpolated points; cheap & cheerful. */
function densify(pts, step = 18){
  const out = [];
  for(let i = 0; i < pts.length - 1; i++){
    const a = pts[i], b = pts[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(d / step));
    for(let j = 0; j < n; j++){
      const t = j / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/* ──────────────────────── scenes ──────────────────────── */
/* Each scene returns { peaks, meta?, } where:
 *   peaks — array of {x,y} points used by the generic spark layer
 *   meta  — opaque payload passed to the scene's `animated(meta, t)` fn
 * The `animated` fn (optional) is invoked AFTER the foreground cache draws
 * each frame, for live elements like lanterns, embers, hovering crystals. */

const SCENES = {

  /* ════════════════════ HUB ════════════════════
   * Celestial observatory dome with telescope barrel angled up and to the
   * right, framed by stepped columns. Accent: violet #9577ff.            */
  hub(baselineY){
    const violet = hexToRgb(TWEAKS.colorViolet);
    const deep   = hexToRgb(TWEAKS.colorDeep);
    const bone   = hexToRgb(TWEAKS.colorBone);
    const accent = hexToRgb(SCENE_ACCENT.hub);
    const colRim = mix(accent, bone, 0.35);

    const cx = W * 0.50;
    const groundY = baselineY + 18;
    const stoneColor = mix(violet, deep, 0.28);

    // Plaza/terrace floor — wide painted plate the observatory sits on.
    const floorY = baselineY + 40;
    paintPaintedRect(W * 0.02, floorY, W * 0.96, H - floorY + 8,
      mix(violet, deep, 0.55), 0.88);

    // ─── Stepped columns flanking the dome ─────────────────────────
    // Two columns left + right, each made of stacked stone blocks.
    const colDX  = 320;            // distance from center
    const colTopW = 58;
    const colBotW = 76;
    const colH   = 210;
    const colTopY = groundY - colH;
    for(const side of [-1, 1]){
      const colX = cx + side * colDX;

      // Tapered shaft (trapezoid) with vertical tonal gradient
      const cGrad = ctx.createLinearGradient(0, colTopY, 0, groundY);
      cGrad.addColorStop(0, rgba(mix(stoneColor, violet, 0.16), 1));
      cGrad.addColorStop(1, rgba(mix(stoneColor, deep, 0.28), 1));
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.moveTo(colX - colTopW/2, colTopY);
      ctx.lineTo(colX + colTopW/2, colTopY);
      ctx.lineTo(colX + colBotW/2, groundY);
      ctx.lineTo(colX - colBotW/2, groundY);
      ctx.closePath();
      ctx.fill();

      // Three subtle horizontal banding lines across the shaft —
      // suggests blocked stone construction without overdetailing.
      ctx.strokeStyle = rgba(deep, 0.55);
      ctx.lineWidth = 1;
      for(let i = 1; i <= 3; i++){
        const ty = colTopY + (colH * i / 4);
        const tFrac = i / 4;
        const wAt = colTopW + (colBotW - colTopW) * tFrac;
        ctx.beginPath();
        ctx.moveTo(colX - wAt/2 + 4, ty);
        ctx.lineTo(colX + wAt/2 - 4, ty);
        ctx.stroke();
      }

      // ── Stepped capital — three stones, each wider than the one below
      //    (giving the column its "stepped" silhouette).
      const cap1W = colTopW + 24, cap1H = 10;
      const cap2W = colTopW + 44, cap2H = 12;
      const cap3W = colTopW + 64, cap3H = 14;
      paintPaintedRect(colX - cap1W/2, colTopY - cap1H,
        cap1W, cap1H, mix(stoneColor, violet, 0.04), 1);
      paintPaintedRect(colX - cap2W/2, colTopY - cap1H - cap2H,
        cap2W, cap2H, mix(stoneColor, violet, 0.08), 1);
      paintPaintedRect(colX - cap3W/2, colTopY - cap1H - cap2H - cap3H,
        cap3W, cap3H, mix(stoneColor, violet, 0.10), 1, colRim);

      // ── Stepped base — two stones widening to the ground.
      paintPaintedRect(colX - colBotW/2 - 10, groundY - 8,
        colBotW + 20, 10, mix(stoneColor, deep, 0.05), 1);
      paintPaintedRect(colX - colBotW/2 - 22, groundY + 2,
        colBotW + 44, 18, mix(stoneColor, deep, 0.15), 1);
    }

    // ─── Drum / podium under the dome ──────────────────────────────
    // The cylindrical base the dome rests on.
    const drumW = 300;
    const drumH = 64;
    const drumY = groundY - drumH;
    paintPaintedRect(cx - drumW/2, drumY, drumW, drumH,
      mix(stoneColor, violet, 0.06), 1);

    // Top cornice of the drum — a thinner lighter band catching accent light.
    paintPaintedRect(cx - drumW/2 - 14, drumY - 14, drumW + 28, 14,
      mix(stoneColor, violet, 0.14), 1, colRim);

    // Two narrow recessed windows on the drum — suggested as dark
    // verticals with a faint violet interior glow behind them.
    for(const sx of [-1, 1]){
      const wx = cx + sx * 130;
      paintInteriorGlow(wx, drumY + drumH * 0.55, 38, accent, 0.35);
      ctx.fillStyle = rgba(deep, 0.85);
      ctx.fillRect(wx - 8, drumY + 22, 16, drumH - 44);
    }

    // ─── The dome ──────────────────────────────────────────────────
    // Hemisphere on top of the drum, sliced by a shutter slot through
    // which the telescope emerges (angled up and to the right).
    const domeCX = cx;
    const domeCY = drumY;                  // dome rises from drum top
    const domeR  = 130;
    const shutterAngle = -Math.PI / 4;     // 45° up-right
    const shutterHalfArc = 0.32;           // ± radians around the angle

    // Cosmic aura + orbital sparkles — painted FIRST so the architecture
    // sits on top. This wraps the dome+telescope assembly in a soft
    // violet halo extending up into the cosmos, making it read as the
    // accent touch in a wider astral field.
    paintCenterpieceAura(domeCX, domeCY - domeR * 0.4,
      domeR * 2.6, domeR * 3.2, accent, 0.70);
    paintOrbitalSparkles(domeCX, domeCY - domeR * 0.2,
      domeR * 2.4, domeR * 2.0, accent, 11);

    ctx.save();
    // Hemisphere fill — half-ellipse, with internal tonal gradient
    const domeGrad = ctx.createLinearGradient(
      domeCX - domeR * 0.5, domeCY - domeR,
      domeCX + domeR * 0.5, domeCY
    );
    domeGrad.addColorStop(0,   rgba(mix(stoneColor, violet, 0.22), 1));
    domeGrad.addColorStop(0.6, rgba(mix(stoneColor, violet, 0.08), 1));
    domeGrad.addColorStop(1,   rgba(mix(stoneColor, deep, 0.20), 1));
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.ellipse(domeCX, domeCY, domeR, domeR * 0.92,
                0, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    // Dome meridian ribs — three faint arcs running from base to apex,
    // suggesting the dome's segmented panels.
    ctx.strokeStyle = rgba(deep, 0.45);
    ctx.lineWidth = 1;
    for(const off of [-0.55, -0.18, 0.20, 0.55]){
      ctx.beginPath();
      // A vertical arc from left edge to right edge, scaled by `off` to
      // ride a meridian line. Sample a parametric quarter-ellipse.
      const steps = 24;
      for(let i = 0; i <= steps; i++){
        const t = i / steps;
        // Arc parameter: t=0 at apex, t=1 at base
        const a = Math.PI / 2 + t * Math.PI / 2 * (off >= 0 ? 1 : -1);
        const aa = Math.abs(off);
        const x = domeCX + Math.cos(a) * domeR * aa;
        const y = domeCY - Math.sin(a) * domeR * 0.92 * (1 - aa * 0.45);
        if(i === 0) ctx.moveTo(x, y);
        else        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Apex finial — a small spire / orb on top of the dome
    const apexX = domeCX, apexY = domeCY - domeR * 0.92;
    ctx.fillStyle = rgba(mix(stoneColor, violet, 0.18), 1);
    ctx.fillRect(apexX - 4, apexY - 22, 8, 22);
    ctx.beginPath();
    ctx.arc(apexX, apexY - 28, 6, 0, Math.PI * 2);
    ctx.fill();
    // Tiny accent rim on the orb
    ctx.strokeStyle = rgba(colRim, 0.7);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Base trim of the dome — a thin band where it meets the drum.
    ctx.strokeStyle = rgba(colRim, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(domeCX - domeR, domeCY);
    ctx.lineTo(domeCX + domeR, domeCY);
    ctx.stroke();
    ctx.restore();

    // ─── Shutter slot in the dome ─────────────────────────────────
    // A dark wedge cut into the dome where the telescope emerges.
    // Painted AFTER the dome so it sits on top.
    ctx.save();
    ctx.fillStyle = rgba(deep, 0.95);
    ctx.beginPath();
    const slotR1 = domeR * 1.02;          // outer edge (slightly past dome)
    const slotR2 = 4;                      // inner edge (near center)
    const a0 = shutterAngle - shutterHalfArc;
    const a1 = shutterAngle + shutterHalfArc;
    // Two arc-fan triangles cleave the dome shape
    ctx.moveTo(domeCX + Math.cos(a0) * slotR2, domeCY + Math.sin(a0) * slotR2);
    ctx.lineTo(domeCX + Math.cos(a0) * slotR1, domeCY + Math.sin(a0) * slotR1 * 0.92);
    ctx.lineTo(domeCX + Math.cos(a1) * slotR1, domeCY + Math.sin(a1) * slotR1 * 0.92);
    ctx.lineTo(domeCX + Math.cos(a1) * slotR2, domeCY + Math.sin(a1) * slotR2);
    ctx.closePath();
    ctx.fill();
    // Soft accent glow from inside the shutter slot
    const slotMidX = domeCX + Math.cos(shutterAngle) * domeR * 0.55;
    const slotMidY = domeCY + Math.sin(shutterAngle) * domeR * 0.55;
    paintInteriorGlow(slotMidX, slotMidY, 90, accent, 0.45);
    ctx.restore();

    // ─── Telescope barrel — angled up and to the right ─────────────
    // Drawn as a long rectangle rotated to shutterAngle, originating
    // from inside the dome and extending out through the slot.
    ctx.save();
    ctx.translate(domeCX, domeCY - domeR * 0.18);   // mount pivot inside dome
    ctx.rotate(shutterAngle);

    // Mount cradle (yoke) — a small rectangular block at the pivot
    ctx.fillStyle = rgba(mix(stoneColor, deep, 0.22), 1);
    ctx.fillRect(-32, -16, 64, 32);
    // Yoke rim accent
    ctx.strokeStyle = rgba(colRim, 0.5);
    ctx.lineWidth = 2;
    ctx.strokeRect(-32, -16, 64, 32);

    // Barrel — long cylinder rendered as gradient-filled rect
    const barL = 210;          // length
    const barW = 32;           // diameter
    const barGrad = ctx.createLinearGradient(0, -barW/2, 0, barW/2);
    barGrad.addColorStop(0,   rgba(mix(stoneColor, bone, 0.18), 1));
    barGrad.addColorStop(0.45,rgba(mix(stoneColor, violet, 0.05), 1));
    barGrad.addColorStop(1,   rgba(mix(stoneColor, deep, 0.40), 1));
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, -barW/2, barL, barW);

    // Three reinforcement bands across the barrel
    ctx.fillStyle = rgba(deep, 0.7);
    for(const t of [0.25, 0.55, 0.85]){
      ctx.fillRect(t * barL - 3, -barW/2 - 3, 6, barW + 6);
    }

    // Aperture ring at the far (objective) end — a slightly wider lip
    ctx.fillStyle = rgba(mix(stoneColor, violet, 0.10), 1);
    ctx.fillRect(barL - 12, -barW/2 - 8, 14, barW + 16);
    // Dark glass aperture
    ctx.fillStyle = rgba(deep, 0.95);
    ctx.fillRect(barL - 6, -barW/2 - 4, 6, barW + 8);
    // Faint accent ring on the lip
    ctx.strokeStyle = rgba(colRim, 0.7);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barL - 12, -barW/2 - 8, 14, barW + 16);

    // Eyepiece stub at the back (near pivot)
    ctx.fillStyle = rgba(mix(stoneColor, deep, 0.30), 1);
    ctx.fillRect(-28, -10, 14, 20);

    // Top-edge highlight running along the barrel — single thin accent line
    ctx.strokeStyle = rgba(colRim, 0.45);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, -barW/2 + 4);
    ctx.lineTo(barL - 16, -barW/2 + 4);
    ctx.stroke();

    ctx.restore();

    // Peak sparks: apex of dome, telescope objective tip, and the right
    // capital — three high points framing the silhouette.
    const objTipX = domeCX + Math.cos(shutterAngle) * (domeR * 0.18 + barL);
    const objTipY = (domeCY - domeR * 0.18) + Math.sin(shutterAngle) * (domeR * 0.18 + barL);
    const peaks = [
      { x: apexX, y: apexY - 36 },
      { x: objTipX, y: objTipY - 6 },
      { x: cx + colDX, y: colTopY - 40 },
    ];

    return { peaks };
  },

  /* ════════════════════ SHOP ════════════════════
   * Three peaked night-market stalls of unequal height (center tallest),
   * hanging lanterns suggested as bright pinpoints. Accent: gold #f5c451. */
  shop(baselineY){
    const violet = hexToRgb(TWEAKS.colorViolet);
    const deep   = hexToRgb(TWEAKS.colorDeep);
    const accent = hexToRgb(SCENE_ACCENT.shop);
    const bone   = hexToRgb(TWEAKS.colorBone);
    const colRim = mix(accent, bone, 0.35);

    // Cobbled plaza floor.
    const floorY = baselineY + 40;
    paintPaintedRect(W * 0.02, floorY, W * 0.96, H - floorY + 8,
      mix(violet, deep, 0.55), 0.85);

    const stalls = [
      { cx: W * 0.38, w: 220, bodyH: 150, roofH: 82 },
      { cx: W * 0.50, w: 280, bodyH: 200, roofH: 116 },
      { cx: W * 0.62, w: 220, bodyH: 150, roofH: 82 },
    ];

    const lanterns = [];
    const groundY = baselineY + 18;

    // Cosmic aura + orbital sparkles around the tallest center stall —
    // painted FIRST so stalls sit on top. Gold halo bleeds up into the
    // night sky, suggesting the market’s warmth as a cosmic accent.
    const centerStall = stalls[1];
    const centerStallTop = groundY - centerStall.bodyH - centerStall.roofH;
    paintCenterpieceAura(centerStall.cx, centerStallTop + 30,
      360, 440, accent, 0.65);
    paintOrbitalSparkles(centerStall.cx, centerStallTop + 40,
      300, 260, accent, 21);
    for(const s of stalls){
      const bodyY = groundY - s.bodyH;
      const roofPeakY = bodyY - s.roofH;
      const bodyColor = mix(violet, deep, 0.32);

      // Warm interior glow at the stall opening — visible before
      // silhouette paints over the lower half (so it bleeds through).
      paintInteriorGlow(s.cx, bodyY + s.bodyH * 0.35, s.w * 0.45, accent, 0.32);

      // Stall body
      paintPaintedRect(s.cx - s.w/2, bodyY, s.w, s.bodyH, bodyColor, 0.96);

      // Counter ledge — a thin lighter band along the stall opening,
      // suggesting the merchant's counter.
      const ledgeY = bodyY + s.bodyH * 0.32;
      paintPaintedRect(s.cx - s.w/2 + 16, ledgeY, s.w - 32, 8,
        mix(bodyColor, violet, 0.3), 1, colRim);

      // Peaked roof — generous eaves
      const eave = 36;
      const roofColor = mix(violet, deep, 0.18);
      ctx.fillStyle = rgba(roofColor, 1);
      ctx.beginPath();
      ctx.moveTo(s.cx - s.w/2 - eave, bodyY + 4);
      ctx.lineTo(s.cx,                roofPeakY);
      ctx.lineTo(s.cx + s.w/2 + eave, bodyY + 4);
      ctx.closePath();
      ctx.fill();
      // Roof rim — accent light kisses one side of the peak
      ctx.strokeStyle = rgba(colRim, 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.cx - 4, roofPeakY + 2);
      ctx.lineTo(s.cx + s.w/2 + eave - 8, bodyY + 8);
      ctx.stroke();

      // Pennant flag on the peak — a small triangle, hangs to one side.
      ctx.fillStyle = rgba(mix(accent, bone, 0.3), 0.85);
      ctx.beginPath();
      ctx.moveTo(s.cx + 2, roofPeakY - 28);
      ctx.lineTo(s.cx + 26, roofPeakY - 18);
      ctx.lineTo(s.cx + 2, roofPeakY - 8);
      ctx.closePath();
      ctx.fill();
      // Flag pole
      ctx.strokeStyle = rgba(bodyColor, 1);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.cx, roofPeakY + 2);
      ctx.lineTo(s.cx, roofPeakY - 32);
      ctx.stroke();

      // Lanterns — 3 per stall, on a catenary string under the awning.
      const nLanterns = 3;
      const stringY1 = bodyY + 12;     // string anchor at eaves
      const stringY2 = bodyY + 40;     // lowest sag of the string
      for(let i = 0; i < nLanterns; i++){
        const t = (i + 1) / (nLanterns + 1);
        const lx = s.cx - s.w/2 + s.w * t;
        // Each lantern hangs from the string at its sag depth (parabolic)
        const sag = 4 * t * (1 - t);    // 0..1
        const ly = stringY1 + (stringY2 - stringY1) * sag * 4 + 18;
        lanterns.push({ x: lx, y: ly, phase: (i + (s.cx / W) * 6) });
      }
      // Catenary string itself — drawn statically through the lantern row
      ctx.strokeStyle = rgba(mix(violet, deep, 0.0), 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const stringStartX = s.cx - s.w/2 + s.w * 0.10;
      const stringEndX   = s.cx + s.w/2 - s.w * 0.10;
      const stringMidY   = bodyY + 36;
      ctx.moveTo(stringStartX, stringY1);
      ctx.quadraticCurveTo(s.cx, stringMidY, stringEndX, stringY1);
      ctx.stroke();
    }

    return {
      peaks: [
        { x: stalls[1].cx, y: groundY - stalls[1].bodyH - stalls[1].roofH * 0.92 },
      ],
      meta: { lanterns, accent },
    };
  },
  animatedSceneFn_shop_PLACEHOLDER: null,   // (real animated fn attached below)

  /* ════════════════════ FORGE ════════════════════
   * Industrial silhouette: bellows, anvil, hammer rack arranged horizontally.
   * Ember sparks rising from the anvil. Accent: ember orange #ff7847.     */
  forge(baselineY){
    const violet = hexToRgb(TWEAKS.colorViolet);
    const deep   = hexToRgb(TWEAKS.colorDeep);
    const bone   = hexToRgb(TWEAKS.colorBone);
    const accent = hexToRgb(SCENE_ACCENT.forge);
    const colRim = mix(accent, bone, 0.35);

    // Forge floor
    const floorY = baselineY + 38;
    paintPaintedRect(W * 0.03, floorY, W * 0.94, H - floorY + 8,
      mix(violet, deep, 0.55), 0.9);

    const groundY = baselineY + 18;
    const stoneColor = mix(violet, deep, 0.25);

    // ─── Forge fire glow — painted UNDER the anvil so it bleeds out
    //     from underneath. Anchor of the whole composition's warm light. ───
    const anvilX = W * 0.50;
    const anvilTopY = groundY - 130;
    const anvilScale = 0.72;     // shrink anvil so it reads as accent

    // Cosmic aura + orbital sparkles around the anvil — painted FIRST so
    // the architecture sits on top. Ember-orange halo rises from the
    // anvil into the cosmos, framing it as the accent of a wider field.
    paintCenterpieceAura(anvilX, anvilTopY - 20,
      340, 420, accent, 0.70);
    paintOrbitalSparkles(anvilX, anvilTopY - 40,
      280, 240, accent, 31);

    paintInteriorGlow(anvilX, groundY - 30, 220, accent, 0.55);
    paintInteriorGlow(anvilX, anvilTopY + 14, 86, accent, 0.45);

    // ─── Responsive layout ─────────────────────────────────────────
    // The anvil is the hero. Bellows + hammer rack are supporting
    // characters and should fade gracefully on narrow viewports rather
    // than crowd the center.
    //   sideDist : distance from anvil center to each side element.
    //              Pulls in toward anvil on narrow viewports, capped on
    //              wide so the composition doesn't drift apart.
    //   sideStrength : opacity for side elements (0 at ≤1300, 1 at ≥1900).
    const sideDist     = Math.min(W * 0.24, 420);
    const sideStrength = Math.max(0, Math.min(1, (W - 1300) / 600));
    const bellowsX     = anvilX - sideDist;
    const rackX        = anvilX + sideDist;

    // ─── Bellows (LEFT) — only when there's room to breathe ─────
    if(sideStrength > 0.02){
      ctx.save();
      ctx.globalAlpha = sideStrength;
      const bellowsCY = groundY - 95;
      const bellowsW = 190;
      const bellowsH = 120;
      // Bellows body with vertical gradient
      const bGrad = ctx.createLinearGradient(0, bellowsCY - bellowsH/2, 0, bellowsCY + bellowsH/2);
      bGrad.addColorStop(0, rgba(mix(stoneColor, violet, 0.14), 1));
      bGrad.addColorStop(1, rgba(mix(stoneColor, deep, 0.30), 1));
      ctx.fillStyle = bGrad;
      // Path: tapered teardrop nose pointing right (toward anvil)
      ctx.beginPath();
      ctx.moveTo(bellowsX - bellowsW/2 + 14, bellowsCY);                  // round back
      ctx.bezierCurveTo(
        bellowsX - bellowsW/2 - 12, bellowsCY - bellowsH/2 - 12,
        bellowsX - bellowsW/4,      bellowsCY - bellowsH/2,
        bellowsX + bellowsW/8,      bellowsCY - bellowsH/2 + 4
      );
      ctx.lineTo(bellowsX + bellowsW/2 - 30, bellowsCY - 32);             // taper to nozzle
      ctx.lineTo(bellowsX + bellowsW/2,      bellowsCY - 8);
      ctx.lineTo(bellowsX + bellowsW/2,      bellowsCY + 8);
      ctx.lineTo(bellowsX + bellowsW/2 - 30, bellowsCY + 32);
      ctx.bezierCurveTo(
        bellowsX + bellowsW/8,      bellowsCY + bellowsH/2 - 4,
        bellowsX - bellowsW/4,      bellowsCY + bellowsH/2,
        bellowsX - bellowsW/2 - 12, bellowsCY + bellowsH/2 + 12
      );
      ctx.closePath();
      ctx.fill();
      // Accent rim on the top of the bellows (curved highlight)
      ctx.strokeStyle = rgba(colRim, 0.42);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bellowsX - bellowsW/3, bellowsCY - bellowsH/2 + 6);
      ctx.bezierCurveTo(
        bellowsX,                   bellowsCY - bellowsH/2,
        bellowsX + bellowsW/4,      bellowsCY - bellowsH/2 + 12,
        bellowsX + bellowsW/2 - 40, bellowsCY - 30
      );
      ctx.stroke();
      // Bellows nozzle — extends to right
      ctx.fillStyle = rgba(stoneColor, 1);
      ctx.fillRect(bellowsX + bellowsW/2, bellowsCY - 8, 50, 16);
      // Bellows handle on top — short stub
      ctx.fillStyle = rgba(stoneColor, 1);
      ctx.fillRect(bellowsX - bellowsW/3 - 4, bellowsCY - bellowsH/2 - 22, 8, 30);
      ctx.fillRect(bellowsX - bellowsW/3 - 12, bellowsCY - bellowsH/2 - 28, 26, 8);
      // Bellows support block under it
      paintPaintedRect(bellowsX - bellowsW/3, bellowsCY + 18,
        bellowsW * 0.7, groundY - bellowsCY - 18, stoneColor, 1);
      ctx.restore();
    }

    // ─── Anvil (CENTER) ───
    drawAnvil(anvilX, anvilTopY, groundY, stoneColor, colRim, anvilScale);
    // A small workpiece on the anvil — bright accent rectangle, hot.
    const wpX = anvilX - 6;
    const wpY = anvilTopY - 4;
    ctx.fillStyle = rgba(accent, 0.85);
    ctx.fillRect(wpX, wpY, 26, 6);
    paintInteriorGlow(wpX + 13, wpY + 3, 22, accent, 0.7);

    // ─── Hammer Rack (RIGHT) — only when there's room ──────────
    if(sideStrength > 0.02){
      ctx.save();
      ctx.globalAlpha = sideStrength;
      const rackW = 190;
      const rackTopY = groundY - 200;
      // Posts (left + right) — single mass each
      paintPaintedRect(rackX - rackW/2,      rackTopY, 22, groundY - rackTopY,
        stoneColor, 1);
      paintPaintedRect(rackX + rackW/2 - 22, rackTopY, 22, groundY - rackTopY,
        stoneColor, 1);
      // Top bar
      paintPaintedRect(rackX - rackW/2 - 10, rackTopY, rackW + 20, 20,
        mix(stoneColor, violet, 0.05), 1, colRim);

      // 3 hanging mallets — proper hammer head + handle, alternating heights
      const hammerCount = 3;
      for(let i = 0; i < hammerCount; i++){
        const tt = (i + 1) / (hammerCount + 1);
        const hx = rackX - rackW/2 + rackW * tt;
        const handleTop = rackTopY + 18;
        const handleLen = 90 + (i === 1 ? 22 : 0);
        // Handle — narrower at top, slightly wider near head
        ctx.fillStyle = rgba(mix(violet, deep, 0.30), 1);
        ctx.fillRect(hx - 4, handleTop, 8, handleLen);
        // Hammer head — rectangle with one tapered face (struck end on the right)
        ctx.fillStyle = rgba(mix(stoneColor, deep, 0.10), 1);
        ctx.beginPath();
        ctx.moveTo(hx - 26, handleTop + handleLen);
        ctx.lineTo(hx + 14, handleTop + handleLen);
        ctx.lineTo(hx + 28, handleTop + handleLen + 14);
        ctx.lineTo(hx + 14, handleTop + handleLen + 28);
        ctx.lineTo(hx - 26, handleTop + handleLen + 28);
        ctx.closePath();
        ctx.fill();
        // Accent highlight on top edge of the head
        ctx.fillStyle = rgba(colRim, 0.45);
        ctx.fillRect(hx - 26, handleTop + handleLen, 40, 2);
      }
      ctx.restore();
    }

    // Pre-seed ember particles (will be animated each frame)
    const embers = [];
    const eRng = makePRNG(TWEAKS.seed + 901);
    for(let i = 0; i < 28; i++){
      embers.push({
        baseX: anvilX + (eRng() - 0.5) * 90,
        startY: anvilTopY - 4,
        speed: 35 + eRng() * 55,
        sway:  4 + eRng() * 14,
        swayFreq: 0.8 + eRng() * 1.2,
        phase: eRng() * Math.PI * 2,
        radius: 1.4 + eRng() * 2.4,
        lifeOffset: eRng() * 4,
      });
    }

    return {
      peaks: [{ x: anvilX, y: anvilTopY - 30 }],
      meta: { embers, anvilX, anvilTopY, accent },
    };
  },

  /* ════════════════════ ASTRAL FORGE ════════════════════
   * Tiered altar with two flanking columns and a central raised slab.
   * A single floating geometric crystal hovers above the slab.
   * Accent: cyan #7be3ff.                                                 */
  astralForge(baselineY){
    const violet = hexToRgb(TWEAKS.colorViolet);
    const deep   = hexToRgb(TWEAKS.colorDeep);
    const bone   = hexToRgb(TWEAKS.colorBone);
    const accent = hexToRgb(SCENE_ACCENT.astralForge);
    const colRim = mix(accent, bone, 0.4);

    // Floor plate
    const floorY = baselineY + 40;
    paintPaintedRect(W * 0.02, floorY, W * 0.96, H - floorY + 8,
      mix(violet, deep, 0.55), 0.85);

    const cx = W * 0.50;
    const groundY = baselineY + 18;
    const altarColor = mix(violet, deep, 0.30);

    // Cosmic aura + orbital sparkles around the crystal’s hover region —
    // painted FIRST so the altar sits on top. Cyan halo extends up into
    // the cosmos, framing the crystal as a piercing astral accent.
    const crystalHoverY = groundY - 290;
    paintCenterpieceAura(cx, crystalHoverY,
      360, 440, accent, 0.75);
    paintOrbitalSparkles(cx, crystalHoverY,
      300, 260, accent, 41);

    // Tiered altar — 3 steps. Capital rim on top of each tier suggests
    // the precision of carved stone.
    const tiers = [
      { w: 660, h: 38 },
      { w: 460, h: 44 },
      { w: 280, h: 52 },
    ];
    let topY = groundY;
    for(let i = 0; i < tiers.length; i++){
      const tier = tiers[i];
      topY -= tier.h;
      paintPaintedRect(cx - tier.w/2, topY, tier.w, tier.h, altarColor, 1,
        i === tiers.length - 1 ? colRim : null);
    }
    const altarTopY = topY;

    // ─── Runic marks along the front face of the middle tier ───
    const runeY = groundY - tiers[0].h - tiers[1].h * 0.55;
    const runeStartX = cx - tiers[1].w * 0.38;
    const runeEndX   = cx + tiers[1].w * 0.38;
    const runeCount  = 9;
    ctx.fillStyle = rgba(colRim, 0.55);
    for(let i = 0; i < runeCount; i++){
      const t = i / (runeCount - 1);
      const rx = runeStartX + (runeEndX - runeStartX) * t;
      const isMain = i % 3 === 1;
      ctx.fillRect(rx - (isMain ? 5 : 2), runeY, isMain ? 10 : 4, isMain ? 4 : 3);
    }

    // ─── Central raised slab on top of the highest tier ───
    const slabW = 150;
    const slabH = 20;
    const slabY = altarTopY - slabH;
    // Interior accent glow underneath the slab (between top tier + slab)
    paintInteriorGlow(cx, altarTopY - 8, 200, accent, 0.45);
    paintPaintedRect(cx - slabW/2, slabY, slabW, slabH,
      mix(violet, deep, 0.20), 1, colRim);
    // Slab undercut shadow — a thin dark line where slab meets top tier
    ctx.fillStyle = rgba(deep, 0.85);
    ctx.fillRect(cx - slabW/2 + 6, altarTopY - 4, slabW - 12, 4);

    // ─── Two flanking columns — tapered shaft + capital + base ───
    const colDX  = 420;
    const colTopW = 48;
    const colBotW = 64;
    const colH   = 280;
    const colTopY = groundY - colH;
    for(const side of [-1, 1]){
      const colX = cx + side * colDX;
      // Tapered shaft (trapezoid)
      const cGrad = ctx.createLinearGradient(0, colTopY, 0, groundY);
      cGrad.addColorStop(0, rgba(mix(altarColor, violet, 0.14), 1));
      cGrad.addColorStop(1, rgba(mix(altarColor, deep, 0.28), 1));
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.moveTo(colX - colTopW/2, colTopY);
      ctx.lineTo(colX + colTopW/2, colTopY);
      ctx.lineTo(colX + colBotW/2, groundY);
      ctx.lineTo(colX - colBotW/2, groundY);
      ctx.closePath();
      ctx.fill();
      // Capital — stepped, two stones
      paintPaintedRect(colX - colTopW/2 - 16, colTopY - 22,
        colTopW + 32, 12, mix(altarColor, violet, 0.05), 1, colRim);
      paintPaintedRect(colX - colTopW/2 - 8,  colTopY - 10,
        colTopW + 16, 10, mix(altarColor, violet, 0.0), 1);
      // Base — stepped, two stones
      paintPaintedRect(colX - colBotW/2 - 8, groundY - 6,
        colBotW + 16, 8,  altarColor, 1);
      paintPaintedRect(colX - colBotW/2 - 18, groundY + 2,
        colBotW + 36, 16, altarColor, 1);
    }

    // Crystal hover anchor — animated per frame
    const crystalCY = slabY - 88;
    const crystalR  = 30;

    return {
      peaks: [{ x: cx, y: crystalCY - crystalR - 12 }],
      meta: { cx, slabY, altarTopY, crystalCY, crystalR, accent },
    };
  },

};

/* Scene-specific per-frame animated drawing — attached as a property
 * `animated(meta, t)` on each scene that has live elements. */

SCENES.shop.animated = function(meta, t){
  const aurora = hexToRgb(TWEAKS.colorAurora);
  const tint   = meta.accent;
  for(const L of meta.lanterns){
    const breath = 0.5 + 0.5 * Math.sin(t * 0.9 + L.phase);
    const mag    = 0.85 + 0.25 * breath;
    const haloR  = 22 * mag;

    // Halo
    const halo = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, haloR * 1.6);
    halo.addColorStop(0,   rgba(tint, 0.55 * mag));
    halo.addColorStop(0.4, rgba(tint, 0.18 * mag));
    halo.addColorStop(1,   rgba(tint, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(L.x - haloR * 2, L.y - haloR * 2, haloR * 4, haloR * 4);

    // Lantern body — small rectangle silhouette
    ctx.fillStyle = rgba(mix(tint, [10,10,30], 0.5), 0.9);
    ctx.fillRect(L.x - 8, L.y - 8, 16, 18);

    // Bright pinpoint center
    ctx.fillStyle = rgba(tint, 0.95);
    ctx.beginPath();
    ctx.arc(L.x, L.y, 2.4 * mag, 0, Math.PI * 2);
    ctx.fill();
  }
};

SCENES.forge.animated = function(meta, t){
  const tint = meta.accent;
  // Each ember follows a stream: rises with sway, fades with life.
  for(const e of meta.embers){
    // Compute current life position in a 0..1 loop with stagger
    const lifeT = ((t + e.lifeOffset) * (e.speed / 200)) % 1;
    const yOff = lifeT * 280;                  // rise height
    const x = e.baseX + Math.sin((t + e.phase) * e.swayFreq) * e.sway;
    const y = e.startY - yOff;
    // Fade: bright at birth, fades through middle, gone at top
    const op = (1 - lifeT) * (0.85 - lifeT * 0.4);
    if(op <= 0.02) continue;
    // Tiny halo
    const halo = ctx.createRadialGradient(x, y, 0, x, y, 12);
    halo.addColorStop(0, rgba(tint, 0.45 * op));
    halo.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - 14, y - 14, 28, 28);
    // Core
    ctx.fillStyle = rgba(tint, op);
    ctx.beginPath();
    ctx.arc(x, y, e.radius * (1 - lifeT * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
};

SCENES.astralForge.animated = function(meta, t){
  const { cx, slabY, altarTopY, crystalCY, crystalR } = meta;
  const tint = meta.accent;
  const bone = hexToRgb(TWEAKS.colorBone);

  // Slow vertical bob + slow spin
  const bob  = Math.sin(t * 0.45) * 6;
  const cyNow = crystalCY + bob;
  const spin  = t * 0.18;

  // Tapered beam connecting slab to crystal — like a column of refracted light.
  // Narrow at top, wide at base, layered for that painted feel.
  ctx.save();
  const beamTopX = cx;
  const beamTopY = cyNow + crystalR * 0.4;
  const beamBotY = slabY + 4;
  const beamTopW = 18;
  const beamBotW = 120;
  ctx.beginPath();
  ctx.moveTo(beamTopX - beamTopW/2, beamTopY);
  ctx.lineTo(beamTopX + beamTopW/2, beamTopY);
  ctx.lineTo(beamTopX + beamBotW/2, beamBotY);
  ctx.lineTo(beamTopX - beamBotW/2, beamBotY);
  ctx.closePath();
  ctx.clip();
  const beamGrad = ctx.createLinearGradient(0, beamTopY, 0, beamBotY);
  beamGrad.addColorStop(0,    rgba(mix(tint, bone, 0.30), 0.55));
  beamGrad.addColorStop(0.4,  rgba(tint, 0.22));
  beamGrad.addColorStop(1,    rgba(tint, 0.08));
  ctx.fillStyle = beamGrad;
  ctx.fillRect(beamTopX - beamBotW/2 - 4, beamTopY - 4, beamBotW + 8,
               beamBotY - beamTopY + 8);
  ctx.restore();

  // Bright spill where beam meets slab — accent puddle
  paintInteriorGlow(cx, slabY - 2, 90, tint, 0.55);

  // Crystal halo — gentle breath
  const haloR = crystalR * (1.5 + 0.10 * Math.sin(t * 0.7));
  const halo = ctx.createRadialGradient(cx, cyNow, 0, cx, cyNow, haloR * 2);
  halo.addColorStop(0,   rgba(tint, 0.55));
  halo.addColorStop(0.4, rgba(tint, 0.16));
  halo.addColorStop(1,   rgba(tint, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - haloR * 2, cyNow - haloR * 2, haloR * 4, haloR * 4);

  // ─── 6-faceted crystal — hexagonal silhouette with internal facets ───
  ctx.save();
  ctx.translate(cx, cyNow);
  ctx.rotate(spin);
  const R = crystalR;

  // Outer hexagonal body — vertical hex (point up, point down)
  // Vertices at angles -90, -30, 30, 90, 150, 210 degrees (top, ur, lr, bot, ll, ul)
  const pts = [];
  for(let i = 0; i < 6; i++){
    const a = (-Math.PI / 2) + (i * Math.PI / 3);
    pts.push({ x: Math.cos(a) * R, y: Math.sin(a) * R });
  }
  // Body fill — gradient from bright top to deeper bottom
  const cGrad = ctx.createLinearGradient(0, -R, 0, R);
  cGrad.addColorStop(0,   rgba(mix(tint, bone, 0.5), 0.92));
  cGrad.addColorStop(0.5, rgba(mix(tint, bone, 0.2), 0.85));
  cGrad.addColorStop(1,   rgba(mix(tint, hexToRgb(TWEAKS.colorDeep), 0.4), 0.85));
  ctx.fillStyle = cGrad;
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fill();
  // Outline
  ctx.strokeStyle = rgba(bone, 0.7);
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Internal facet lines — from each vertex to center (3 of 6 for clarity)
  ctx.strokeStyle = rgba(bone, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let i = 0; i < 6; i++){
    if(i % 2 === 0){
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(0, 0);
    }
  }
  ctx.stroke();

  // Bright vertex pip — emphasis on the topmost vertex
  ctx.fillStyle = rgba(bone, 0.95);
  ctx.beginPath();
  ctx.arc(pts[0].x, pts[0].y, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

/* ──────────────────────── scene paint helpers ──────────────────────── */

/** Distant low ridge silhouette — adds depth behind the architecture. */
function paintDistantRidge(baselineY, height, color){
  const rng = makePRNG(TWEAKS.seed + 71);
  const ridgeY = baselineY + 6;
  const amp = 24 + height * 30;
  const pts = [];
  pts.push({ x: -20, y: ridgeY + amp });
  for(let x = -20; x <= W + 20; x += 60){
    pts.push({
      x,
      y: ridgeY - amp * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.0012 + 1.2)))
                + (rng() - 0.5) * amp * 0.3
    });
  }
  pts.push({ x: W + 20, y: ridgeY + amp });

  ctx.fillStyle = rgba(color, 0.85);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for(const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(W, H + 4);
  ctx.lineTo(-4, H + 4);
  ctx.closePath();
  ctx.fill();
}

/** Painterly mass — solid silhouette with a subtle vertical tonal
 *  gradient (top mixed toward violet, bottom anchored in deep) so the
 *  mass reads as a deliberate sculpted shape, not a flat box.
 *  Optional `topRim` paints a 2px accent-tinted highlight along the top
 *  edge, suggesting the room's accent light catching the silhouette. */
function paintPaintedRect(x, y, w, h, color, opacity = 1, topRim = null){
  const violet = hexToRgb(TWEAKS.colorViolet);
  const deep   = hexToRgb(TWEAKS.colorDeep);

  // Top color is the base mixed slightly toward violet (atmospheric scatter
  // brushes the silhouette top), bottom is deeper (anchored in shadow).
  const topC = mix(color, violet, 0.14);
  const botC = mix(color, deep,   0.30);
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, rgba(topC, opacity));
  grad.addColorStop(1, rgba(botC, opacity));
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Optional top-edge accent rim — a thin warm light catching the top.
  if(topRim){
    const rimGrad = ctx.createLinearGradient(x, y, x, y + 6);
    rimGrad.addColorStop(0, rgba(topRim, 0.55));
    rimGrad.addColorStop(1, rgba(topRim, 0));
    ctx.fillStyle = rimGrad;
    ctx.fillRect(x, y, w, 6);
  }
}

/** Drop a soft accent-tinted glow blob at (x, y) — used for interior
 *  light sources (forge fire, shop interior, dome shutter, altar slab). */
function paintInteriorGlow(x, y, r, color, opacity = 0.45){
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0,   rgba(color, opacity));
  g.addColorStop(0.5, rgba(color, opacity * 0.35));
  g.addColorStop(1,   rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Paint a large vertical cosmic aura around a scene's centerpiece — a
 *  tall soft halo of the scene's accent color, bleeding well upward into
 *  the cosmos and tapering down to the horizon. This is what makes each
 *  scene feel astral rather than architectural: the focal element reads
 *  as a conduit between the structures below and the cosmos above.
 *  Painted into the fgCache BEFORE the silhouettes so they sit on top. */
function paintCenterpieceAura(x, y, rx, ry, color, intensity = 0.75){
  const bone = hexToRgb(TWEAKS.colorBone);
  ctx.save();
  ctx.translate(x, y);
  // Anisotropic ellipse via non-uniform scale on a radial gradient
  const ratio = rx / ry;
  ctx.scale(ratio, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
  g.addColorStop(0,    rgba(mix(color, bone, 0.45), 0.42 * intensity));
  g.addColorStop(0.18, rgba(color, 0.26 * intensity));
  g.addColorStop(0.5,  rgba(color, 0.10 * intensity));
  g.addColorStop(1,    rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-ry * 1.05, -ry * 1.05, ry * 2.1, ry * 2.1);
  ctx.restore();
}

/** Scatter a loose ring of bright pinpoint sparkles around a centerpiece
 *  — small dots arranged on an elliptical orbit, each with a soft halo.
 *  Evokes orbital motes / cosmic energy clinging to the focal element. */
function paintOrbitalSparkles(cx, cy, rx, ry, color, seedSalt = 0){
  const bone = hexToRgb(TWEAKS.colorBone);
  const rng = makePRNG(TWEAKS.seed + seedSalt + 1031);
  const N = 7 + Math.floor(rng() * 5);
  for(let i = 0; i < N; i++){
    // Distribute around the ellipse with some scatter; bias to upper arc
    // (-PI..0) so sparkles read against the sky rather than the silhouette.
    const baseA = -Math.PI + (i / N) * Math.PI;
    const angle = baseA + (rng() - 0.5) * 0.5;
    const rJit = 0.78 + rng() * 0.35;
    const sx = cx + Math.cos(angle) * rx * rJit;
    const sy = cy + Math.sin(angle) * ry * rJit;
    const sr = 1.1 + rng() * 1.8;
    const op = 0.45 + rng() * 0.40;
    const tone = rng() < 0.55 ? color : mix(color, bone, 0.55);
    // Soft halo around each pip
    const haloR = sr * 7;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, haloR);
    halo.addColorStop(0, rgba(tone, op * 0.55));
    halo.addColorStop(1, rgba(tone, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(sx - haloR, sy - haloR, haloR * 2, haloR * 2);
    // Core dot
    ctx.fillStyle = rgba(tone, op);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Classical anvil silhouette: horn left, flat top, narrow waist, wide base.
 *  `scale` shrinks the anvil uniformly while keeping its base planted on
 *  groundY — used to make the anvil read as an accent rather than a hero. */
function drawAnvil(cx, topY, groundY, color, rim, scale = 1){
  const violet = hexToRgb(TWEAKS.colorViolet);
  const deep   = hexToRgb(TWEAKS.colorDeep);
  // Vertical gradient: top lighter (catches light), base darker.
  ctx.save();
  if(scale !== 1){
    // Anchor the scale at (cx, groundY) so the base stays planted on the floor.
    ctx.translate(cx, groundY);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -groundY);
  }
  const grad = ctx.createLinearGradient(0, topY, 0, groundY);
  grad.addColorStop(0, rgba(mix(color, violet, 0.18), 1));
  grad.addColorStop(1, rgba(mix(color, deep, 0.30), 1));
  ctx.fillStyle = grad;

  // Top plate with curved horn pointing left (signature anvil silhouette)
  ctx.beginPath();
  ctx.moveTo(cx - 150, topY + 26);                  // horn tip
  ctx.quadraticCurveTo(cx - 110, topY + 8, cx - 70, topY + 2);  // upper horn curve
  ctx.lineTo(cx + 130, topY + 2);                   // top back
  ctx.quadraticCurveTo(cx + 144, topY + 8, cx + 138, topY + 24);  // back drop
  ctx.lineTo(cx + 138, topY + 40);
  ctx.lineTo(cx - 138, topY + 40);
  ctx.quadraticCurveTo(cx - 152, topY + 36, cx - 150, topY + 26);
  ctx.closePath();
  ctx.fill();

  // Waist (narrow column under the top)
  ctx.fillRect(cx - 52, topY + 40, 104, 72);
  // Base (wider footing — two tiers)
  ctx.fillRect(cx - 116, topY + 112, 232, 36);
  ctx.fillRect(cx - 94,  topY + 148, 188, groundY - (topY + 148));

  // Accent rim catching the very top of the anvil
  if(rim){
    ctx.strokeStyle = rgba(rim, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 70, topY + 2);
    ctx.lineTo(cx + 130, topY + 2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ──────────────────────── twinkle sparks (animated) ──────────────────────── */

function paintAnimatedSparks(peaks, t){
  const N = Math.min(TWEAKS.sparkCount, peaks.length);
  if(N <= 0) return;
  const bone   = hexToRgb(TWEAKS.colorBone);
  const accent = hexToRgb(activeAccent());
  const aurora = hexToRgb(TWEAKS.colorAurora);

  // Take evenly-spaced peaks across x for visual balance
  const sorted = [...peaks].sort((a, b) => a.x - b.x);
  const picks = [];
  for(let i = 0; i < N; i++){
    const tt = (i + 0.5) / N;
    const idx = Math.min(sorted.length - 1, Math.round(tt * (sorted.length - 1)));
    picks.push(sorted[idx]);
  }

  picks.forEach((p, i) => {
    const cx = p.x;
    const cy = p.y - 24;
    const useAccent = i === Math.floor(N / 2);  // mid spark uses the scene accent
    const tip = useAccent ? accent : bone;

    // Per-spark phase based on its x position, so they don't all pulse in sync
    const phase = (p.x / W) * Math.PI * 2;
    const breath = 0.5 + 0.5 * Math.sin(t * 0.9 + phase);
    const haloR  = 38 * (0.85 + 0.25 * breath);
    const haloOp = 0.20 + 0.25 * breath;

    // Soft halo
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
    halo.addColorStop(0, rgba(useAccent ? accent : aurora, haloOp));
    halo.addColorStop(1, rgba(aurora, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(cx - haloR, cy - haloR, haloR * 2, haloR * 2);

    // 4-point cross
    const crossOp = 0.65 + 0.20 * breath;
    ctx.strokeStyle = rgba(tip, crossOp);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 14);
    ctx.stroke();

    // Center dot — slightly modulated
    const dotOp = 0.85 + 0.15 * breath;
    ctx.fillStyle = rgba(tip, dotOp);
    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ──────────────────────── grain ──────────────────────── */

function paintGrain(baselineY){
  // Stipple a fine bone-white noise across the silhouette band — only.
  const rng = makePRNG(TWEAKS.seed + 999);
  const bone = hexToRgb(TWEAKS.colorBone);
  const auroraRgb = hexToRgb(TWEAKS.colorAurora);
  const N = Math.round(W * (H - baselineY) / 600 * TWEAKS.grain);

  for(let i = 0; i < N; i++){
    const x = rng() * W;
    const y = baselineY + rng() * (H - baselineY);
    const tint = rng() < 0.8 ? bone : auroraRgb;
    ctx.fillStyle = rgba(tint, 0.025 + rng() * 0.04);
    ctx.fillRect(x, y, 1, 1);
  }
}

/* ──────────────────────── alpha fade ──────────────────────── */

function applyAlphaFade(){
  // Build a vertical gradient mask: transparent at top, opaque at bottom.
  // 'destination-in' keeps the destination only where the source is opaque.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const fade = ctx.createLinearGradient(0, 0, 0, H);
  // Above fadeStart fraction: hard transparent. Below: ramp to fully opaque.
  const f0 = TWEAKS.fadeStart;
  const f1 = Math.min(0.95, f0 + 0.55);   // ramp width
  fade.addColorStop(0,  'rgba(0,0,0,0)');
  fade.addColorStop(f0, 'rgba(0,0,0,0)');
  fade.addColorStop(f1, 'rgba(0,0,0,1)');
  fade.addColorStop(1,  'rgba(0,0,0,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ──────────────────────── controls + tweaks ──────────────────────── */

const wrap = document.getElementById('wrap');
const hud  = document.getElementById('hud');

document.querySelectorAll('.controls button[data-act]').forEach(btn => {
  btn.addEventListener('click', () => {
    const act = btn.dataset.act;
    if(act === 'checker'){
      wrap.classList.toggle('checker');
      btn.classList.toggle('on', wrap.classList.contains('checker'));
    } else if(act === 'hud'){
      hud.classList.toggle('on');
      btn.classList.toggle('on', hud.classList.contains('on'));
    } else if(act === 'fullscreen'){
      enterFullscreen();
    } else if(act === 'png'){
      exportPNG(parseInt(btn.dataset.size, 10) || 2048);
    } else if(act === 'reseed'){
      TWEAKS.seed = 1 + Math.floor(Math.random() * 998);
      staticDirty = true;
      syncUI();
      render();
      window.parent.postMessage({ type:'__edit_mode_set_keys', edits:{ seed: TWEAKS.seed }}, '*');
    }
  });
});

// Aspect-ratio preset chips — swap the wrap's aspect class. The
// ResizeObserver on the wrap picks up the size change and rebuilds the
// statics at the new resolution.
const AR_CLASSES = ['ar-21x9','ar-16x9','ar-4x3','ar-1x1','ar-9x16'];
document.querySelectorAll('.controls button.ar').forEach(btn => {
  btn.addEventListener('click', () => {
    const cls = btn.dataset.ar || '';
    AR_CLASSES.forEach(c => wrap.classList.remove(c));
    if(cls) wrap.classList.add(cls);
    document.querySelectorAll('.controls button.ar').forEach(b => {
      b.classList.toggle('on', b === btn);
    });
  });
});

// Fullscreen preview — overlay the wrap on the entire viewport so you
// can see the backdrop as the actual in-game background it's meant to be.
function enterFullscreen(){
  wrap.classList.add('fullscreen');
  document.body.style.overflow = 'hidden';
}
function exitFullscreen(){
  wrap.classList.remove('fullscreen');
  document.body.style.overflow = '';
}
document.getElementById('exit-fs').addEventListener('click', exitFullscreen);
window.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && wrap.classList.contains('fullscreen')){
    exitFullscreen();
  }
});

async function exportPNG(sizePx){
  // Force one synchronous static-frame render so the captured image matches
  // what the user sees (without the rAF animation phase mid-cycle).
  if(staticDirty) rebuildStatics();
  renderFrame();

  const aspect = H / W;
  const outW = sizePx;
  const outH = Math.round(sizePx * aspect);

  const off = document.createElement('canvas');
  off.width = outW;
  off.height = outH;
  const offCtx = off.getContext('2d');
  offCtx.imageSmoothingQuality = 'high';
  offCtx.drawImage(canvas, 0, 0, outW, outH);

  const url = off.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `fortune-fallacy-backdrop-${TWEAKS.scene}-${TWEAKS.seed}-${outW}x${outH}.png`;
  a.click();
}

/* ───────── Tweaks panel ───────── */

const panel  = document.getElementById('tweaks');
const fab    = document.getElementById('tweaks-fab');
const closeB = document.getElementById('tweaks-close');

function showPanel(){ panel.classList.add('open'); fab.classList.add('hidden'); }
function hidePanel(){ panel.classList.remove('open'); fab.classList.remove('hidden'); }

window.addEventListener('message', (e) => {
  const d = e.data || {};
  if(d.type === '__activate_edit_mode')   showPanel();
  if(d.type === '__deactivate_edit_mode') hidePanel();
});
window.parent.postMessage({ type: '__edit_mode_available' }, '*');

closeB.addEventListener('click', () => {
  hidePanel();
  window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
});
fab.addEventListener('click', showPanel);

function syncUI(){
  panel.querySelectorAll('[data-tw]').forEach(el => {
    const k = el.dataset.tw;
    if(!(k in TWEAKS)) return;
    el.value = TWEAKS[k];
  });
  panel.querySelectorAll('.val[data-val]').forEach(el => {
    const k = el.dataset.val;
    const v = TWEAKS[k];
    el.textContent = (typeof v === 'number')
      ? (Number.isInteger(v) ? v : v.toFixed(2))
      : v;
  });
  panel.querySelectorAll('[data-tw-toggle]').forEach(grp => {
    const k = grp.dataset.twToggle;
    const v = !!TWEAKS[k];
    grp.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', (b.dataset.v === 'true') === v);
    });
  });
}

function applyTweak(key, value){
  if(typeof TWEAKS[key] === 'number') value = +value;
  TWEAKS[key] = value;
  // Anything except the pure-animation tweaks invalidates the heavy caches.
  if(key !== 'animate' && key !== 'animSpeed' && key !== 'twinkleAmount'){
    staticDirty = true;
  }
  syncUI();
  render();
  window.parent.postMessage({
    type: '__edit_mode_set_keys',
    edits: { [key]: value }
  }, '*');
}

panel.querySelectorAll('[data-tw]').forEach(el => {
  el.addEventListener('input', () => applyTweak(el.dataset.tw, el.value));
});

panel.querySelectorAll('[data-tw-toggle]').forEach(grp => {
  const k = grp.dataset.twToggle;
  grp.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTweak(k, btn.dataset.v === 'true');
    });
  });
});

syncUI();

/* ───────── boot ───────── */
render();
