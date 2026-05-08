// Telemetry heatmap — aggregates per-catalyst appearance counts in
// winning runs across all sim cells, then renders a tab-aligned text
// grid AND an inline-SVG heatmap pinned into docs/sim-data/heatmap.html.
//
// Use case: spotting catalysts that NEVER show up in winning builds
// (= dead weight) and those that show up disproportionately (= the
// meta). Pairs with diversityIndex.ts which gives per-pair stats;
// this gives per-catalyst stats per (constellation, stake) cell.
//
// Usage:
//   npx tsx tools/sim/heatmap.ts --runs 200
//   npx tsx tools/sim/heatmap.ts --runs 500 --constellations lyra,mensa --stakes spark,ember

import { runMany } from './runMany';
import { CATALYST_META } from '../../src-next/data/catalysts';
import { CONSTELLATIONS } from '../../src-next/data/constellations';
import { parseArgs } from './args';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ALL_CONSTELLATIONS = CONSTELLATIONS.map((c) => c.id);
const DEFAULT_STAKES = ['spark', 'ember', 'pyre'];

interface HeatmapOptions {
  runsPerCell: number;
  baseSeed: number;
  constellations: string[];
  stakes: string[];
  outPath: string;
}

interface CellData {
  constellation: string;
  stake: string;
  wins: number;
  catalystCounts: Map<string, number>;
}

function gather(opts: HeatmapOptions): CellData[] {
  const cells: CellData[] = [];
  for (const constellation of opts.constellations) {
    for (const stake of opts.stakes) {
      const summary = runMany({
        constellationId: constellation,
        stakeId: stake,
        strategy: 'heuristic_shop',
        runs: opts.runsPerCell,
        baseSeed: opts.baseSeed,
      });
      const cell: CellData = {
        constellation, stake,
        wins: 0,
        catalystCounts: new Map(),
      };
      for (const r of summary.records) {
        if (!r.won) continue;
        cell.wins++;
        for (const c of r.finalCatalysts) {
          cell.catalystCounts.set(c, (cell.catalystCounts.get(c) ?? 0) + 1);
        }
      }
      cells.push(cell);
    }
  }
  return cells;
}

function renderHtml(cells: CellData[], opts: HeatmapOptions): string {
  const catalystIds = CATALYST_META.map((c) => c.id);
  // Cell width fixed; rows per cell scale to the catalyst count.
  const cellW = 22;
  const cellH = 18;
  const labelW = 160;
  const headerH = 60;
  const totalW = labelW + cells.length * cellW + 20;
  const totalH = headerH + catalystIds.length * cellH + 20;

  // Find max appearance to normalize colors.
  let maxAppearance = 1;
  for (const cell of cells) {
    for (const v of cell.catalystCounts.values()) {
      if (v > maxAppearance) maxAppearance = v;
    }
  }

  const cellLabel = (c: CellData) => `${c.constellation.slice(0, 3)}/${c.stake.slice(0, 3)}`;

  const rows = catalystIds.map((id, rowIdx) => {
    const meta = CATALYST_META.find((c) => c.id === id);
    const name = meta?.name ?? id;
    const y = headerH + rowIdx * cellH;
    const cellsSvg = cells.map((cell, ci) => {
      const x = labelW + ci * cellW;
      const v = cell.catalystCounts.get(id) ?? 0;
      const ratio = v / maxAppearance;
      // Cool→warm gradient: empty=charcoal, light=cyan, hot=ember.
      const r = Math.round(20 + ratio * 235);
      const g = Math.round(20 + ratio * 100);
      const b = Math.round(40 + (1 - ratio) * 80);
      const fill = `rgb(${r},${g},${b})`;
      return `<rect x="${x}" y="${y}" width="${cellW - 2}" height="${cellH - 2}" fill="${fill}" stroke="#222"><title>${name} · ${cellLabel(cell)}: ${v} wins</title></rect>`;
    }).join('');
    return (
      `<text x="6" y="${y + cellH * 0.7}" fill="#dcd4ff" font-family="monospace" font-size="10">${name}</text>` +
      cellsSvg
    );
  }).join('');

  const headerCells = cells.map((cell, ci) => {
    const x = labelW + ci * cellW + cellW / 2;
    return `<g transform="translate(${x},${headerH - 4}) rotate(-60)"><text fill="#bba8ff" font-family="monospace" font-size="9" text-anchor="end">${cellLabel(cell)}</text></g>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>FortuneFallacy · Catalyst × Cell Heatmap</title>
<style>body{background:#07051a;color:#dcd4ff;font-family:monospace;padding:24px} h1{color:#7be3ff;font-weight:300;letter-spacing:0.2em}</style></head>
<body>
<h1>◇ Catalyst × Cell Heatmap ◇</h1>
<p>Per-catalyst appearance count in WINNING runs across ${cells.length} (constellation × stake) cells, ${opts.runsPerCell} runs per cell.</p>
<p>Rows: ${CATALYST_META.length} catalysts · Cols: ${cells.length} cells · Hottest cell: ${maxAppearance} appearances.</p>
<svg width="${totalW}" height="${totalH}">
  ${headerCells}
  ${rows}
</svg>
</body></html>`;
}

export function generateHeatmap(opts: HeatmapOptions): void {
  const cells = gather(opts);
  const html = renderHtml(cells, opts);
  mkdirSync(dirname(opts.outPath), { recursive: true });
  writeFileSync(opts.outPath, html, 'utf-8');
  console.log(`Wrote heatmap → ${opts.outPath}`);

  // Console summary: dead-weight catalysts (zero appearances).
  const totalAppearances = new Map<string, number>();
  for (const cell of cells) {
    for (const [id, v] of cell.catalystCounts) {
      totalAppearances.set(id, (totalAppearances.get(id) ?? 0) + v);
    }
  }
  const deadWeight = CATALYST_META.filter((c) => (totalAppearances.get(c.id) ?? 0) === 0);
  if (deadWeight.length > 0) {
    console.log(`\n[DEAD WEIGHT] ${deadWeight.length} catalysts never appeared in any winning build:`);
    for (const c of deadWeight) console.log(`  - ${c.name}`);
  } else {
    console.log('\nAll catalysts appeared in at least one winning build.');
  }
}

const isMain = (() => {
  try {
    const argv1 = process.argv[1] ?? '';
    return argv1.endsWith('heatmap.ts') || argv1.endsWith('heatmap.js');
  } catch { return false; }
})();

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const constellationsArg = args.constellations as string | undefined;
  const stakesArg = args.stakes as string | undefined;
  const opts: HeatmapOptions = {
    runsPerCell: Number(args.runs ?? 200),
    baseSeed: Number(args.seed ?? 1),
    constellations: constellationsArg ? constellationsArg.split(',') : ALL_CONSTELLATIONS,
    stakes: stakesArg ? stakesArg.split(',') : DEFAULT_STAKES,
    outPath: args.out ? String(args.out) : 'docs/sim-data/heatmap.html',
  };
  console.log(`Heatmap sweep: ${opts.constellations.length} × ${opts.stakes.length} cells × ${opts.runsPerCell} runs`);
  const t0 = Date.now();
  generateHeatmap(opts);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Done in ${dt}s.`);
}
