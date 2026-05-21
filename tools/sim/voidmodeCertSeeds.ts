// tools/sim/voidmodeCertSeeds.ts
// Manual / CI script. Enumerate candidate seeds for the next 90 UTC
// days, filter to clear-rate band, write certified entries to
// src-next/voidmode/dailyCertified.json.
//
// Run with: npx tsx tools/sim/voidmodeCertSeeds.ts
// WARNING: 200 trials per seed x 90 days x multiple candidate-seed
// retries per day = many minutes of CPU. Run before each release, not
// per-CI.

import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateSeed } from '../../src-next/voidmode/balanceSim';
import { getVoidDailyDate } from '../../src-next/voidmode/dailySeed';

const JSON_PATH = join(process.cwd(), 'src-next/voidmode/dailyCertified.json');

interface CertifiedFile {
  version: number;
  entries: Array<{ date: string; seed: number; clearRate: number }>;
}

async function main(): Promise<void> {
  const file = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as CertifiedFile;
  const existing: Record<string, true> = {};
  for (const e of file.entries) existing[e.date] = true;

  const cursor = new Date();
  const newEntries: CertifiedFile['entries'] = [];
  for (let day = 0; day < 90; day++) {
    const date = getVoidDailyDate(cursor);
    if (!existing[date]) {
      let attempt = 0;
      while (attempt < 100) {
        // Date-deterministic candidate seed: derived from the UTC day
        // so the same date always tries the same seed sequence. This
        // makes the script idempotent — running twice on the same day
        // picks the same first-in-band seed.
        const seed = (Number.parseInt(date.replace(/-/g, ''), 10) + attempt * 1009) >>> 0;
        const res = await evaluateSeed(seed);
        if (res.inBand) {
          newEntries.push({ date, seed: res.seed, clearRate: res.clearRate });
          break;
        }
        attempt++;
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  file.entries = [...file.entries, ...newEntries].sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(JSON_PATH, JSON.stringify(file, null, 2));
  console.log(`Wrote ${newEntries.length} new certified entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
