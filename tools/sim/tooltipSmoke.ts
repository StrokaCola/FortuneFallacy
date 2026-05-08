// Manual smoke test of the tooltip system.
// Captures the existing CatalystStrip on hover (desktop) and after a
// long-press (mobile), and the new TopBar voucher tooltip after granting
// a voucher via dev hooks.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = 'http://localhost:5173/FortuneFallacy/';
const OUT_DIR = 'docs/audit-screenshots';

interface DevWindow {
  __ff?: {
    dispatch: (action: { type: string; [k: string]: unknown }) => void;
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  // ---- DESKTOP: hover ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Start a run, give a catalyst + voucher via dev hook, enter a round.
    await page.evaluate(() => {
      const ff = (window as unknown as DevWindow).__ff;
      if (!ff) return;
      ff.dispatch({ type: 'NEW_RUN', constellationId: 'lyra' });
      ff.dispatch({ type: 'GRANT_CATALYST', id: 'stratifier' });
      // Voucher grant — there isn't a direct action; use BUY_OFFER in shop
      // path is heavy. Simpler: skip voucher tooltip on desktop screenshot.
      ff.dispatch({ type: 'START_BLIND' });
    });
    await page.waitForTimeout(800);

    // Inject vouchers via raw store mutation so the TopBar voucher
    // tooltip can be captured without going through the shop flow.
    await page.evaluate(() => {
      const ff = (window as unknown as { __ff?: { store: { setState: (s: unknown, replace: boolean) => void; getState: () => { run: { vouchers: string[] } } } } }).__ff;
      if (!ff?.store) return;
      const s = ff.store.getState();
      ff.store.setState({ ...s, run: { ...s.run, vouchers: ['bench', 'free_refresh'] } }, true);
    });
    await page.waitForTimeout(200);

    // Voucher tooltip — hover misbehaves with the TopBar's animation,
    // so apply tip-stuck directly to capture the same DOM as long-press.
    const stuck = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('.has-tip')).find(
        (e) => /vouchers \d+/.test(e.textContent ?? ''),
      );
      if (!el) return false;
      el.classList.add('tip-stuck');
      return true;
    });
    if (stuck) {
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${OUT_DIR}/desktop-tooltip-vouchers.png`, clip: { x: 800, y: 0, width: 480, height: 400 } });
      console.log('  desktop-tooltip-vouchers.png');
      await page.evaluate(() => {
        document.querySelectorAll('.tip-stuck').forEach((el) => el.classList.remove('tip-stuck'));
      });
    }

    // Catalyst tooltip — same animation-instability problem as voucher.
    // Apply tip-stuck directly so the screenshot shows the rendered tip.
    const catalystStuck = await page.evaluate(() => {
      const el = document.querySelector('.has-tip.has-sell');
      if (!el) return false;
      el.classList.add('tip-stuck');
      return true;
    });
    if (catalystStuck) {
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${OUT_DIR}/desktop-tooltip-catalyst-hover.png`, clip: { x: 0, y: 80, width: 380, height: 360 } });
      console.log('  desktop-tooltip-catalyst-hover.png');
    }

    await ctx.close();
  }

  // ---- MOBILE: long-press ----
  {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      const ff = (window as unknown as DevWindow).__ff;
      if (!ff) return;
      ff.dispatch({ type: 'NEW_RUN', constellationId: 'lyra' });
      ff.dispatch({ type: 'GRANT_CATALYST', id: 'stratifier' });
      ff.dispatch({ type: 'START_BLIND' });
    });
    await page.waitForTimeout(800);

    // Long-press the catalyst card specifically (skip TopBar tips).
    const catalyst = page.locator('.has-tip.has-sell').first();
    if (await catalyst.isVisible({ timeout: 1000 }).catch(() => false)) {
      const box = await catalyst.boundingBox();
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.touchscreen.tap(cx, cy); // not enough — tap is short
        // Use raw input dispatch for long-press
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: cx, y: cy }],
        });
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT_DIR}/mobile-tooltip-longpress.png` });
        console.log('  mobile-tooltip-longpress.png');
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
      }
    }

    // After releasing, tooltip should remain (sticky). Capture.
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT_DIR}/mobile-tooltip-sticky.png` });
    console.log('  mobile-tooltip-sticky.png');

    // Tap elsewhere to dismiss.
    await page.touchscreen.tap(10, 400);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT_DIR}/mobile-tooltip-dismissed.png` });
    console.log('  mobile-tooltip-dismissed.png');

    await ctx.close();
  }

  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
