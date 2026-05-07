// Manual smoke test of the AstralForge screen via Playwright. Walks:
//   Title → Astral Forge → screenshot → buy perk (debug-injected dust) → screenshot
//
// Run while `npm run dev` is up.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = 'http://localhost:5173/FortuneFallacy/';
const OUT_DIR = 'docs/audit-screenshots';

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  // Desktop viewport
  for (const [name, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['mobile', { width: 375, height: 667 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport, isMobile: name === 'mobile' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[pageerror ${name}] ${e.message.slice(0, 120)}`));

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Inject some Cosmic Dust via the dev-exposed store so we can demo the buy flow
    await page.evaluate(() => {
      const ff = (window as unknown as { __ff?: { store: { setState: (next: unknown, replace: boolean) => void; getState: () => unknown } } }).__ff;
      if (ff) {
        const state = ff.store.getState() as { meta: { cosmicDust: number; cosmicDustLifetime: number } };
        ff.store.setState({ ...state, meta: { ...state.meta, cosmicDust: 200, cosmicDustLifetime: 200 } }, true);
      }
    });

    // Click "Astral Forge" button
    await page.getByText('Astral Forge', { exact: false }).first().click({ delay: 50 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT_DIR}/${name}-astral-forge.png` });
    console.log(`  ${name}-astral-forge.png`);

    // Buy first perk (Morning Star)
    await page.getByText('Morning Star', { exact: false }).first().click({ delay: 50 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/${name}-astral-forge-after-buy.png` });
    console.log(`  ${name}-astral-forge-after-buy.png`);

    await ctx.close();
  }

  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
