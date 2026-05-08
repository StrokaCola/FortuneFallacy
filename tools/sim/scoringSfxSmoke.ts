// Headless audio sanity check. Plays through a scoring sequence and
// confirms no Tone.js errors / synth bank exceptions show up in the
// console. Can't capture audio waveform from a headless browser, but
// the synth definitions are exercised so triggerAttackRelease misuses
// throw immediately.

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173/FortuneFallacy/';

interface DevWindow {
  __ff?: {
    dispatch: (a: { type: string; [k: string]: unknown }) => void;
    store: {
      setState: (s: unknown, replace: boolean) => void;
      getState: () => { meta: { onboarding: { seen: string[]; dismissed: boolean } } };
    };
  };
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Network/cert noise from font CDNs is unrelated to audio.
    if (/CERT_|net::ERR_|Failed to load resource/.test(text)) return;
    errors.push(`console.error: ${text}`);
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Force-start a run and play a hand programmatically. Audio context
  // typically requires a user gesture — clicking anything counts.
  await page.click('body');
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return;
    const s = ff.store.getState();
    ff.store.setState({ ...s, meta: { ...s.meta, onboarding: { seen: [], dismissed: true } } }, true);
    ff.dispatch({ type: 'NEW_RUN', constellationId: 'lyra' });
    // Stack 4 catalysts so the mult chain has multiple slams to exercise
    // the new accelerando + beefed multSlam.
    ff.dispatch({ type: 'GRANT_CATALYST', id: 'stratifier' });
    ff.dispatch({ type: 'GRANT_CATALYST', id: 'crescendo_run' });
    ff.dispatch({ type: 'GRANT_CATALYST', id: 'compounding_bias' });
    ff.dispatch({ type: 'START_BLIND' });
    ff.dispatch({ type: 'ROLL_REQUESTED' });
  });
  await page.waitForTimeout(2500); // wait for roll settle

  // Play a hand — triggers the full scoring sequence (cast-swell, die-ticks,
  // combo-bonus, mult-slams, hold-breath, boom). All of these route to the
  // modified voices.
  await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return;
    ff.dispatch({ type: 'SCORE_HAND' });
  });
  await page.waitForTimeout(6000); // full scoring sequence is 3-6s

  await ctx.close();
  await browser.close();

  if (errors.length === 0) {
    console.log('OK — no audio errors during scoring sequence.');
  } else {
    console.log(`FOUND ${errors.length} error(s):`);
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
