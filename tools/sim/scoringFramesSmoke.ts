// Capture mid-scoring frames to validate UX issues before changing anything.
// Plays a hand with a target the score will dramatically beat, takes 6
// frames during the scoring sequence (every ~700ms), so we can see what
// the player actually sees at each beat.

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

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await page.click('body');
  await page.waitForTimeout(150);

  // Set up a stacked run so the scoring sequence has lots of mults to slam.
  await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return;
    const s = ff.store.getState();
    ff.store.setState({ ...s, meta: { ...s.meta, onboarding: { seen: [], dismissed: true } } }, true);
    ff.dispatch({ type: 'NEW_RUN', constellationId: 'lyra' });
    ff.dispatch({ type: 'GRANT_CATALYST', id: 'stratifier' });
    ff.dispatch({ type: 'GRANT_CATALYST', id: 'crescendo_run' });
    ff.dispatch({ type: 'GRANT_CATALYST', id: 'compounding_bias' });
    ff.dispatch({ type: 'START_BLIND' });
    ff.dispatch({ type: 'ROLL_REQUESTED' });
  });
  await page.waitForTimeout(2200); // dice settle + state coherent

  // Lock all 5 dice so the natural roll is fully scored. Without locks,
  // the scoring sequence still runs but produces a near-zero combo.
  await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return;
    for (let i = 0; i < 5; i++) {
      ff.dispatch({ type: 'TOGGLE_LOCK', dieIdx: i });
    }
  });
  await page.waitForTimeout(150);

  // Diagnostic: inspect round state before scoring.
  const before = await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return null;
    const r = ff.store.getState().round;
    return {
      handsLeft: (r as unknown as { handsLeft: number }).handsLeft,
      firstRollDone: (r as unknown as { firstRollDone: boolean }).firstRollDone,
      handInProgress: (r as unknown as { handInProgress: boolean }).handInProgress,
      scoring: (r as unknown as { scoring: boolean }).scoring,
      diceFaces: r.dice.map((d) => d.face),
      lockedCount: r.dice.filter((d) => d.locked).length,
    };
  });
  console.log('  before SCORE_HAND:', JSON.stringify(before));

  await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return;
    ff.dispatch({ type: 'SCORE_HAND' });
  });
  await page.waitForTimeout(150);

  const after = await page.evaluate(() => {
    const ff = (window as unknown as DevWindow).__ff;
    if (!ff) return null;
    const r = ff.store.getState().round;
    return {
      score: (r as unknown as { score: number }).score,
      handsLeft: (r as unknown as { handsLeft: number }).handsLeft,
      handInProgress: (r as unknown as { handInProgress: boolean }).handInProgress,
      scoring: (r as unknown as { scoring: boolean }).scoring,
    };
  });
  console.log('  after SCORE_HAND:', JSON.stringify(after));

  // Tighter cadence — the natural Two Pair / similar combos run ~2-3s
  // total, so frames spaced 350ms catch each beat phase.
  const checkpoints = [
    { delay: 150,  name: 'before-scoring' },
    { delay: 500,  name: 'die-ticks-early' },
    { delay: 850,  name: 'die-ticks-late' },
    { delay: 1200, name: 'combo-bonus' },
    { delay: 1550, name: 'mult-slam' },
    { delay: 2000, name: 'boom' },
  ];
  let last = 0;
  for (const cp of checkpoints) {
    const wait = cp.delay - last;
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT_DIR}/scoring-${cp.name}.png` });
    console.log(`  scoring-${cp.name}.png  (t=${cp.delay}ms)`);
    last = cp.delay;
  }

  await ctx.close();
  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
