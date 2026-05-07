// Tiny CSV writer — no deps. Escapes commas/quotes/newlines per RFC 4180.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function escape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function writeCsv(path: string, rows: Array<Record<string, unknown>>): void {
  if (rows.length === 0) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '');
    return;
  }
  const headers = Array.from(
    rows.reduce((set, r) => { for (const k of Object.keys(r)) set.add(k); return set; }, new Set<string>())
  );
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(','));
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, lines.join('\n') + '\n');
}
