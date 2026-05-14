// scripts/extract-brand.ts — generate standalone SVG files for the brand
// kit. The visual identity for FortuneFallacy is procedural and lives
// inside the React/TS source (boss sigils as `SigilGroup[]` in
// `data/blinds.ts`, constellation glyphs as `{x,y}[]` in
// `data/constellations.ts`). Without standalone files, none of those
// assets can be shared as PNGs, dropped into a press kit, embedded as
// an og:image, or printed on a tee-shirt.
//
// This script reads the canonical data + renders SVGs to
// `public/brand/`. Re-run any time the underlying data changes:
//
//   npx tsx scripts/extract-brand.ts
//
// Output:
//   public/brand/boss-<id>.svg          (8 files, dotted from BOSS_BLINDS)
//   public/brand/constellation-<id>.svg (8 files, from CONSTELLATIONS)
//   public/brand/wordmark.svg           (the FortuneFallacy logotype)
//   public/brand/mark.svg               (the dice-on-cosmos icon mark)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOSS_BLINDS, type BossBlind, type SigilGroup } from '../src-next/data/blinds';
import { CONSTELLATIONS } from '../src-next/data/constellations';

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
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const dots = pts.map((p) => `  <circle cx="${p.x}" cy="${p.y}" r="2.4" fill="${c.color}" />`).join('\n');
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${c.name} glyph">`,
    `  <title>${c.name} — constellation glyph</title>`,
    `  <rect width="100%" height="100%" fill="#07051a"/>`,
    `  <polyline points="${polyline}" fill="none" stroke="${c.color}" stroke-width="0.8" opacity="0.55" stroke-linecap="round" stroke-linejoin="round" />`,
    dots,
    `</svg>`,
    ``,
  ].join('\n');
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

function writeAndReport(path: string, body: string): void {
  writeFileSync(path, body);
  // eslint-disable-next-line no-console
  console.log(`  wrote ${path}  (${body.length}b)`);
}

console.log(`extracting brand kit → ${OUT_DIR}`);
for (const boss of BOSS_BLINDS) {
  writeAndReport(join(OUT_DIR, `boss-${boss.id}.svg`), renderSigilSvg(boss));
}
for (const c of CONSTELLATIONS) {
  writeAndReport(join(OUT_DIR, `constellation-${c.id}.svg`), renderConstellationSvg(c));
}
writeAndReport(join(OUT_DIR, `wordmark.svg`), renderWordmarkSvg());
writeAndReport(join(OUT_DIR, `mark.svg`), renderMarkSvg());
console.log(`done. ${BOSS_BLINDS.length} bosses + ${CONSTELLATIONS.length} constellations + wordmark + mark`);
