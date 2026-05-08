// Visual check: constellation accent threads through ComboBanner +
// TopBar + ActionBar arrows. Captures four constellations side by side
// to confirm each gets its own identity tint and that boss override
// (red) still trumps when active.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = 'http://localhost:5173/FortuneFallacy/';
const OUT_DIR = 'docs/audit-screenshots';

interface DevWindow {
  __ff?: {
    dispatch: (a: { type: string; [k: string]: unknown }) => void;
    store: {
      setState: (s: unknown, replace: boolean) => void;
      getState: () => { meta: { onboarding: { seen: string[]; dismissed: boolean } }; round: { dice: Array<{ id: number; face: number; locked: boolean }> } };
    };
  };
}

async function captureConstellation(page: import('playwright').Page, constellationId: string, label: string): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.click('body');
  await page.waitForTimeout(150);

  await page.evaluate((cid) => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return;
    const s = ff.store.getState();
    ff.store.setState({ ...s, meta: { ...s.meta, onboarding: { seen: [], dismissed: true } } }, true);
    ff.dispatch({ type: 'NEW_RUN', constellationId: cid });
    ff.dispatch({ type: 'START_BLIND' });
    ff.dispatch({ type: 'ROLL_REQUESTED' });
  }, constellationId);
  await page.waitForTimeout(1800);

  // Lock all dice + score so the ComboBanner appears.
  await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return;
    const dieCount = ff.store.getState().round.dice.length;
    for (let i = 0; i < dieCount; i++) {
      ff.dispatch({ type: 'TOGGLE_LOCK', dieIdx: i });
    }
    ff.dispatch({ type: 'SCORE_HAND' });
  });
  // Wait for ComboBanner to appear (fires on onScoreCalculated).
  await page.waitForTimeout(900);

  await page.screenshot({ path: `${OUT_DIR}/accent-${label}.png` });
  console.log(`  accent-${label}.png`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  for (const c of [
    ['lyra', 'lyra-cyan'],
    ['mensa', 'mensa-violet'],
    ['triumvirate', 'triumvirate-amber'],
    ['argo', 'argo-emerald'],
  ] as const) {
    await captureConstellation(page, c[0], c[1]);
  }

  await ctx.close();
  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
