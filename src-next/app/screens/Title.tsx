import { dispatch } from '../../actions/dispatch';
import { PortalGate } from '../portal/PortalGate';
import { useStore, store } from '../../state/store';
import type { GameState } from '../../state/store';
import { lookupConstellation } from '../../data/constellations';
import { useIsTightStage, useIsLandscapeTight } from '../hooks/useIsCompactStage';
import { getDailyChallenge } from '../../online/dailyChallenge';
import { lookupStake } from '../../data/stakes';
import { getTipOfTheDay } from '../../data/tips';
import { currentPrestigeTier } from '../../data/prestigeTiers';
import { FortuneFallacyWordmark } from '../visual/FortuneFallacyWordmark';

const selectCosmicDustLifetime = (s: GameState) => s.meta.cosmicDustLifetime ?? 0;

// Match PauseMenu's notion of "run in progress" — also count an active
// round (mid-hand) so a fresh-launch with `score === 0 && goalIdx === 0`
// but a hand already in flight still surfaces "Continue Run".
const selectHasRun = (s: GameState) =>
  s.run.goalIdx > 0 || s.round.score > 0 || s.run.catalysts.length > 0 || s.round.active;
// Each selector returns a primitive so useSyncExternalStore's Object.is
// comparison stays stable across renders. Returning an object literal here
// would create a fresh reference on every snapshot read and tear-loop.
const selectAnte = (s: GameState) => s.run.ante;
const selectGoalIdx = (s: GameState) => s.run.goalIdx;
const selectScore = (s: GameState) => s.round.score;
const selectConstellationId = (s: GameState) => s.run.constellationId;
const selectHighScores = (s: GameState) => s.meta.highScores;
const EMPTY_DAILY: GameState['meta']['dailyHistory'] = {};
const selectDailyHistory = (s: GameState) => s.meta.dailyHistory ?? EMPTY_DAILY;

export function Title() {
  const hasRun = useStore(selectHasRun);
  const ante = useStore(selectAnte);
  const goalIdx = useStore(selectGoalIdx);
  const score = useStore(selectScore);
  const constellationId = useStore(selectConstellationId);
  const highScores = useStore(selectHighScores);
  const dailyHistory = useStore(selectDailyHistory);
  const lifetimeDust = useStore(selectCosmicDustLifetime);
  const prestige = currentPrestigeTier(lifetimeDust);
  const tight = useIsTightStage();
  const landscapeTight = useIsLandscapeTight();

  // Today's daily challenge config. Computed render-side off the system
  // clock — cheap, deterministic, and refreshes on screen revisits so
  // a session that crosses UTC midnight picks up the new daily without a
  // page reload (the seed/constellation/stake change with the date).
  const daily = getDailyChallenge();
  const dailyConst = lookupConstellation(daily.constellationId);
  const dailyStake = lookupStake(daily.stakeId);
  const dailyAttempt = dailyHistory[daily.date];
  // Derived in render — the underlying array reference is stable, so this
  // recomputes only when highScores actually changes.
  const best = highScores.length === 0
    ? null
    : highScores.reduce((b, c) => (c.score > b.score ? c : b), highScores[0]!);
  // `score` is round score; surfaced in the run-summary line for parity with
  // the previous structured selector.
  void score;

  // Tight viewports (phone landscape, narrow phones) shrink everything
  // so the title screen fits without scrolling. The "Fortune Fallacy"
  // header drops from clamp(48px, 12vw, 96px) ≈ 96px on a 1170-wide
  // viewport down to clamp(28px, 6vw, 56px), cutting the two-word
  // stack in half. Buttons / margins / ornament shrink in lockstep.
  //
  // Wave V — title font now caps against viewport HEIGHT too, not just
  // width. On a 1280×800 desktop viewport the previous clamp landed at
  // 96px per word + 96px line-height for two stacked words = ~190px of
  // heading alone, which combined with the daily challenge card + 5
  // secondary nav buttons pushed total content to ~1030px and clipped
  // FORTUNE at the top + SETTINGS at the bottom under placeItems:center.
  // Adding a vh-aware ceiling (8vh = 64px on an 800-tall window) keeps
  // the wide-but-short desktop viewport from blowing out vertically.
  // 2026-05-18 desktop-no-scroll compression. `short` triggers below
  // ~800px viewport height — the desktop short-window case where the
  // full-rhythm layout (tagline + wordmark + 2 primary + daily +
  // 5-button secondary nav + Travel + version) would clip Travel and
  // half the secondary nav under the fold. `short` halves the margins
  // and shrinks the wordmark so everything stacks above the fold.
  const short = typeof window !== 'undefined' && window.innerHeight <= 800 && !tight;
  const titleFontSize = landscapeTight
    ? 'clamp(22px, 9vh, 38px)'
    : tight
      ? 'clamp(28px, 6vw, 56px)'
      : short
        ? 'min(clamp(34px, 7vw, 60px), 7vh)'
        : 'min(clamp(44px, 10vw, 84px), 9vh)';
  const taglineMarginBottom = tight ? 12 : short ? 8 : 18;
  const ornamentMargin = tight ? '16px auto 0' : short ? '10px auto 0' : '24px auto 0';
  const ornamentW = tight ? 160 : short ? 180 : 220;
  const ornamentH = tight ? 40 : short ? 42 : 50;
  const buttonsMarginTop = tight ? 14 : short ? 8 : 24;
  const buttonsGap = tight ? 8 : short ? 4 : 10;
  const primaryBtnWidth = tight ? 180 : 240;
  // 2026-05-16 mobile polish — drop the ghost button width on very-narrow
  // viewports so the 5-button secondary nav grid fits in a 320px-wide
  // window (iPhone SE / older small phones). Falls back to 160 on
  // standard tight (480px phone) and 200 on desktop.
  const ultraNarrow = typeof window !== 'undefined' && window.innerWidth < 400;
  const ghostBtnWidth = ultraNarrow ? 132 : tight ? 160 : short ? 170 : 200;
  const portalSize = tight ? 48 : short ? 44 : 60;
  const portalMarginTop = tight ? 8 : short ? 6 : 14;
  const versionMarginTop = tight ? 18 : short ? 10 : 36;
  // Wave V — drop the multi-line Tip-of-the-Day on shorter desktop
  // viewports (≤900 tall) so the Begin/Continue/Daily/secondary nav
  // stack fits above the fold without scrolling. Phones already hide
  // it via the tight branch's compressed rhythm.
  const showTip = tight ? true : typeof window !== 'undefined' ? window.innerHeight > 900 : true;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'grid', placeItems: 'center',
      textAlign: 'center', pointerEvents: 'auto',
      // 2026-05-18 desktop-no-scroll: all viewports lock vertical
      // scroll at the screen root. Tip-of-the-day already hides on
      // ≤900 height; menu rhythm shrinks via `tight` branches. Any
      // overflow that remains is intentionally clipped rather than
      // surfaced as a scrollbar.
      overflowY: 'hidden',
      overflowX: 'hidden',
      padding: tight ? 8 : 16,
    }}>
      <div>
        <div className="f-mono uc" style={{
          fontSize: tight ? 9 : 11,
          color: '#7be3ff',
          letterSpacing: tight ? '0.45em' : '0.6em',
          marginBottom: taglineMarginBottom,
          opacity: 0,
          animation: 'titleStutter 1.4s steps(20, end) 200ms forwards',
          overflow: 'hidden', whiteSpace: 'nowrap', display: 'inline-block',
        }}>
          ◇ the gambler's fallacy, weaponized ◇
        </div>
        {/* 2026-05-17 — Custom Fortune Fallacy wordmark replaces the
            previous Cinzel-text + constellation-polyline lockup. The
            wordmark composites brass-gradient Cinzel Decorative 900
            letterforms over an aurora-violet backlight wash, with the
            5-star Cassiopeia asterism above + gold hairline + tagline
            below. See public/brand/wordmark-brief.html for the source
            design and src-next/app/visual/FortuneFallacyWordmark.tsx
            for the React render. The container caps the wordmark's
            width so the lockup scales with viewport while keeping
            its internal proportions baked-in. */}
        <div style={{
          width: tight
            ? 'min(420px, 92vw)'
            : short
              ? 'min(460px, 48vw)'
              : 'min(640px, 70vw)',
          margin: '0 auto',
          opacity: 0,
          animation: 'fadein 1100ms ease-out 300ms forwards',
        }}>
          <FortuneFallacyWordmark />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: buttonsGap, marginTop: buttonsMarginTop, alignItems: 'center' }}>
          <button
            className="btn btn-primary mat-interactive tap"
            style={{ width: primaryBtnWidth }}
            onClick={() => {
              if (hasRun) {
                const ok = window.confirm(
                  'A run is in progress. Starting a new ascension will overwrite it. Continue?',
                );
                if (!ok) return;
              }
              dispatch({ type: 'SET_SCREEN', screen: 'nameentry' });
            }}>
            Begin Ascension
          </button>
          {hasRun && (
            <>
              <button
                className="btn btn-ghost tap"
                style={{ width: primaryBtnWidth }}
                onClick={() => {
                  // If we paused mid-round and bailed to title, resume the
                  // game state back to playing. Toggle pause off via the
                  // store so the round resumes naturally on hub-screen.
                  if (store.getState().ui.paused) dispatch({ type: 'TOGGLE_PAUSE' });
                  dispatch({ type: 'SET_SCREEN', screen: 'hub' });
                }}>
                Continue Run
              </button>
              <div className="f-mono uc" style={{
                fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff', marginTop: -4,
              }}>
                ante {ante} · blind {(goalIdx % 3) + 1} · {lookupConstellation(constellationId).name}
              </div>
            </>
          )}
          {!hasRun && best && (
            <div className="f-mono uc" style={{
              fontSize: 9, letterSpacing: '0.32em', color: '#f5c451', marginTop: -2,
              textShadow: '0 0 10px rgba(245,196,81,0.35)',
            }}>
              best ◆ {best.score.toLocaleString()} · {best.name}
            </div>
          )}

          {/* Daily Challenge: same seed + constellation + stake for every
              player on the same UTC day. Astral perks are skipped so the
              leaderboard stays fair. The card shows today's config and the
              player's best for the day if they've already attempted it. */}
          <button
            className="btn btn-ghost mat-interactive tap"
            style={{
              width: primaryBtnWidth,
              padding: tight ? '8px 12px' : '8px 14px',
              borderColor: 'rgba(245,196,81,0.55)',
              boxShadow: '0 0 18px rgba(245,196,81,0.18)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            }}
            onClick={() => {
              if (hasRun) {
                const ok = window.confirm(
                  'A run is in progress. Starting today\'s daily will overwrite it. Continue?',
                );
                if (!ok) return;
              }
              dispatch({ type: 'NEW_RUN', daily: true });
            }}>
            <div className="f-mono uc" style={{
              fontSize: 9, letterSpacing: '0.32em', color: '#f5c451',
            }}>
              ★ daily challenge · {daily.date}
            </div>
            <div className="f-mono" style={{
              fontSize: 11, color: '#f3f0ff', letterSpacing: '0.04em',
            }}>
              {dailyConst.name} · {dailyStake.name}
            </div>
            {dailyAttempt && (
              <div className="f-mono" style={{
                fontSize: 9, color: dailyAttempt.cleared ? '#7be3ff' : '#bba8ff',
                letterSpacing: '0.18em',
              }}>
                {dailyAttempt.cleared ? '✓ cleared · ' : 'best · '}
                {dailyAttempt.score.toLocaleString()}
              </div>
            )}
          </button>
          {/* Wave Q — secondary nav reflows into a 2-column grid even on
              desktop. Previously stacked vertically into 5 rows, which
              read as listy and pushed Tip of the Day below the fold on
              shorter viewports. Tight viewports stay row-wrap so 3 or
              4-column layouts emerge naturally on phone landscape. */}
          <div style={{
            display: tight ? 'flex' : 'grid',
            flexDirection: tight ? 'row' : undefined,
            flexWrap: tight ? 'wrap' : undefined,
            gridTemplateColumns: tight ? undefined : `repeat(2, ${ghostBtnWidth}px)`,
            gap: buttonsGap,
            justifyContent: 'center',
            justifyItems: tight ? undefined : 'center',
            maxWidth: tight ? (ultraNarrow ? 280 : 360) : undefined,
          }}>
            <button
              className="btn btn-ghost tap"
              style={{ width: ghostBtnWidth, padding: tight ? undefined : '8px 14px', fontSize: tight ? undefined : 12 }}
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'codex' })}>
              Codex
            </button>
            <button
              className="btn btn-ghost tap"
              style={{ width: ghostBtnWidth, padding: tight ? undefined : '8px 14px', fontSize: tight ? undefined : 12 }}
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'astral_forge' })}>
              Astral Forge
            </button>
            <button
              className="btn btn-ghost tap"
              style={{ width: ghostBtnWidth, padding: tight ? undefined : '8px 14px', fontSize: tight ? undefined : 12 }}
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'challenges' })}>
              Challenges
            </button>
            <button
              className="btn btn-ghost tap"
              style={{ width: ghostBtnWidth, padding: tight ? undefined : '8px 14px', fontSize: tight ? undefined : 12 }}
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'scores' })}>
              Records
            </button>
            <button
              className="btn btn-ghost tap"
              style={{ width: ghostBtnWidth, padding: tight ? undefined : '8px 14px', fontSize: tight ? undefined : 12 }}
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'settings' })}>
              Settings
            </button>
          </div>
          {/* Decorative portal gate is hidden on tight viewports and on
              short desktop windows (≤800px height) — the secondary nav
              already covers every destination, and Travel is reachable
              from Hub/Pause anyway. */}
          {!tight && !short && (
            <div style={{ marginTop: portalMarginTop }}>
              <PortalGate size={portalSize} label="Travel" />
            </div>
          )}
        </div>

        {/* Tip of the Day — deterministic per UTC date so the same tip
            shows for every player on a given day. Nudges new players
            toward systems they may not have discovered yet (mods,
            voidstorms, resonances, easter eggs); experienced players
            get a low-stakes inspirational sentence. See data/tips.ts. */}
        {showTip && (
          <div className="f-mono" style={{
            fontSize: 10, color: '#bba8ff', opacity: 0.55,
            marginTop: 14, maxWidth: 'min(420px, 88vw)',
            textAlign: 'center', lineHeight: 1.6, fontStyle: 'italic',
          }}>
            ◇ {getTipOfTheDay()}
          </div>
        )}

        {/* Prestige chip — only renders for players who have earned
            past Wanderer. Sits between the Tip of the Day and the
            version stamp so returning players see their tier without
            having to open the Hub. The footer's empty zone was unused
            real estate; this anchors the player's identity at a glance. */}
        {prestige.id !== 'wanderer' && (
          <div className="f-mono uc" style={{
            marginTop: tight ? 12 : 28,
            fontSize: 10, letterSpacing: '0.28em',
            color: prestige.color, opacity: 0.85,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 12px', borderRadius: 999,
            border: `1px solid ${prestige.color}55`,
            background: `${prestige.color}10`,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700,
              textShadow: `0 0 8px ${prestige.color}88` }}>{prestige.glyph}</span>
            <span>stargazer · {prestige.name}</span>
            <span style={{ color: '#9577ff' }}>·</span>
            <span style={{ color: '#bba8ff' }}>{lifetimeDust.toLocaleString()} dust</span>
          </div>
        )}
        <div className="f-mono uc" style={{
          fontSize: 9, letterSpacing: '0.3em', color: '#9577ff',
          marginTop: prestige.id !== 'wanderer' ? 8 : versionMarginTop,
          opacity: 0.7,
        }}>
          v 0.42 · seed ⟨LYRA-VII⟩
        </div>
      </div>
    </div>
  );
}
