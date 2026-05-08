// Manual smoke test of the onboarding coachmarks via Playwright.
// Walks: Title → Begin Ascension → name entry → constellation → hub
//        (hub coachmark) → blind → round (round coachmark) → roll → lock coachmark
//        → ... → shop coachmark.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = 'http://localhost:5173/FortuneFallacy/';
const OUT_DIR = 'docs/audit-screenshots';

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  for (const [name, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['mobile', { width: 375, height: 667 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport, isMobile: name === 'mobile' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[pageerror ${name}] ${e.message.slice(0, 200)}`));

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Reset onboarding state via dev hook so this is reproducible.
    await page.evaluate(() => {
      const ff = (window as unknown as { __ff?: { store: { setState: (next: unknown, replace: boolean) => void; getState: () => unknown } } }).__ff;
      if (ff) {
        const state = ff.store.getState() as { meta: { onboarding: { seen: string[]; dismissed: boolean } } };
        ff.store.setState({ ...state, meta: { ...state.meta, onboarding: { seen: [], dismissed: false } } }, true);
      }
    });

    // Begin a new run (will land on Hub).
    await page.getByText('Begin Ascension', { exact: false }).first().click({ delay: 50 });
    await page.waitForTimeout(400);

    // Skip name entry if present
    const beginRunBtn = page.getByText(/^(begin|continue)/i).first();
    if (await beginRunBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Name entry — type a name and continue
      const input = page.locator('input').first();
      if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
        await input.fill('TUTOR');
      }
      await beginRunBtn.click({ delay: 50 });
      await page.waitForTimeout(400);
    }

    // Constellation select — click Lyra or first option
    const lyra = page.getByText(/lyra/i).first();
    if (await lyra.isVisible({ timeout: 1000 }).catch(() => false)) {
      await lyra.click({ delay: 50 });
      await page.waitForTimeout(300);
      // Confirm button (usually "begin" or similar)
      const confirm = page.getByText(/^(begin|start|confirm)/i).first();
      if (await confirm.isVisible({ timeout: 500 }).catch(() => false)) {
        await confirm.click({ delay: 50 });
      }
    }

    await page.waitForTimeout(1500);
    // Should be on Hub now → hub_blinds coachmark visible
    await page.screenshot({ path: `${OUT_DIR}/${name}-coach-hub.png` });
    console.log(`  ${name}-coach-hub.png`);

    // Dismiss hub coachmark via "Got it"
    const gotIt = page.getByText('Got it', { exact: true }).first();
    if (await gotIt.isVisible({ timeout: 1000 }).catch(() => false)) {
      await gotIt.click({ delay: 50 });
      await page.waitForTimeout(400);
    }

    // Click first blind to select it
    const firstBlind = page.locator('[data-coach="hub-blinds"] > div').first();
    if (await firstBlind.isVisible({ timeout: 1000 }).catch(() => false)) {
      await firstBlind.click({ delay: 50 });
      await page.waitForTimeout(400);
    }
    // Then click BEGIN to actually enter the round
    const beginBtn = page.getByText(/^BEGIN$/i).first();
    if (await beginBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await beginBtn.click({ delay: 50 });
      await page.waitForTimeout(1000);
    }

    // Should be on Round → round_roll coachmark visible
    await page.screenshot({ path: `${OUT_DIR}/${name}-coach-round.png` });
    console.log(`  ${name}-coach-round.png`);

    // Dismiss
    const gotIt2 = page.getByText('Got it', { exact: true }).first();
    if (await gotIt2.isVisible({ timeout: 1000 }).catch(() => false)) {
      await gotIt2.click({ delay: 50 });
      await page.waitForTimeout(400);
    }

    // Click roll button
    const rollBtn = page.locator('[data-coach="roll-btn"]').first();
    if (await rollBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await rollBtn.click({ delay: 50 });
      await page.waitForTimeout(2200); // wait for dice settle
    }

    // Should now show round_lock coachmark
    await page.screenshot({ path: `${OUT_DIR}/${name}-coach-lock.png` });
    console.log(`  ${name}-coach-lock.png`);

    // Skip-tutorial test on mobile only (variety)
    if (name === 'mobile') {
      const skip = page.getByText('Skip tutorial', { exact: false }).first();
      if (await skip.isVisible({ timeout: 1000 }).catch(() => false)) {
        await skip.click({ delay: 50 });
        await page.waitForTimeout(400);
        // After skipping, no coachmark should be visible.
        await page.screenshot({ path: `${OUT_DIR}/${name}-coach-after-skip.png` });
        console.log(`  ${name}-coach-after-skip.png`);
      }
    }

    await ctx.close();
  }

  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
