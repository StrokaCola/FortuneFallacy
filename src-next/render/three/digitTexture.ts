// Cached digit textures used to label faces of non-cube dice (d4..d20).
//
// Renders the numeral (1..20, plus '★' for WILD-coded -1 and '·' for BLANK 0)
// onto a small canvas in the supplied color. The same digit-color pair is
// shared across all dice in a session so 8 dice rolling values 1..20 only
// allocate as many textures as distinct values appear.

import * as THREE from 'three';

const CACHE = new Map<string, THREE.CanvasTexture>();
const TEX_SIZE = 128;

export function getDigitTexture(value: number, color: number): THREE.CanvasTexture {
  const key = `${value}-${color.toString(16)}`;
  const cached = CACHE.get(key);
  if (cached) return cached;
  const tex = renderDigit(value, color);
  CACHE.set(key, tex);
  return tex;
}

function renderDigit(value: number, color: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = TEX_SIZE;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

  const label = labelFor(value);
  const fill = `#${color.toString(16).padStart(6, '0')}`;

  ctx.fillStyle = fill;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Two-digit numerals get a slightly smaller font so they don't clip the
  // edge of the inscribed circle on smaller faces (d20 in particular).
  const fontSize = label.length >= 2 ? Math.round(TEX_SIZE * 0.52) : Math.round(TEX_SIZE * 0.72);
  ctx.font = `700 ${fontSize}px "Cinzel", "Cinzel Decorative", serif`;
  // Subtle stroke for legibility against the lit lens.
  ctx.lineWidth = Math.max(2, fontSize * 0.06);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeText(label, TEX_SIZE / 2, TEX_SIZE / 2 + fontSize * 0.04);
  ctx.fillText(label, TEX_SIZE / 2, TEX_SIZE / 2 + fontSize * 0.04);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function labelFor(value: number): string {
  if (value === -1) return '★';
  if (value === 0) return '·';
  return String(value);
}
