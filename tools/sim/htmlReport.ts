// Generates a single self-contained HTML dashboard from the sim CSV outputs.
// No external deps, no CDN — inline SVG bars only.
//
// Usage:
//   npx tsx tools/sim/htmlReport.ts
//
// Reads:
//   docs/sim-data/sweep_summary.csv
//   docs/sim-data/sweep_runs.csv
//   docs/sim-data/sweep_blinds.csv
//   docs/sim-data/stacked_deck_sweep.csv
//   docs/sim-data/catalyst_impact_lyra_spark.csv
// Writes:
//   docs/sim-data/dashboard.html

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function readCsv(path: string): Array<Record<string, string>> {
  let raw: string;
  try { raw = readFileSync(path, 'utf-8'); } catch { return []; }
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]!);
  return lines.slice(1).map((ln) => {
    const cells = parseCsvLine(ln);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

function parseCsvLine(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inQ) {
      if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function hbar(label: string, value: number, max: number, width = 200, fmt: (v: number) => string = (v) => String(Math.round(v))): string {
  const w = max > 0 ? Math.max(0, Math.min(1, value / max)) * width : 0;
  const color = value < 0 ? '#e2334a' : (value > max * 0.6 ? '#5be8a4' : '#7be3ff');
  return `<div class="hbar"><span class="hl">${label}</span><svg width="${width}" height="14"><rect x="0" y="2" width="${w}" height="10" rx="2" fill="${color}"/></svg><span class="hv">${fmt(value)}</span></div>`;
}

function table(headers: string[], rows: Array<string[]>, opts: { tight?: boolean } = {}): string {
  const cls = opts.tight ? 'tbl tbl-tight' : 'tbl';
  return `<table class="${cls}"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

function pct(n: number): string { return `${(n * 100).toFixed(1)}%`; }

// ---- Load data ----
const sweepSummary = readCsv('docs/sim-data/sweep_summary.csv');
const sweepRuns = readCsv('docs/sim-data/sweep_runs.csv');
const sweepBlinds = readCsv('docs/sim-data/sweep_blinds.csv');
const stacked = readCsv('docs/sim-data/stacked_deck_sweep.csv');
const catalystImpact = readCsv('docs/sim-data/catalyst_impact_lyra_spark.csv');

// ---- Section: per-constellation ante reach ----
const constellations = [...new Set(sweepSummary.map((r) => r.constellation!))];
const stakes = ['spark', 'ember', 'pyre', 'beacon', 'nova', 'supernova'];

let constSection = '';
for (const c of constellations) {
  const rows = stakes.map((s) => {
    const r = sweepSummary.find((x) => x.constellation === c && x.stake === s);
    if (!r) return [s, '-', '-', '-', '-'];
    return [
      s,
      pct(Number(r.winRate)),
      Number(r.meanAnte).toFixed(2),
      Number(r.meanScore).toFixed(0),
      r.medianScore!,
    ];
  });
  constSection += `<h3>${c}</h3>` + table(['stake', 'winRate', 'meanAnte', 'meanScore', 'medianScore'], rows, { tight: true });
}

// ---- Section: combo distribution across all sweep runs ----
const comboKeys = ['chance', 'one_pair', 'two_pair', 'three_kind', 'sm_straight', 'full_house', 'lg_straight', 'four_kind', 'five_kind'];
const comboTotals: Record<string, number> = {};
for (const r of sweepRuns) {
  for (const k of comboKeys) comboTotals[k] = (comboTotals[k] ?? 0) + Number(r[`combo_${k}`] ?? 0);
}
const comboMax = Math.max(...Object.values(comboTotals));
const comboBars = comboKeys.map((k) => hbar(k, comboTotals[k] ?? 0, comboMax, 280)).join('');

// ---- Section: per-blind clear rate ----
const perBlindStats = new Map<string, { clears: number; busts: number; meanScore: number; n: number }>();
for (const b of sweepBlinds) {
  const key = `${b.constellation}|${b.stake}|ante${b.ante}|${b.blindId}`;
  const acc = perBlindStats.get(key) ?? { clears: 0, busts: 0, meanScore: 0, n: 0 };
  if (b.outcome === 'clear') acc.clears++;
  if (b.outcome === 'bust') acc.busts++;
  acc.meanScore += Number(b.score);
  acc.n++;
  perBlindStats.set(key, acc);
}
// Top 30 hardest blinds (highest bust rate, n >= 5)
const blindHardness = [...perBlindStats.entries()]
  .map(([k, v]) => ({ key: k, n: v.n, bustRate: v.busts / Math.max(1, v.n), meanScore: v.meanScore / Math.max(1, v.n) }))
  .filter((x) => x.n >= 5)
  .sort((a, b) => b.bustRate - a.bustRate)
  .slice(0, 30);
const hardestBlindsTable = table(
  ['constellation/stake/ante/blind', 'n', 'bustRate', 'meanScore'],
  blindHardness.map((b) => [b.key, String(b.n), pct(b.bustRate), b.meanScore.toFixed(0)]),
  { tight: true }
);

// ---- Section: catalyst impact ----
const ciSorted = [...catalystImpact].sort((a, b) => Number(b.deltaScorePct) - Number(a.deltaScorePct));
const ciTable = table(
  ['catalyst', 'rarity', 'archetype', 'Δscore', 'Δ%', 'Δante', 'ctlScore', 'trtScore'],
  ciSorted.map((r) => [
    r.catalystId!, r.rarity!, r.archetype!,
    r.deltaScore!, `${r.deltaScorePct!}%`, r.deltaAnte!,
    r.meanScoreControl!, r.meanScoreTreatment!,
  ]),
  { tight: true }
);

// ---- Section: stacked decks ----
const stackedConsts = [...new Set(stacked.map((r) => r.constellation!))];
const stackedLoadouts = [...new Set(stacked.map((r) => r.loadout!))];
let stackedSection = '';
for (const c of stackedConsts) {
  stackedSection += `<h3>${c}</h3>`;
  const rows: string[][] = [];
  for (const s of stakes) {
    const row = [s];
    for (const l of stackedLoadouts) {
      const r = stacked.find((x) => x.constellation === c && x.stake === s && x.loadout === l);
      if (!r) row.push('-');
      else row.push(`${pct(Number(r.winRate))} (a${Number(r.meanAnte).toFixed(1)})`);
    }
    rows.push(row);
  }
  stackedSection += table(['stake', ...stackedLoadouts], rows, { tight: true });
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>FortuneFallacy Sim Dashboard</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; background: #0f0925; color: #f3f0ff; line-height: 1.4; }
  h1 { color: #7be3ff; border-bottom: 2px solid #5c39c4; padding-bottom: 8px; }
  h2 { color: #f5c451; margin-top: 32px; }
  h3 { color: #bba8ff; margin-top: 16px; margin-bottom: 6px; font-size: 16px; }
  .meta { color: #9577ff; font-size: 13px; margin-bottom: 16px; }
  .hbar { display: flex; align-items: center; gap: 8px; margin: 2px 0; font-size: 13px; }
  .hl { display: inline-block; width: 90px; color: #bba8ff; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
  .hv { color: #f5c451; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
  table.tbl { border-collapse: collapse; margin: 8px 0 16px; font-size: 13px; }
  table.tbl-tight { font-size: 11px; }
  table.tbl th { background: #1c1245; padding: 4px 8px; text-align: left; color: #7be3ff; border-bottom: 1px solid #432896; }
  table.tbl td { padding: 3px 8px; border-bottom: 1px solid #1c1245; font-family: 'JetBrains Mono', monospace; }
  table.tbl tr:hover { background: #1c1245; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .card { background: rgba(46,29,107,.35); border: 1px solid rgba(149,119,255,.3); border-radius: 8px; padding: 16px; }
  .note { color: #9577ff; font-style: italic; font-size: 12px; }
</style>
</head><body>
<h1>FortuneFallacy Simulation Dashboard</h1>
<p class="meta">Generated ${new Date().toISOString()} · ${sweepRuns.length} sweep runs · ${catalystImpact.length} catalysts evaluated · ${stacked.length} stacked-deck cells</p>

<h2>1 · Sweep — bot baseline (heuristic_shop strategy)</h2>
<p class="note">Each (constellation, stake) cell played 300 runs. Win rate = clearing all 4 antes. The bot does not approximate optimal play — these numbers are a "naive but reasonable" floor. 0% across the board is itself the headline finding.</p>
${constSection}

<h2>2 · Combo distribution (sweep)</h2>
<p class="note">Total combos played across all ${sweepRuns.length} runs. Note how rarely the bot reaches Full House / Large Straight tier.</p>
<div class="card">${comboBars}</div>

<h2>3 · Hardest blinds (where bots bust)</h2>
<p class="note">Per-blind bust rate, sorted descending. n≥5 filter to drop noise.</p>
${hardestBlindsTable}

<h2>4 · Catalyst impact study (Lyra / Spark)</h2>
<p class="note">Matched-pair seeds (NoBuy strategy), comparing finalScore with vs. without each catalyst granted at run start. Sorted by Δ% descending. "Dead" rows at 0% suggest catalysts that need specific conditions a no-shop bot can't trigger.</p>
${ciTable}

<h2>5 · Stacked deck sweep</h2>
<p class="note">Granting curated catalyst loadouts up front, no shopping. Win rate per (constellation, stake, loadout). Even strong loadouts struggle at higher stakes — the run-build dimension (vouchers, galaxies, mods, more catalysts) matters more than any single 4-card combo.</p>
${stackedSection}

</body></html>`;

mkdirSync(dirname('docs/sim-data/dashboard.html'), { recursive: true });
writeFileSync('docs/sim-data/dashboard.html', html);
console.log(`Wrote docs/sim-data/dashboard.html (${html.length} bytes)`);
