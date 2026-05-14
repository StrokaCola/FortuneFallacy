// scripts/extract-brand.ts — generate standalone SVG files for the brand
// kit. The visual identity for FortuneFallacy is procedural and lives
// inside the React/TS source (boss sigils as `SigilGroup[]` in
// `data/blinds.ts`, constellation glyphs as `{x,y}[]` in
// `data/constellations.ts`, catalyst + mod sigils as JSX renderers in
// `data/catalystIcons.tsx` and `data/modIcons.tsx`). Without standalone
// files, none of those assets can be shared as PNGs, dropped into a
// press kit, embedded as an og:image, or printed on a tee-shirt.
//
// This script reads the canonical data + renders SVGs to
// `public/brand/`. Re-run any time the underlying data changes:
//
//   npx tsx scripts/extract-brand.ts
//
// Output:
//   public/brand/boss-<id>.svg          (8 files, from BOSS_BLINDS)
//   public/brand/constellation-<id>.svg (8 files, from CONSTELLATIONS)
//   public/brand/catalysts/<id>.svg     (N files, one per CATALYST_ICON_SVGS entry)
//   public/brand/mods/<id>.svg          (N files, one per MOD_ICON_SVGS entry)
//   public/brand/wordmark.svg           (the FortuneFallacy logotype)
//   public/brand/mark.svg               (the dice-on-cosmos icon mark)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';

import { BOSS_BLINDS, type BossBlind, type SigilGroup } from '../src-next/data/blinds';
import { CONSTELLATIONS } from '../src-next/data/constellations';
import { CATALYST_META } from '../src-next/data/catalysts';
import { CATALYST_ICON_SVGS } from '../src-next/data/catalystIcons';
import { MODS } from '../src-next/core/mods/index';
import { MOD_ICON_SVGS } from '../src-next/data/modIcons';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'brand');
mkdirSync(OUT_DIR, { recursive: true });

const STROKE_FOR_CLASS: Record<SigilGroup['class'], number> = {
  'orbit-main': 1.5,
  'orbit-aux': 1.0,
  'body-core': 2.0,
  satellite: 1.5,
  mark: 1.0,
};

function renderSigilSvg(boss: BossBlind): string {
  const { viewBox, groups } = boss.sigil;
  const color = boss.color;
  const inner = groups.map((g) => {
    const stroke = g.strokeWidth ?? STROKE_FOR_CLASS[g.class] ?? 1.5;
    const opacity = g.opacity ?? 1;
    const dash = g.dashed ? ' stroke-dasharray="2 4"' : '';
    const fill = g.filled ? color : 'none';
    const strokeCol = g.filled ? 'none' : color;
    return g.paths
      .map((d) => `  <path d="${d}" fill="${fill}" stroke="${strokeCol}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${dash} />`)
      .join('\n');
  }).join('\n');
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${boss.name} sigil">`,
    `  <title>${boss.name} — boss sigil</title>`,
    `  <rect width="100%" height="100%" fill="#07051a"/>`,
    inner,
    `</svg>`,
    ``,
  ].join('\n');
}

function renderConstellationSvg(c: { id: string; name: string; color: string; glyph: { x: number; y: number }[] }): string {
  const pts = c.glyph;
  // Deterministic field stars seeded from the glyph points so each
  // constellation has its own stable scatter — same algorithm as the
  // in-game picker (Glyph component in ConstellationSelect.tsx).
  let seed = 0;
  for (const p of pts) seed = (seed * 31 + (p.x | 0) * 17 + (p.y | 0)) | 0;
  const rnd = mulberry32(seed >>> 0);
  const field: string[] = [];
  for (let i = 0; i < 6; i++) {
    const fx = (4 + rnd() * 92).toFixed(2);
    const fy = (4 + rnd() * 92).toFixed(2);
    const fr = (0.4 + rnd() * 0.6).toFixed(2);
    const fo = (0.18 + rnd() * 0.18).toFixed(2);
    field.push(`  <circle cx="${fx}" cy="${fy}" r="${fr}" fill="#f3f0ff" opacity="${fo}" />`);
  }
  // Two-tone connector: a soft solid base + a dashed memory line —
  // reads as a traced sigil rather than a node-graph.
  const lines: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    lines.push(
      `  <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${c.color}" stroke-width="0.5" opacity="0.55" stroke-linecap="round" />`,
      `  <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${c.color}" stroke-width="0.8" stroke-dasharray="0.4 3" opacity="0.85" stroke-linecap="round" />`,
    );
  }
  // Each star: outer glow + mid halo + bright pip. The primary (index
  // 0) gets a cross-glint sparkle so the figure has a leading anchor.
  const stars: string[] = [];
  pts.forEach((p, i) => {
    const isPrimary = i === 0;
    const r = isPrimary ? 2.6 : 1.8;
    stars.push(
      `  <circle cx="${p.x}" cy="${p.y}" r="${(r * 2.4).toFixed(2)}" fill="${c.color}" opacity="0.18" />`,
      `  <circle cx="${p.x}" cy="${p.y}" r="${(r * 1.5).toFixed(2)}" fill="${c.color}" opacity="0.35" />`,
      `  <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#fff7e0" />`,
    );
    if (isPrimary) {
      stars.push(
        `  <g stroke="#fff7e0" stroke-width="0.4" stroke-linecap="round" opacity="0.9">`,
        `    <line x1="${p.x - 5}" y1="${p.y}" x2="${p.x + 5}" y2="${p.y}" />`,
        `    <line x1="${p.x}" y1="${p.y - 5}" x2="${p.x}" y2="${p.y + 5}" />`,
        `  </g>`,
      );
    }
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${c.name} glyph">`,
    `  <title>${c.name} — constellation glyph</title>`,
    `  <rect width="100%" height="100%" fill="#07051a"/>`,
    ...field,
    ...lines,
    ...stars,
    `</svg>`,
    ``,
  ].join('\n');
}

function mulberry32(a: number) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function renderWordmarkSvg(): string {
  // Text-only wordmark — Cinzel Decorative at large weight against the
  // cosmos backdrop. Anyone embedding this should ship the font alongside
  // (or fall back to a serif).
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" role="img" aria-label="FortuneFallacy">`,
    `  <title>FortuneFallacy wordmark</title>`,
    `  <rect width="100%" height="100%" fill="#07051a"/>`,
    `  <text x="50%" y="58%" text-anchor="middle" dominant-baseline="middle" font-family="'Cinzel Decorative', 'Cinzel', serif" font-weight="900" font-size="56" letter-spacing="4" fill="#f3f0ff">`,
    `    FortuneFallacy`,
    `  </text>`,
    `  <text x="50%" y="84%" text-anchor="middle" dominant-baseline="middle" font-family="'Exo 2', sans-serif" font-size="13" letter-spacing="14" fill="#7be3ff" opacity="0.85">`,
    `    A DICE ROGUELIKE`,
    `  </text>`,
    `</svg>`,
    ``,
  ].join('\n');
}

function renderMarkSvg(): string {
  // Minimalist mark: a single d6 silhouette on a cosmos disc. Sits at
  // square aspect so it works as a favicon, app icon, or social avatar.
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="FortuneFallacy mark">`,
    `  <title>FortuneFallacy mark</title>`,
    `  <defs>`,
    `    <radialGradient id="cosmos" cx="50%" cy="40%" r="80%">`,
    `      <stop offset="0%" stop-color="#2e1d6b" />`,
    `      <stop offset="100%" stop-color="#07051a" />`,
    `    </radialGradient>`,
    `  </defs>`,
    `  <circle cx="64" cy="64" r="60" fill="url(#cosmos)" />`,
    `  <g transform="translate(64 64) rotate(-12)">`,
    `    <rect x="-28" y="-28" width="56" height="56" rx="9" ry="9" fill="#f3f0ff" stroke="#7be3ff" stroke-width="2" />`,
    `    <circle cx="-12" cy="-12" r="3.5" fill="#07051a" />`,
    `    <circle cx="12" cy="-12" r="3.5" fill="#07051a" />`,
    `    <circle cx="0" cy="0" r="3.5" fill="#07051a" />`,
    `    <circle cx="-12" cy="12" r="3.5" fill="#07051a" />`,
    `    <circle cx="12" cy="12" r="3.5" fill="#07051a" />`,
    `  </g>`,
    `</svg>`,
    ``,
  ].join('\n');
}

// Render a registered JSX sigil-renderer to a standalone SVG file body.
// The renderer returns a `<svg viewBox="0 0 24 24" …>` React element
// whose inner shapes are already drawn in the 0–24 coordinate space.
// We serialize it, strip the inner <svg> wrapper, and re-wrap in the
// cosmos-backed XML envelope the boss sigils use so the kit reads as
// one family.
function renderRegistrySvg(
  kind: 'catalyst' | 'mod',
  id: string,
  name: string,
  color: string,
  renderer: (color: string, size: number) => unknown,
): string {
  const inner = renderToStaticMarkup(renderer(color, 24) as never)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  const label = `${name} — ${kind} sigil`;
  // Wrap with the same stroke defaults the runtime <svg> carried, since
  // we stripped that outer tag. Inner shapes that override fill/stroke
  // (e.g. filled pips) still win because attribute inheritance only
  // applies where the child doesn't set the property.
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${label}">`,
    `  <title>${label}</title>`,
    `  <rect width="100%" height="100%" fill="#07051a"/>`,
    `  <g fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`,
    `</svg>`,
    ``,
  ].join('\n');
}

function writeAndReport(path: string, body: string): void {
  writeFileSync(path, body);
  // eslint-disable-next-line no-console
  console.log(`  wrote ${path}  (${body.length}b)`);
}

const CATALYSTS_DIR = join(OUT_DIR, 'catalysts');
const MODS_DIR = join(OUT_DIR, 'mods');
mkdirSync(CATALYSTS_DIR, { recursive: true });
mkdirSync(MODS_DIR, { recursive: true });

console.log(`extracting brand kit → ${OUT_DIR}`);
for (const boss of BOSS_BLINDS) {
  writeAndReport(join(OUT_DIR, `boss-${boss.id}.svg`), renderSigilSvg(boss));
}
for (const c of CONSTELLATIONS) {
  writeAndReport(join(OUT_DIR, `constellation-${c.id}.svg`), renderConstellationSvg(c));
}
let catalystCount = 0;
for (const [id, renderer] of Object.entries(CATALYST_ICON_SVGS)) {
  const meta = CATALYST_META.find((m) => m.id === id);
  if (!meta) {
    console.warn(`  skip catalyst sigil ${id} — no CATALYST_META entry`);
    continue;
  }
  writeAndReport(
    join(CATALYSTS_DIR, `${id}.svg`),
    renderRegistrySvg('catalyst', id, meta.name, meta.color, renderer),
  );
  catalystCount++;
}
let modCount = 0;
for (const [id, renderer] of Object.entries(MOD_ICON_SVGS)) {
  const mod = MODS.find((m) => m.id === id);
  if (!mod) {
    console.warn(`  skip mod sigil ${id} — no MOD entry`);
    continue;
  }
  const color = mod.visual?.accentColor ?? '#f3f0ff';
  writeAndReport(
    join(MODS_DIR, `${id}.svg`),
    renderRegistrySvg('mod', id, mod.name, color, renderer),
  );
  modCount++;
}
writeAndReport(join(OUT_DIR, `wordmark.svg`), renderWordmarkSvg());
writeAndReport(join(OUT_DIR, `mark.svg`), renderMarkSvg());
console.log(
  `done. ${BOSS_BLINDS.length} bosses + ${CONSTELLATIONS.length} constellations + ${catalystCount} catalyst sigils + ${modCount} mod sigils + wordmark + mark`,
);
