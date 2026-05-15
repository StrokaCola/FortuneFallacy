import { useEffect, useRef, useState } from 'react';
import { Astrolabe } from '../visual/Astrolabe';
import { Sigil } from '../visual/Sigil';
import { lookupVoucher } from '../../data/vouchers';
import { useStore, type GameState } from '../../state/store';
import { lookupStake } from '../../data/stakes';
import { lookupChallenge } from '../../data/challenges';
import { BOSS_BLINDS } from '../../data/blinds';
import { BossIcon } from '../visual/BossIcon';
import { Z } from './zLayers';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import { useReportHudHeight } from './useReportHudHeight';
import { bus } from '../../events/bus';
import { useCounterTween } from '../hooks/useCounterTween';
import { ConstellationCount } from '../visual/AstralPrimitives';

// Score panels overflow once you cross ~10⁷ at 38px font. Above that
// switch to compact notation (1.2M, 12B, 4.5T) and keep the precise
// number in the tooltip. Below the threshold we keep the comma form so
// the early game reads as a normal score.
function formatScore(n: number): { display: string; full: string } {
  const full = n.toLocaleString();
  if (n < 10_000_000) return { display: full, full };
  const fmt = (v: number, suffix: string) => {
    const rounded = Math.round(v * 10) / 10;
    return `${rounded}${suffix}`;
  };
  if (n < 1e9)  return { display: fmt(n / 1e6, 'M'),  full };
  if (n < 1e12) return { display: fmt(n / 1e9, 'B'),  full };
  if (n < 1e15) return { display: fmt(n / 1e12, 'T'), full };
  return { display: fmt(n / 1e15, 'P'), full };
}

const selectStakeId = (s: GameState) => s.run.stakeId;
const selectChallengeId = (s: GameState) => s.run.challengeId;
// Boss debuff readout — folded into TopBar's center panel so the player
// always has a small, well-known spot to check what's hitting them this
// trial. Active only while the round is live and the blind is a boss.
const selectIsBoss = (s: GameState) => s.round.isBoss;
const selectRoundActive = (s: GameState) => s.round.active;
const selectBlindId = (s: GameState) => s.round.blindId;

export function TopBar({
  ante = 1,
  blind = 'Trial',
  shards = 0,
  hands = 3,
  rerolls = 2,
  target = 0,
  score = 0,
  catalystSlots,
  voucherCount = 0,
  vouchers = [],
  accent = '#7be3ff',
  constellationAccent,
  tense = false,
}: {
  ante?: number; blind?: string; shards?: number; hands?: number; rerolls?: number;
  target?: number; score?: number;
  catalystSlots?: { used: number; max: number };
  voucherCount?: number;
  vouchers?: string[];
  accent?: string;
  // Persistent constellation tint that survives boss blinds. The
  // Astrolabe orbital dial uses this so the run's chosen
  // constellation identity stays visible even when `accent` flips to
  // crimson during the boss debuff. Optional; falls back to `accent`.
  constellationAccent?: string;
  // Last-throw warning. When true, the score readout pulses red so the
  // player can't miss that the next hand needs to clear or they bust.
  // Driven from Round.tsx based on (hands === 1 && score < target).
  tense?: boolean;
}) {
  const stakeId = useStore(selectStakeId);
  const challengeId = useStore(selectChallengeId);
  const isBoss = useStore(selectIsBoss);
  const roundActive = useStore(selectRoundActive);
  const blindId = useStore(selectBlindId);
  const stake = lookupStake(stakeId);
  const challenge = challengeId ? lookupChallenge(challengeId) : null;
  const bossDef = (roundActive && isBoss && blindId)
    ? BOSS_BLINDS.find((b) => b.id === blindId) ?? null
    : null;
  // Hide the badge on Spark when no challenge is active — that's the
  // canonical run and the badge would just be noise.
  const showStakeBadge = stake.id !== 'spark' || !!challenge;

  // Deferred score-counter fill. On a boom beat, capture the
  // current displayed score and pin it (don't mirror the next
  // round.score commit) until the onScoreCounterFill event fires —
  // timed by ScoreMoment to land when the first star trail reaches
  // the counter. Then tween from the pinned value up to the
  // committed score over the event's durationMs. Bail and non-boom
  // commits bypass the pin and the displayed value updates with
  // state as usual.
  const [displayedScore, setDisplayedScore] = useState(score);
  const displayedScoreRef = useRef(displayedScore);
  const scoreRef = useRef(score);
  const pinnedFromRef = useRef<number | null>(null);
  useEffect(() => { displayedScoreRef.current = displayedScore; }, [displayedScore]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  // Mirror state.score changes onto displayedScore unless a boom
  // pin is active. Pin clears when the fill tween completes (or
  // on round reset via the boom listener below).
  useEffect(() => {
    if (pinnedFromRef.current === null) setDisplayedScore(score);
  }, [score]);
  useEffect(() => {
    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'boom') {
        pinnedFromRef.current = displayedScoreRef.current;
      }
    });
    const offFill = bus.on('onScoreCounterFill', ({ durationMs }) => {
      const from = pinnedFromRef.current;
      if (from === null) return;
      const to = scoreRef.current;
      const start = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayedScore(Math.round(from + (to - from) * eased));
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          pinnedFromRef.current = null;
          // Catch pulse on the visible counter once the trails have
          // landed and the climb finished — the spring bounce CSS
          // animation already exists from the old ScoreFloat path.
          const counter = document.querySelector<HTMLElement>('[data-score-counter]');
          if (counter) {
            counter.style.animation = 'scoreCounterCatch 220ms cubic-bezier(0.2, 1.6, 0.4, 1)';
            window.setTimeout(() => { if (counter) counter.style.animation = ''; }, 240);
          }
          // Celebration afterglow — fires alongside the catch pulse
          // so the boom's golden warmth visually carries into the
          // round → shop screen swap that follows ~200ms later.
          // App-level <AfterglowOverlay> consumes the event so the
          // tint persists across the screen transition.
          bus.emit('onCelebrationAfterglow', { durationMs: 900 });
        }
      };
      requestAnimationFrame(tick);
    });
    return () => { offBeat(); offFill(); };
  }, []);

  const scoreFmt = formatScore(displayedScore);
  const targetFmt = target ? formatScore(target) : null;
  const isCompactScore = scoreFmt.display !== scoreFmt.full;
  // Smooth count-ups / count-downs on the three secondary counters.
  // Shards gets the longest tween because deltas are biggest (clear
  // rewards can drop +20 in a single frame); hands / rerolls deltas
  // are usually ±1 so a tighter ramp avoids feeling laggy.
  const shardsDisplay = useCounterTween(shards, 320);
  const handsDisplay = useCounterTween(hands, 200);
  const rerollsDisplay = useCounterTween(rerolls, 200);
  const tight = useIsTightStage();
  // The big blind line restates the same word that's already in the
  // small "ante NN · blind" label above it. On a phone where vertical
  // space is precious we drop it; on desktop the redundancy is fine
  // because it gives the panel typographic weight.
  const renderBigBlind = !tight;

  // Astrolabe scales down on tight stages — was previously hidden
  // entirely at size 0. A 56px dial still reads as the constellation's
  // identity anchor on a 360-wide phone without crowding the score
  // panel. Wider viewports get the full 92px.
  const astrolabeSize = tight ? 56 : 92;
  const scoreFontSize = tight ? 26 : 38;
  const panelPad = tight ? '8px 12px' : '14px 18px';
  const centerPad = tight ? '6px 12px' : '12px 22px';
  // Self-measure so HUD overlays (CatalystStrip, ConsumableTray, ScoreBreakdown)
  // and the dice canvas can stack/shrink against this bar's actual height
  // — including when the panels wrap onto multiple rows on narrow viewports.
  const ref = useRef<HTMLDivElement>(null);
  useReportHudHeight(ref, '--hud-top-h', 'top');
  return (
    <div ref={ref} style={{
      // Clamp the bar to a max content width so on wide screens the
      // three panels don't drift to the far edges. `max(18px, ...)`
      // keeps the 18px gutter on narrow phones.
      position: 'absolute', top: tight ? 10 : 18,
      left:  tight ? '10px' : 'max(18px, calc(50% - 700px))',
      right: tight ? '10px' : 'max(18px, calc(50% - 700px))',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: tight ? 8 : 18, flexWrap: 'wrap',
      pointerEvents: 'none', zIndex: Z.hudTop,
    }}>
      <div className="panel has-tip" style={{ padding: panelPad, minWidth: tight ? 0 : 280, maxWidth: tight ? 220 : 360, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tight ? 8 : 14 }}>
          {astrolabeSize > 0 && <Astrolabe size={astrolabeSize} score={displayedScore} target={target} accent={constellationAccent ?? accent} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>score</div>
            <div
              data-score-counter
              className={`f-display num${tense ? ' last-throw-warn' : ''}`}
              style={{
                fontSize: scoreFontSize, lineHeight: 1,
                color: tense ? '#ff4d6d' : '#f3f0ff',
                fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                textShadow: tense ? '0 0 18px rgba(255,77,109,0.65)' : undefined,
              }}
              aria-live="polite"
              aria-atomic="true"
              title={isCompactScore ? scoreFmt.full : undefined}
            >
              {scoreFmt.display}
            </div>
            <div className="f-mono num" style={{ fontSize: 12, color: accent, marginTop: 2, whiteSpace: 'nowrap' }}>
              / {targetFmt ? targetFmt.display : '—'}
            </div>
          </div>
        </div>
        <span className="tip">
          <span className="tip-title">Score / Target</span>
          {isCompactScore ? `${scoreFmt.full} / ${targetFmt?.full ?? '—'} — ` : ''}
          Reach the target to clear the trial. Score persists between hands until you bust or clear.
        </span>
      </div>

      <div className="panel has-tip" style={{ padding: centerPad, textAlign: 'center', pointerEvents: 'auto' }}>
        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff' }}>
          ante {String(ante).padStart(2, '0')} · {blind.toLowerCase()}
        </div>
        {renderBigBlind && (
          <div className="f-display" style={{ fontSize: 22, marginTop: 4, color: '#f3f0ff' }}>{blind}</div>
        )}
        <div className="f-mono" style={{ fontSize: 10, color: '#9577ff', marginTop: 2 }}>
          hands {handsDisplay} · rerolls {rerollsDisplay}
        </div>
        {/* Boss debuff readout — small chip with the boss's name + icon,
            long-press / hover for the full description. Always sits in
            the same well-known spot in TopBar so the player never has to
            hunt for it on a boss blind. */}
        {bossDef && (
          <div
            className="has-tip"
            data-coach="boss-badge"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 6, padding: '2px 8px', borderRadius: 4,
              background: `${bossDef.color}22`,
              border: `1px solid ${bossDef.color}88`,
              boxShadow: `0 0 10px ${bossDef.color}44`,
              cursor: 'help', position: 'relative',
            }}
          >
            <span style={{
              display: 'inline-flex',
              filter: `drop-shadow(0 0 4px ${bossDef.color}aa)`,
            }}>
              <BossIcon boss={bossDef} size={11} />
            </span>
            <span className="f-mono uc" style={{
              fontSize: 9, letterSpacing: '0.22em', color: bossDef.color,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: tight ? 110 : 180,
            }}>
              boss · {bossDef.name.toLowerCase()}
            </span>
            <span className={tight ? 'tip tip-above' : 'tip'}>
              <span className="tip-title">{bossDef.name} · Boss Debuff</span>
              {bossDef.description}
            </span>
          </div>
        )}
        {showStakeBadge && (
          <div className="has-tip" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 6, padding: '2px 8px', borderRadius: 4,
            background: `${stake.color}22`, border: `1px solid ${stake.color}88`,
            cursor: 'help', position: 'relative',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: stake.color, boxShadow: `0 0 6px ${stake.color}` }} />
            <span className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.22em', color: stake.color }}>
              {stake.name.toLowerCase()}{challenge ? ` · ${challenge.name.toLowerCase()}` : ''}
            </span>
            <span className="tip">
              <span className="tip-title">{stake.name} stake{challenge ? ` · ${challenge.name}` : ''}</span>
              {stake.rules.join(' · ')}{challenge ? ` · ${challenge.rules.join(' · ')}` : ''}
            </span>
          </div>
        )}
        <span className="tip">
          <span className="tip-title">{blind} · Ante {ante}</span>
          Hands left: how many full scoring hands you have this trial. Rerolls left: how many times you can re-roll the unlocked dice this hand.
        </span>
      </div>

      <div className="panel" style={{
        padding: tight ? '8px 12px' : '14px 18px',
        minWidth: tight ? 0 : 200,
        // Cap on tight portrait so the panel never pushes past the viewport
        // edge when its content (catalysts/vouchers badges) wraps.
        maxWidth: tight ? 160 : 'none',
        pointerEvents: 'auto',
      }}>
        <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>treasury</div>
        <div className="has-tip" style={{ display: 'flex', alignItems: 'baseline', gap: 8, position: 'relative' }}>
          <Sigil kind="star" size={tight ? 14 : 20} color="#f5c451" />
          <div className="f-display num" style={{ fontSize: tight ? 22 : 32, color: '#f5c451', fontWeight: 700 }}>{shardsDisplay}</div>
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.2em' }}>shards</div>
          <span className="tip">
            <span className="tip-title">Shards ◆</span>
            Run currency. Earned by clearing trials and unused hands; spent at the Bazaar on upgrades and rerolls.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {catalystSlots && (
            <span className="f-mono has-tip" style={{ fontSize: 10, color: '#7be3ff', padding: '2px 6px',
              border: '1px solid rgba(123,227,255,0.4)', borderRadius: 4, position: 'relative', cursor: 'help',
              display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              catalysts
              <ConstellationCount filled={catalystSlots.used} total={catalystSlots.max} color="#7be3ff" size={6} />
              <span className="tip">
                <span className="tip-title">Catalyst slots</span>
                Catalysts are persistent run-long modifiers. The Bench voucher and some constellations grant extra slots.
              </span>
            </span>
          )}
          {voucherCount > 0 && (
            <span className="f-mono has-tip" data-coach="voucher-strip" style={{ fontSize: 10, color: '#bba8ff', padding: '2px 6px',
              border: '1px solid rgba(149,119,255,0.3)', borderRadius: 4, position: 'relative', cursor: 'help' }}>
              vouchers {voucherCount}
              <span className="tip" style={{ maxWidth: 280, textAlign: 'left' }}>
                <span className="tip-title">Vouchers</span>
                {vouchers.length === 0 ? (
                  'Permanent run perks bought at the Bazaar.'
                ) : (
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
                    {vouchers.map((id) => {
                      const v = lookupVoucher(id);
                      return (
                        <span key={id} style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: '#f3f0ff', fontSize: 11 }}>{v?.name ?? id}</span>
                          {v?.description && (
                            <span style={{ color: '#bba8ff', fontSize: 10, lineHeight: 1.35 }}>{v.description}</span>
                          )}
                        </span>
                      );
                    })}
                  </span>
                )}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
