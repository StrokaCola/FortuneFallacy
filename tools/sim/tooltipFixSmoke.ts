// Verify the two bug fixes:
//   1. Coachmark renders above the dice canvas (portal escapes #next-root).
//   2. Shop tooltip is no longer clipped by panel-strong overflow:hidden.

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

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // ---- COACHMARK Z-INDEX FIX ----
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Reset onboarding so first-roll coachmark is eligible.
  await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return;
    const s = ff.store.getState();
    ff.store.setState({ ...s, meta: { ...s.meta, onboarding: { seen: ['round_roll'], dismissed: false } } }, true);
    // Skip Title/intro: jump straight into a round.
    ff.dispatch({ type: 'NEW_RUN', constellationId: 'lyra' });
    ff.dispatch({ type: 'START_BLIND' });
    ff.dispatch({ type: 'ROLL_REQUESTED' });
  });
  await page.waitForTimeout(2000); // wait for dice settle so coachmark for lock fires

  await page.screenshot({ path: `${OUT_DIR}/desktop-coach-fix-lock.png`, clip: { x: 320, y: 200, width: 640, height: 400 } });
  console.log('  desktop-coach-fix-lock.png');

  // ---- SHOP TOOLTIP CLIP FIX ----
  // Dismiss onboarding so the shop coachmark doesn't sit over the offers.
  await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return;
    const s = ff.store.getState();
    ff.store.setState({ ...s, meta: { ...s.meta, onboarding: { seen: [], dismissed: true } } }, true);
    ff.dispatch({ type: 'OPEN_SHOP' });
  });
  await page.waitForTimeout(800);

  // Stick the first shop offer's tooltip — it's the wrapper that
  // contains a .panel-strong child and the .tip span as a sibling.
  const stuck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.has-tip')).filter((el) =>
      el.querySelector('.panel-strong'),
    );
    const card = cards[0];
    if (!card) return false;
    card.classList.add('tip-stuck');
    return true;
  });
  await page.waitForTimeout(200);
  if (stuck) {
    await page.screenshot({ path: `${OUT_DIR}/desktop-shop-tooltip-fix.png`, clip: { x: 100, y: 200, width: 480, height: 400 } });
    console.log('  desktop-shop-tooltip-fix.png');
  } else {
    console.log('  (no shop offer card found)');
  }

  await ctx.close();
  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
