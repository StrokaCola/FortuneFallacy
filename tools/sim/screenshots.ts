// Capture screenshots of the running dev server at multiple viewports.
// Walks the golden path: Title → ConstellationSelect → Hub → Round → Shop.
//
// Usage:
//   (start dev: npm run dev)
//   npx tsx tools/sim/screenshots.ts

import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = 'http://localhost:5173/FortuneFallacy/';
const OUT_DIR = 'docs/audit-screenshots';

interface Viewport { name: string; width: number; height: number; mobile?: boolean; }
const VIEWPORTS: Viewport[] = [
  { name: 'iphone-se',         width: 375, height: 667, mobile: true },
  { name: 'iphone-14-pro',     width: 393, height: 852, mobile: true },
  { name: 'pixel-7',           width: 412, height: 915, mobile: true },
  { name: 'ipad-mini',         width: 768, height: 1024 },
  { name: 'laptop',            width: 1280, height: 800 },
  { name: 'desktop',           width: 1920, height: 1080 },
  { name: 'ultrawide',         width: 2560, height: 1080 },
  // Worst case: short Android landscape
  { name: 'android-landscape', width: 640, height: 360, mobile: true },
];

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: false });
  console.log(`  ${name}.png`);
}

async function clickIfPresent(page: Page, selector: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const el = await page.waitForSelector(selector, { timeout: timeoutMs, state: 'visible' });
    if (el) { await el.click({ delay: 50 }); return true; }
  } catch { /* not found */ }
  return false;
}

async function clickByText(page: Page, text: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const el = await page.getByText(text, { exact: false }).first();
    await el.waitFor({ state: 'visible', timeout: timeoutMs });
    await el.click({ delay: 50 });
    return true;
  } catch { return false; }
}

async function walkViewport(vp: Viewport): Promise<void> {
  console.log(`\n=== ${vp.name} ${vp.width}x${vp.height} ===`);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: !!vp.mobile,
    hasTouch: !!vp.mobile,
    userAgent: vp.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      : undefined,
  });
  const page = await context.newPage();
  // Suppress audio context errors / console noise
  page.on('pageerror', (e) => console.log(`    [pageerror] ${e.message.slice(0, 100)}`));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  // Allow init: localStorage hydration, audio gesture wait, Three.js ready
  await page.waitForTimeout(1500);
  // Clear any saved state by clicking through orientation gate if shown
  await capture(page, `${vp.name}-01-title`);

  // Skip past name entry / orientation gate if visible
  const inputs = await page.$$('input[type="text"]');
  if (inputs.length > 0) {
    try {
      await inputs[0]!.fill('TestPlayer');
      await page.waitForTimeout(200);
    } catch { /* ignore */ }
  }

  // Try common entry buttons
  await clickByText(page, 'Begin', 1500) ||
    await clickByText(page, 'Play', 1500) ||
    await clickByText(page, 'Start', 1500) ||
    await clickByText(page, 'Continue', 1500) ||
    await clickIfPresent(page, '[data-autofocus]', 1500) ||
    await clickIfPresent(page, 'button.btn-primary', 1500);
  await page.waitForTimeout(800);
  await capture(page, `${vp.name}-02-after-title-click`);

  // Try to reach Constellation Select
  await clickByText(page, 'New Run', 1000);
  await page.waitForTimeout(500);
  await capture(page, `${vp.name}-03-constellation-select`);

  // Pick first constellation
  const buttons = await page.$$('button');
  for (const b of buttons) {
    try {
      const text = (await b.textContent()) ?? '';
      if (/lyra|begin|start run|spark/i.test(text)) {
        await b.click({ delay: 50 });
        break;
      }
    } catch { /* skip */ }
  }
  await page.waitForTimeout(800);
  await capture(page, `${vp.name}-04-after-pick`);

  // Hub or Round
  await page.waitForTimeout(500);
  await capture(page, `${vp.name}-05-hub-or-round`);

  // Try clicking Start Blind / Roll
  await clickByText(page, 'Start', 800);
  await page.waitForTimeout(500);
  await clickByText(page, 'Roll', 800);
  await page.waitForTimeout(1500);
  await capture(page, `${vp.name}-06-round-after-roll`);

  // Open Pause menu to capture it
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await capture(page, `${vp.name}-07-pause-menu`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await context.close();
  await browser.close();
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const vp of VIEWPORTS) {
    try {
      await walkViewport(vp);
    } catch (e) {
      console.error(`  FAILED ${vp.name}: ${(e as Error).message}`);
    }
  }
  console.log(`\nAll screenshots in ${OUT_DIR}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
