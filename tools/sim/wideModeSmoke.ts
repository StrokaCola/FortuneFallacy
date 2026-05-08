// Verify wide-mode layout: catalyst strip becomes a vertical left rail
// at viewport ≥1280×760, falls back to a horizontal row below that.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = 'http://localhost:5173/FortuneFallacy/';
const OUT_DIR = 'docs/audit-screenshots';

interface DevWindow {
  __ff?: {
    dispatch: (action: { type: string; [k: string]: unknown }) => void;
    store: {
      setState: (s: unknown, replace: boolean) => void;
      getState: () => { meta: { onboarding: { seen: string[]; dismissed: boolean } } };
    };
  };
}

async function setup(page: import('playwright').Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return;
    const s = ff.store.getState();
    ff.store.setState({ ...s, meta: { ...s.meta, onboarding: { seen: [], dismissed: true } } }, true);
    ff.dispatch({ type: 'NEW_RUN', constellationId: 'lyra' });
    // Stack a few catalysts so the rail vs row difference is visible.
    ff.dispatch({ type: 'GRANT_CATALYST', id: 'stratifier' });
    ff.dispatch({ type: 'GRANT_CATALYST', id: 'crescendo_run' });
    ff.dispatch({ type: 'GRANT_CATALYST', id: 'compounding_bias' });
    ff.dispatch({ type: 'START_BLIND' });
  });
  await page.waitForTimeout(800);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  // Wide desktop — catalysts vertical rail
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await setup(page);
    await page.screenshot({ path: `${OUT_DIR}/wide-mode-round.png` });
    console.log('  wide-mode-round.png');
    await ctx.close();
  }

  // Below threshold — row fallback (existing layout)
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
    const page = await ctx.newPage();
    await setup(page);
    await page.screenshot({ path: `${OUT_DIR}/wide-mode-narrow-fallback.png` });
    console.log('  wide-mode-narrow-fallback.png');
    await ctx.close();
  }

  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
