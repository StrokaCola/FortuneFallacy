import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { PortalGate } from '../portal/PortalGate';
import { TopBar } from '../hud/TopBar';
import { PauseButton } from '../hud/PauseButton';
import { encodeSeed } from '../../core/seed/rng';
import { TrialModifierChip } from '../hud/TrialModifierChip';
import { OrnateFrame } from '../visual/OrnateFrame';
import { TierSigil } from '../visual/TierSigil';
import { currentPrestigeTier, nextPrestigeTier } from '../../data/prestigeTiers';
import { getVoidstormForBlind } from '../../core/round/voidstorms';
import { getEventForBlind, lookupEvent } from '../../data/events';
import {
  selectAnte, selectGoalIdx, selectShards, selectCatalysts, selectMaxCatalystSlots, selectVouchers, selectScore, selectTarget,
  selectEffectiveCatalystSlotsUsed,
} from '../../state/selectors';
import { BLIND_DEFS, TIER_SIGILS, targetForBlind } from '../../data/blinds';
import { lookupConstellation } from '../../data/constellations';
import { describeDiceSpec } from '../../data/dice';
import { isForgeDisabled } from '../../core/run/diceContext';
import { stakeContext } from '../../core/run/stakeContext';
import { useIsCompactStage, useIsTightStage } from '../hooks/useIsCompactStage';
import { ActionBar } from '../hud/ActionBar';

const selectConstellationId = (s: GameState) => s.run.constellationId;
const selectForgeDisabled = (s: GameState) => isForgeDisabled(s) || stakeContext(s).forgeDisabled;
const selectCosmicDustLifetime = (s: GameState) => s.meta.cosmicDustLifetime ?? 0;
const selectSeed = (s: GameState) => s.run.seed;
const selectGoalIdxRaw = (s: GameState) => s.run.goalIdx;

const selectHandsLeft = (s: GameState) => s.round.handsLeft;
const selectRerollsLeft = (s: GameState) => s.round.rerollsLeft;

const CARD_W = 240;
const CARD_GAP = 26;

export function Hub() {
  const ante     = useStore(selectAnte);
  const goalIdx  = useStore(selectGoalIdx);
  const shards   = useStore(selectShards);
  const catalysts = useStore(selectCatalysts);
  const maxCatalysts = useStore(selectMaxCatalystSlots);
  const usedCatalystSlots = useStore(selectEffectiveCatalystSlotsUsed);
  const vouchers = useStore(selectVouchers);
  const handsLeft = useStore(selectHandsLeft);
  const rerollsLeft = useStore(selectRerollsLeft);
  const score    = useStore(selectScore);
  const target   = useStore(selectTarget);
  const constellationId = useStore(selectConstellationId);
  const constellation = lookupConstellation(constellationId);
  const forgeDisabled = useStore(selectForgeDisabled);
  const lifetimeDust = useStore(selectCosmicDustLifetime);
  const seed = useStore(selectSeed);
  const goalIdxRaw = useStore(selectGoalIdxRaw);
  // Upcoming boss id — locked in by NEW_RUN / the previous clearBlind so
  // the player can read the curse on the hub before clicking Begin.
  // Falls back to null on legacy saves; TrialModifierChip degrades to
  // the generic "boss rule applies" copy when the id isn't known.
  const upcomingBossId = useStore((s: GameState) => s.run.upcomingBossId ?? null);
  // Seed visibility — hidden during play for `random` runs (revealed
  // in postmortem), shown for `player` (explicitly entered) and
  // `daily` (player knows they're on a daily challenge).
  const seedSource = useStore((s: GameState) => s.run.seedSource ?? 'random');
  const runSeed = useStore(selectSeed);
  const showSeedChip = seedSource !== 'random';
  const prestige = currentPrestigeTier(lifetimeDust);
  const next = nextPrestigeTier(lifetimeDust);
  const compact = useIsCompactStage();
  const tight = useIsTightStage();

  const accent = '#7be3ff';
  const blindIdx = goalIdx % 3;

  // Deterministic voidstorm derivation per trial slot. `floor(goalIdxRaw/3)*3 + i`
  // walks back to the start of the current ante (rounded down) and picks
  // the goalIdx that would be active when slot `i` runs. The same
  // (seed, goalIdx) call in `transitions.startBlind` returns the same
  // ID, so the chip on the Hub always matches the storm that fires.
  const anteStartGoalIdx = Math.floor(goalIdxRaw / 3) * 3;
  const blinds = BLIND_DEFS.map((def, i) => {
    const slotGoalIdx = anteStartGoalIdx + i;
    const eventId = getEventForBlind(seed, slotGoalIdx, ante, def.isBoss);
    return {
      def,
      cleared: i < blindIdx,
      current: i === blindIdx,
      locked: i > blindIdx,
      target: targetForBlind(ante, i),
      tierColor: TIER_SIGILS[i]?.color ?? '#9577ff',
      reward: def.isBoss ? 8 : 5,
      mult: def.targetMult,
      voidstormId: eventId ? null : getVoidstormForBlind(seed, slotGoalIdx, def.isBoss),
      eventId,
    };
  });

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'auto',
      // Tight viewports allow scroll as a safety net — the layout below
      // shrinks aggressively, but the Begin button must always be
      // reachable even on the shortest phone landscape browsers.
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      <TopBar
        ante={ante}
        blind="Hub"
        shards={shards}
        hands={handsLeft}
        rerolls={rerollsLeft}
        target={target}
        score={score}
        catalystSlots={{ used: usedCatalystSlots, max: maxCatalysts }}
        voucherCount={vouchers.length}
        vouchers={vouchers}
        accent={accent}
      />
      <PauseButton />

      {/* Tier 2: flex column instead of absolute pixel offsets, so the
          trial cards stay on-screen at any viewport size (including
          short landscape phones where top:360 would push them under).
          paddingTop clamps with viewport height so on a ~440px-tall
          phone landscape the cards still appear above the fold. */}
      <div style={{
        minHeight: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: tight ? 8 : 20,
        // Pad past the TopBar at every size; on tight, hug it close so
        // the cards still fit. Falls back to the original clamp if the
        // CSS var isn't set yet.
        paddingTop: tight
          ? 'calc(var(--hud-top-h, 96px) + 8px)'
          : 'clamp(96px, 22vh, 170px)',
        paddingBottom: tight ? 12 : 28, paddingInline: tight ? 12 : 20,
        textAlign: 'center',
      }}>
        {/* Decorative copy is dropped on tight viewports — landscape
            phones can't fit it alongside the trial cards and action row. */}
        {!tight && (
          <>
            <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
              ◇ choose your trial ◇
            </div>
            <div className="f-display" style={{ fontSize: 'clamp(24px, 5vw, 36px)', color: '#f3f0ff', marginTop: 4 }}>
              Tribunal of Stars
            </div>
            <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: 13, color: '#bba8ff', marginTop: -4, maxWidth: 460 }}>
              Three trials bar your ascension. Clear them for shards and admittance to the Bazaar.
            </div>
          </>
        )}
        <div className="f-mono uc" style={{
          fontSize: compact ? 12 : 9,
          letterSpacing: compact ? '0.18em' : '0.28em',
          color: '#f5c451',
        }}>
          ✦ {constellation.name} · {describeDiceSpec(constellation.dice)}
        </div>

        {/* Seeded-run chip — visible only when the player explicitly
            entered a seed or is on a daily challenge. Random runs
            keep the seed hidden until postmortem so each fresh run
            still has the "what'll show up?" beat intact. */}
        {showSeedChip && (
          <div className="f-mono has-tip" style={{
            marginTop: 4,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '2px 10px', borderRadius: 999,
            border: `1px solid ${seedSource === 'daily' ? 'rgba(245,196,81,0.45)' : 'rgba(123,227,255,0.4)'}`,
            background: 'rgba(15,9,37,0.6)',
            fontSize: 10, letterSpacing: '0.14em',
            color: seedSource === 'daily' ? '#f5c451' : '#7be3ff',
            position: 'relative',
          }}>
            <span style={{ opacity: 0.7 }}>
              {seedSource === 'daily' ? '★ daily' : '◆ seed'}
            </span>
            <span style={{ color: '#f3f0ff', letterSpacing: '0.18em' }}>
              {encodeSeed(runSeed)}
            </span>
            <span className="tip">
              <span className="tip-title">
                {seedSource === 'daily' ? 'Daily Challenge Seed' : 'Seeded Run'}
              </span>
              {seedSource === 'daily'
                ? 'Today\'s daily uses this seed for all players. Score is partitioned to the daily leaderboard.'
                : 'You started this run from an explicit seed. Every boss, shop offer, and edition flows from it — share the code to let someone replay the exact run.'}
            </span>
          </div>
        )}

        {/* Prestige badge — derived from meta.cosmicDustLifetime. Surfaces
            the player's lifetime ascension tier and the gap to the next.
            Wanderer tier (everyone's starting state) renders muted so it
            doesn't draw the eye for new players. */}
        {!tight && (
          <div className="f-mono uc has-tip" style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px', borderRadius: 999,
            border: `1px solid ${prestige.color}66`,
            background: `${prestige.color}14`,
            fontSize: 9, letterSpacing: '0.32em',
            color: prestige.color,
            cursor: 'help',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              textShadow: prestige.id === 'wanderer'
                ? undefined
                : `0 0 8px ${prestige.color}88`,
            }}>{prestige.glyph}</span>
            <span>stargazer · {prestige.name}</span>
            <span className="tip">
              <span className="tip-title">Stargazer Tier · {prestige.name}</span>
              Lifetime Cosmic Dust: {lifetimeDust.toLocaleString()}.
              {next ? (
                <span style={{ display: 'block', marginTop: 4, color: next.tier.color }}>
                  ▸ {next.gap.toLocaleString()} more dust to {next.tier.name}.
                </span>
              ) : (
                <span style={{ display: 'block', marginTop: 4, color: '#ff7847' }}>
                  ▸ Highest tier reached. The cosmos has no further to climb.
                </span>
              )}
            </span>
          </div>
        )}
        {/* Tight viewports: prestige badge becomes a tiny absolutely-
            positioned corner chip in the bottom-left so the player
            doesn't lose tier visibility on landscape phones. Hides for
            Wanderer tier to keep the corner clean for new players. */}
        {tight && prestige.id !== 'wanderer' && (
          <div className="f-mono uc has-tip" style={{
            position: 'fixed', bottom: 8, left: 8,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 999,
            border: `1px solid ${prestige.color}66`,
            background: 'rgba(7,5,26,0.7)',
            fontSize: 8.5, letterSpacing: '0.22em',
            color: prestige.color,
            cursor: 'help',
            zIndex: 6,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700,
              textShadow: `0 0 6px ${prestige.color}88` }}>{prestige.glyph}</span>
            <span>{prestige.name}</span>
            <span className="tip tip-above">
              <span className="tip-title">Stargazer · {prestige.name}</span>
              Lifetime Cosmic Dust: {lifetimeDust.toLocaleString()}.
              {next && (
                <span style={{ display: 'block', marginTop: 4, color: next.tier.color }}>
                  ▸ {next.gap.toLocaleString()} more dust to {next.tier.name}.
                </span>
              )}
            </span>
          </div>
        )}

        {/* The constellation thread is 3×240+2×26=772px wide and never
            fits on a 640px landscape phone — drop it on tight. */}
        {!tight && <ConstellationThread blinds={blinds} accent={accent} />}

        <div data-coach="hub-blinds" style={{
          display: 'flex',
          gap: tight ? 8 : CARD_GAP,
          flexWrap: 'wrap', justifyContent: 'center',
          maxWidth: '100%',
        }}>
          {blinds.map((b, i) => {
          const isBoss = b.def.isBoss;
          const cur = b.current;
          const cleared = b.cleared;
          const locked = b.locked;
          // Event slot (Pillar C) — non-cleared, non-locked, has an
          // event id from the deterministic helper. Renders the slot
          // with the event's name + glyph and routes Begin to the
          // EventScreen instead of starting a blind.
          const eventDef = !cleared && !locked && b.eventId ? lookupEvent(b.eventId) : undefined;
          const hasEvent = !!eventDef;
          const eventAccent = '#cc88ff';
          const frameColor = cur
            ? (hasEvent ? eventAccent : accent)
            : isBoss ? 'rgba(226,51,74,0.6)' : 'rgba(245,196,81,0.4)';
          return (
            <div
              key={i}
              className="panel-strong has-tip"
              style={{
                // Tight: shrink width so 3 cards fit a 640px landscape
                // phone (3*180 + 2*8 = 556 < 640). Wider viewports cap
                // at 240px design size but ALSO never reach past the
                // viewport-minus-padding on portrait phones — on a
                // 320px phone the bare 240px card used to overflow the
                // 296px content column.
                width: tight ? 'clamp(140px, 28vw, 180px)' : `min(${CARD_W}px, calc(100vw - 40px))`,
                // Card height clamps with viewport so on short landscape
                // phones the three trial cards plus action bar all fit
                // *and* the inline Begin button stays inside the card.
                // 180 px max (vs 200 previously) gives 36 CSS more room
                // for the action bar + URL bar overhead.
                height: tight ? 'clamp(140px, 45vh, 180px)' : 'clamp(240px, 50vh, 320px)',
                padding: tight ? 12 : 20, position: 'relative',
                border: cur ? `2px solid ${accent}` : (isBoss ? '1px solid rgba(226,51,74,0.5)' : '1px solid rgba(149,119,255,0.3)'),
                boxShadow: cur ? `0 0 30px ${accent}55` : (isBoss ? '0 0 24px rgba(226,51,74,0.3)' : '0 8px 24px rgba(0,0,0,0.4)'),
                opacity: cleared ? 0.55 : locked ? 0.78 : 1,
                filter: locked ? 'saturate(0.5)' : undefined,
                // Current event slot gets a subtle violet wash so the
                // "a choice waits" trial visually separates from the
                // regular tier-sigil cards next to it. The frame still
                // uses eventAccent; the background gives the card a
                // distinct presence without screaming.
                background: cur && hasEvent
                  ? `linear-gradient(180deg, ${eventAccent}14, transparent 70%)`
                  : undefined,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                transition: 'opacity 200ms ease, filter 200ms ease',
              }}>
              <OrnateFrame style={{ width: '100%', height: '100%' }} color={frameColor}>
                <div style={{
                  position: 'absolute',
                  inset: tight ? 10 : 20,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  {/* "trial 01" label drops on tight so the Begin button
                      below the target number stays inside the card. */}
                  {!tight && (
                    <div className="f-mono uc" style={{
                      fontSize: 9, letterSpacing: '0.3em',
                      color: cur ? (hasEvent ? eventAccent : accent) : locked ? '#7a6fa6' : '#bba8ff',
                    }}>
                      {hasEvent ? 'encounter' : `trial ${String(i + 1).padStart(2, '0')}`}
                    </div>
                  )}
                  <div className="f-display" style={{
                    fontSize: tight ? 13 : compact ? 16 : 18,
                    color: '#f3f0ff', marginTop: tight ? 2 : 6,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    lineHeight: 1.18,
                    textAlign: 'center',
                    minHeight: '2.36em',
                  }}>
                    {hasEvent ? eventDef!.name : b.def.name}
                  </div>
                  {/* Trial modifier preview (Pillar A) — shown for any
                      non-cleared, non-locked-far-ahead slot so the player
                      can plan around the upcoming voidstorm. Cleared
                      slots drop the chip to keep the cleared style
                      muted. */}
                  {!cleared && (isBoss || b.voidstormId) && (
                    <TrialModifierChip
                      voidstormId={b.voidstormId}
                      isBoss={isBoss}
                      bossBlindId={isBoss ? upcomingBossId ?? undefined : undefined}
                      tight={tight}
                      compact={compact}
                    />
                  )}
                  <div style={{
                    // Tight: sigil shrinks and the slot stretches to fill,
                    // pushing the target row to the bottom edge so the
                    // card stays visually balanced at 150-200px height.
                    marginTop: tight ? 4 : 14,
                    flex: tight ? 1 : undefined,
                    height: tight ? undefined : 96,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {cleared
                      ? <ClearedNode color={b.tierColor} />
                      : hasEvent
                        ? (
                          <div style={{
                            fontSize: tight ? 36 : 72,
                            color: eventAccent,
                            textShadow: `0 0 20px ${eventAccent}cc, 0 0 40px ${eventAccent}55`,
                            lineHeight: 1,
                          }}>
                            {eventDef!.glyph}
                          </div>
                        )
                        : <TierSigil tier={i} size={tight ? 36 : 96} animate={cur ? 'idle' : 'none'} />}
                  </div>
                  <div style={{ marginTop: 'auto', textAlign: 'center', width: '100%' }}>
                    {hasEvent ? (
                      <div className="f-mono" style={{
                        fontSize: tight ? 10 : 11, color: eventAccent,
                        letterSpacing: '0.18em', lineHeight: 1.3,
                      }}>
                        a choice waits
                      </div>
                    ) : (
                      <>
                        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.2em', color: '#bba8ff' }}>target</div>
                        <div className="f-display num" style={{
                          fontSize: tight ? 18 : 26, color: '#f3f0ff',
                        }}>{b.target.toLocaleString()}</div>
                        {/* Multiplier + reward subtext drops on tight to
                            free vertical space — the tooltip still has it. */}
                        {!tight && (
                          <>
                            <div className="f-mono" style={{ fontSize: 10, color: accent, marginTop: 2 }}>×{b.mult.toFixed(1)} multiplier</div>
                            <div className="f-mono" style={{ fontSize: 10, color: '#f5c451', marginTop: 6 }}>
                              ◇ +{b.reward} shards
                            </div>
                          </>
                        )}
                      </>
                    )}
                    {/* Tight-mode Begin button sits inside the card so
                        nothing overhangs into adjacent cards on a wrap.
                        ✓ cleared collapses to inline as well. */}
                    {tight && cur && (
                      <button
                        className="btn btn-primary mat-interactive"
                        onClick={() => dispatch(hasEvent
                          ? { type: 'SET_SCREEN', screen: 'event' }
                          : { type: 'START_BLIND' })}
                        style={{
                          marginTop: 6, fontSize: 11, padding: '6px 12px',
                        }}>
                        {hasEvent ? 'Open' : 'Begin'}
                      </button>
                    )}
                    {tight && cleared && (
                      <div style={{
                        marginTop: 4, fontSize: 10, color: '#9577ff', fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        ✓ cleared
                      </div>
                    )}
                  </div>
                </div>
              </OrnateFrame>

              {/* Desktop / compact layout keeps the dramatic overhanging
                  Begin button. Tight mode renders it inline above. */}
              {!tight && cur && (
                <button
                  className="btn btn-primary mat-interactive"
                  onClick={() => dispatch(hasEvent
                    ? { type: 'SET_SCREEN', screen: 'event' }
                    : { type: 'START_BLIND' })}
                  style={{
                    position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 13, padding: '10px 18px',
                  }}>
                  {hasEvent ? 'Open Event' : 'Begin'}
                </button>
              )}
              {!tight && cleared && (
                <div style={{
                  position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 10, color: '#9577ff', fontFamily: 'JetBrains Mono, monospace',
                }}>
                  ✓ cleared
                </div>
              )}
              <span className="tip tip-above">
                <span className="tip-title">{b.def.name} {isBoss ? '· Boss' : ''}</span>
                Target: {b.target.toLocaleString()} ({b.mult.toFixed(1)}× ante).{' '}
                {cleared
                  ? 'Already cleared.'
                  : locked
                    ? 'Locked — clear earlier trials first.'
                    : `Reward ◆ ${b.reward}.`}
                {isBoss && <span style={{ display: 'block', marginTop: 4, color: '#ff8e9c' }}>Boss blinds apply a special debuff this trial.</span>}
              </span>
            </div>
          );
          })}
        </div>

        {/* Action bar lives in the flex flow now, not pinned to the
            viewport bottom. Inside an `overflow-y: auto` parent,
            absolute `bottom: N` resolves to the scroll content bottom,
            which floated this row into the middle of the screen on
            short landscape phones. Inline placement keeps it under the
            cards at every viewport size. */}
        <ActionBar tight={tight} style={{
          maxWidth: 'calc(100% - 40px)',
          // Tight: clear 12px gutter between trial cards and the action
          // row. With `clamp(140px, 45vh, 180px)` card heights on a
          // 360px-tall landscape phone, the previous 0 margin let the
          // cards' "Begin" button overhang touch the action row's pill
          // buttons.
          marginTop: tight ? 12 : 4,
        }}>
          {!forgeDisabled && (
            <button
              className="btn btn-ghost mat-interactive has-tip tap"
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'forge' })}
              style={tight ? { fontSize: 11, padding: '4px 10px' } : undefined}>
              ⚒ Forge
              <span className="tip tip-above">
                <span className="tip-title">Star Forge</span>
                Etch owned mods onto your dice. Mods stay attached across trials and can be detached anytime to swap.
              </span>
            </button>
          )}
          {!blinds[blindIdx]?.def.isBoss && (
            <button
              className="btn btn-ghost mat-interactive has-tip tap"
              data-coach="skip-button"
              onClick={() => dispatch({ type: 'SKIP_BLIND' })}
              style={tight ? { fontSize: 11, padding: '4px 10px' } : undefined}>
              ↪ Skip (+{blinds[blindIdx]?.def.skipReward ?? 0} ◇)
              <span className="tip tip-above">
                <span className="tip-title">Skip Trial</span>
                Forfeit this non-boss trial in exchange for shards. The next trial becomes current. Boss trials cannot be skipped.
              </span>
            </button>
          )}
          <button
            className="btn btn-ghost mat-interactive has-tip tap"
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
            style={tight ? { fontSize: 11, padding: '4px 10px' } : undefined}>
            ← Title
            <span className="tip tip-above">
              <span className="tip-title">Return to Title</span>
              Abandon this run and go back to the title screen. Progress this run is lost.
            </span>
          </button>
        </ActionBar>

        {/* Travel portals are decorative and don't fit on landscape
            phones (~360px tall) alongside trial cards + action row. They
            disappear on tight viewports — the player can still travel
            via the Portal flow on the title screen. */}
        {!tight && (
          <div style={{
            display: 'flex', gap: 18, justifyContent: 'center',
            alignItems: 'flex-end', flexWrap: 'wrap',
          }}>
            <PortalGate size={96} label="Travel" />
            {(typeof window !== 'undefined' && window.Portal?.readPortalParams().ref) && (
              <PortalGate size={72} label="Return" refUrl={window.Portal.readPortalParams().ref!} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type ThreadBlind = {
  cleared: boolean;
  current: boolean;
  locked: boolean;
  tierColor: string;
};

function ConstellationThread({ blinds, accent }: { blinds: ThreadBlind[]; accent: string }) {
  const totalW = blinds.length * CARD_W + (blinds.length - 1) * CARD_GAP;
  const centers = blinds.map((_, i) => i * (CARD_W + CARD_GAP) + CARD_W / 2);
  const cy = 16;
  const bandH = 32;

  const segmentColor = (a: ThreadBlind, b: ThreadBlind) => {
    if (a.cleared && b.cleared) return '#9577ff88';
    if (a.cleared && b.current) return accent;
    if (a.current && b.locked) return `${accent}66`;
    if (a.locked && b.locked) return '#bba8ff33';
    return `${accent}55`;
  };

  return (
    <svg
      width={totalW}
      height={bandH}
      // Tier 2: flows inline within the Hub flex column. On viewports
      // narrower than `totalW`, the SVG simply overflows the centered
      // column horizontally; cards still wrap below it.
      style={{
        maxWidth: '100%',
        pointerEvents: 'none', overflow: 'visible',
      }}
      aria-hidden="true">
      {centers.slice(0, -1).map((x, i) => (
        <line
          key={i}
          x1={x} y1={cy} x2={centers[i + 1]} y2={cy}
          stroke={segmentColor(blinds[i]!, blinds[i + 1]!)}
          strokeWidth={1.25}
          strokeDasharray="2 5"
          strokeLinecap="round"
        />
      ))}
      {centers.map((x, i) => {
        const b = blinds[i]!;
        const r = b.current ? 4 : b.cleared ? 3 : 2.5;
        const fill = b.current ? accent : b.cleared ? '#9577ff' : b.tierColor;
        const opacity = b.current ? 1 : b.cleared ? 0.9 : 0.6;
        return (
          <circle
            key={i}
            cx={x} cy={cy} r={r}
            fill={fill}
            opacity={opacity}
            style={b.current ? { filter: `drop-shadow(0 0 6px ${accent})` } : undefined}
          />
        );
      })}
    </svg>
  );
}

function ClearedNode({ color }: { color: string }) {
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" aria-hidden="true" style={{ overflow: 'visible' }}>
      <circle cx="32" cy="32" r="20" fill="none" stroke={`${color}55`} strokeWidth="1" strokeDasharray="2 4" />
      <circle cx="32" cy="32" r="3.5" fill={color} opacity="0.85"
              style={{ filter: `drop-shadow(0 0 6px ${color}aa)` }} />
    </svg>
  );
}
