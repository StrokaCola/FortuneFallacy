import { useEffect, useRef, useState } from 'react';
import { Astrolabe } from '../visual/Astrolabe';
import { Sigil } from '../visual/Sigil';
import { lookupVoucher } from '../../data/vouchers';
import { lookupCatalyst } from '../../data/catalysts';
import { lookupVoidstorm } from '../../core/round/voidstorms';
import { useStore, type GameState } from '../../state/store';
import { selectProjectedScore } from '../../state/selectors';
import { COMBOS } from '../../core/scoring/combos';
import type { BlindRule } from '../../voidmode/types';
import {
  getScorePreviewPref, subscribeScorePreviewPref,
} from '../settings/scorePreview';
import { lookupStake } from '../../data/stakes';
import { lookupChallenge } from '../../data/challenges';
import { BOSS_BLINDS } from '../../data/blinds';
import { BossIcon } from '../visual/BossIcon';
import { Z } from './zLayers';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import { useReportHudHeight } from './useReportHudHeight';
import { bus } from '../../events/bus';
import { useCounterTween } from '../hooks/useCounterTween';
import { useScoreDisplay } from './useScoreDisplay';
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
// Voidstorm (cosmic boon / curse) — moved into the ANTE panel as a
// chip alongside the boss + stake badges so the player's tilt state
// for the trial lives in one well-known spot. Previously this was a
// floating VoidstormBadge pinned to the right rail.
const selectVoidstormId = (s: GameState) => s.round.voidstormId;
// Phase 2B.2 — void-mode active blind rules (banCombo / discardCostMultiplier)
// surfaced as a chip under the blind name. Empty outside void mode or
// when no rule-bearing affix rolled. The component renders a small
// violet chip listing each rule in plain English so the player can
// read the constraint at a glance without opening a tooltip.
const selectActiveBlindRules = (s: GameState): BlindRule[] => s.run.activeBlindRules ?? [];
const selectVoidMode = (s: GameState) => s.run.mode === 'void';

// Map a combo id to its display name from the canonical scoring catalog.
// Falls back to the raw id if the combo isn't found (defensive — keeps
// the chip readable even on a future combo the renderer doesn't know).
function humanCombo(id: string): string {
  return COMBOS.find((c) => c.id === id)?.name ?? id;
}

// Format a BlindRule into a human-readable single-line summary.
function summarizeRule(r: BlindRule): string {
  if (r.kind === 'banCombo') return `${humanCombo(r.comboId)} doesn't count`;
  if (r.kind === 'discardCostMultiplier') return `Rerolls cost ${r.multiplier}×`;
  return '';
}

export function TopBar({
  ante = 1,
  blind = 'Trial',
  shards = 0,
  hands = 3,
  rerolls = 2,
  target = 0,
  catalystSlots,
  catalysts = [],
  voucherCount = 0,
  vouchers = [],
  accent = '#7be3ff',
  constellationAccent,
  tense = false,
}: {
  ante?: number; blind?: string; shards?: number; hands?: number; rerolls?: number;
  target?: number;
  catalystSlots?: { used: number; max: number };
  // Wave FF — owned catalyst ids so the TopBar chip tooltip can show a
  // per-catalyst breakdown the same way vouchers already do. Optional
  // and defaults to [] so existing callsites that don't pass it keep
  // the old generic tooltip text.
  catalysts?: string[];
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
  // Animated count-up score, owned here so the per-frame tween re-renders
  // only TopBar — not the whole Round subtree (which mounts ~15 HUD
  // components). Was previously called in Round.tsx and passed down as a
  // prop, which forced every sibling to reconcile 60×/sec while scoring.
  const score = useScoreDisplay();
  const stakeId = useStore(selectStakeId);
  const challengeId = useStore(selectChallengeId);
  const isBoss = useStore(selectIsBoss);
  const roundActive = useStore(selectRoundActive);
  const blindId = useStore(selectBlindId);
  const voidstormId = useStore(selectVoidstormId);
  const voidstormDef = (roundActive && voidstormId) ? lookupVoidstorm(voidstormId) : null;
  // Phase 2B.2 — pull active blind rules from run state. Chip below
  // renders only when in void mode AND at least one rule is active.
  const voidMode = useStore(selectVoidMode);
  const activeBlindRules = useStore(selectActiveBlindRules);
  const ruleSummaries = voidMode
    ? activeBlindRules.map(summarizeRule).filter((s) => s.length > 0)
    : [];
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
  // Wave T Scoring Theater (Batch J, 2026-05-19) — physical fill bar
  // under the score number. fillProgress tracks 0..1 during the boom
  // counter-fill tween so the stripe grows visually in lockstep with
  // the score climb. Reset to 0 at start of each fill.
  const [fillProgress, setFillProgress] = useState(0);
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
      setFillProgress(0);
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayedScore(Math.round(from + (to - from) * eased));
        setFillProgress(eased);
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          pinnedFromRef.current = null;
          // Let the bar linger briefly at full then fade so it reads
          // as "filled to the top" before resetting.
          window.setTimeout(() => setFillProgress(0), 400);
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
  // 2026-05-18 P5.2: score kinetic typography. Scale + colour-shift
  // the score readout at magnitude thresholds (vs the current trial
  // target). 1× cross → existing ff-score-cross-pulse handles it;
  // we layer additional tiers for "wow" hands.
  //   ratio >= 10   → 1.10× scale, deeper gold
  //   ratio >= 100  → 1.25× scale, golden shimmer
  //   ratio >= 1000 → 1.40× scale, full kinetic
  const scoreRatio = target > 0 ? displayedScore / target : 0;
  const kineticTier = scoreRatio >= 1000 ? 3 : scoreRatio >= 100 ? 2 : scoreRatio >= 10 ? 1 : 0;
  const kineticScale = kineticTier === 0 ? 1 : kineticTier === 1 ? 1.10 : kineticTier === 2 ? 1.25 : 1.40;
  const kineticColor = kineticTier === 0 ? undefined : '#ffd97a';
  // 2026-05-18 P1 — score projection chip. Subscribed only while the
  // setting is enabled; flipping the toggle re-renders via the
  // subscribe hook below. Null hides the chip entirely.
  const [previewOn, setPreviewOn] = useState(getScorePreviewPref() === 'on');
  useEffect(() => subscribeScorePreviewPref(() => setPreviewOn(getScorePreviewPref() === 'on')), []);
  const projected = useStore(selectProjectedScore);
  const showProjection = previewOn && projected != null && projected > 0;
  const projectedFmt = showProjection ? formatScore(projected) : null;
  // Smooth count-ups / count-downs on the three secondary counters.
  // Shards gets the longest tween because deltas are biggest (clear
  // rewards can drop +20 in a single frame); hands / rerolls deltas
  // are usually ±1 so a tighter ramp avoids feeling laggy.
  const shardsDisplay = useCounterTween(shards, 320);
  const handsDisplay = useCounterTween(hands, 200);
  const rerollsDisplay = useCounterTween(rerolls, 200);
  const tight = useIsTightStage();
  // Wave Z2 + CC — shard delta pulse. Detect a positive OR negative
  // delta and fire a brief glow on the digit. Gold for gains (+N
  // earned), crimson for spends (-N paid). State drives a keyed
  // remount of the digit span so the keyframe replays cleanly on
  // every change, and the direction class picks the tint.
  const [shardPulseKey, setShardPulseKey] = useState(0);
  const [shardPulseDir, setShardPulseDir] = useState<'gain' | 'spend' | null>(null);
  const prevShardsRef = useRef(shards);
  useEffect(() => {
    const prev = prevShardsRef.current;
    if (shards > prev) {
      setShardPulseDir('gain');
      setShardPulseKey((k) => k + 1);
    } else if (shards < prev) {
      setShardPulseDir('spend');
      setShardPulseKey((k) => k + 1);
    }
    prevShardsRef.current = shards;
  }, [shards]);
  // Wave II — score-cross-target pulse. Detect the moment the running
  // score (tweened) crosses the trial target threshold for the first
  // time in a hand. Fire a brief gold scale-pulse on the score panel
  // so the TopBar acknowledges the cross even when the cinematic VFX
  // (godrays / CA / star ripples) is happening over the dice canvas.
  // Reset the "crossed" flag whenever target changes (new blind).
  const [scoreCrossKey, setScoreCrossKey] = useState(0);
  const crossedThisHandRef = useRef(false);
  const prevTargetRef = useRef(target);
  useEffect(() => {
    if (target !== prevTargetRef.current) {
      crossedThisHandRef.current = false;
      prevTargetRef.current = target;
    }
    if (!crossedThisHandRef.current && target > 0 && displayedScore >= target) {
      crossedThisHandRef.current = true;
      setScoreCrossKey((k) => k + 1);
    } else if (target > 0 && displayedScore < target) {
      // Allow re-cross next hand if score dips back (round reset path).
      crossedThisHandRef.current = false;
    }
  }, [displayedScore, target]);
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
              key={`score-cross-${scoreCrossKey}`}
              className={`f-display num ff-number-plate${tense ? ' last-throw-warn' : ''}${scoreCrossKey > 0 ? ' ff-score-cross-pulse' : ''}${kineticTier > 0 ? ` ff-score-kinetic-tier${kineticTier}` : ''}${!tense && kineticTier === 0 && scoreCrossKey === 0 ? ' ff-score-idle-glow' : ''}`}
              style={{
                fontSize: scoreFontSize, lineHeight: 1,
                color: tense ? '#ff4d6d' : (kineticColor ?? '#f3f0ff'),
                fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                textShadow: tense
                  ? '0 0 18px rgba(255,77,109,0.65)'
                  : kineticTier > 0
                    ? `0 0 ${10 + kineticTier * 6}px rgba(255,217,122,${0.4 + kineticTier * 0.15})`
                    : undefined,
                // 2026-05-18 P5.2 kinetic typography. Scale rises in
                // discrete tiers — smooth animation would jitter on
                // count-up frames; stepping locks in a visible "beat"
                // at each threshold crossing.
                transform: kineticTier > 0 ? `scale(${kineticScale})` : undefined,
                transformOrigin: 'left center',
                transition: 'transform 220ms cubic-bezier(0.2, 1.6, 0.4, 1), color 180ms ease-out, text-shadow 180ms ease-out',
              }}
              aria-live="polite"
              aria-atomic="true"
              title={isCompactScore ? scoreFmt.full : undefined}
            >
              {scoreFmt.display}
            </div>
            {/* Wave T Scoring Theater (Batch J) — physical fill bar.
                Stripe grows under the score number during the boom
                counter-fill so the climb is visible as a meter, not
                just a tween. Fades after ~400ms hold at full. */}
            <div
              aria-hidden
              style={{
                height: 3,
                width: '100%',
                marginTop: 3,
                borderRadius: 2,
                background: 'rgba(245, 196, 81, 0.10)',
                overflow: 'hidden',
                opacity: fillProgress > 0 ? 1 : 0,
                transition: 'opacity 300ms ease-out',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, fillProgress * 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #f5c451 0%, #ffd97a 50%, #fff7e0 100%)',
                  boxShadow: '0 0 8px rgba(245, 196, 81, 0.85), 0 0 16px rgba(245, 196, 81, 0.45)',
                  transition: 'width 60ms linear',
                }}
              />
            </div>
            <div className="f-mono num" style={{ fontSize: 12, color: accent, marginTop: 2, whiteSpace: 'nowrap' }}>
              / {targetFmt ? targetFmt.display : '—'}
              {showProjection && projectedFmt && (
                <span
                  className="f-mono num"
                  title={`If you commit now, you'd score ~${projectedFmt.full}. Projection ignores catalysts, mods, chain.`}
                  style={{
                    marginLeft: 10,
                    fontSize: 11,
                    opacity: 0.62,
                    color: '#b7a5ff',
                    letterSpacing: '0.04em',
                  }}
                >
                  → ~{projectedFmt.display}
                </span>
              )}
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
          <div className="f-display" data-testid="blind-name" style={{ fontSize: 22, marginTop: 4, color: '#f3f0ff' }}>{blind}</div>
        )}
        {/* Phase 2B.2 — void-mode active-blind-rule chips. Renders one
            small violet chip per rule so the player can see which
            gameplay constraint is active this trial at a glance.
            Hidden outside void mode and when no rule-bearing affixes
            rolled for the current blind. */}
        {ruleSummaries.length > 0 && (
          <div
            data-testid="active-blind-rules"
            style={{
              display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
              gap: 4, marginTop: 4,
            }}
          >
            {ruleSummaries.map((text, i) => (
              <span
                key={i}
                className="f-mono uc has-tip"
                style={{
                  fontSize: 9, letterSpacing: '0.18em',
                  color: '#b7a5ff',
                  padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(149,119,255,0.14)',
                  border: '1px solid rgba(149,119,255,0.45)',
                  textShadow: '0 0 6px rgba(149,119,255,0.45)',
                  whiteSpace: 'nowrap',
                  position: 'relative',
                  cursor: 'help',
                }}
              >
                {text}
                <span className="tip">
                  <span className="tip-title">Void Rule</span>
                  This blind's affixes alter the rules of play — the constraint applies only for this trial.
                </span>
              </span>
            ))}
          </div>
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
        {/* Voidstorm chip — surfaces the active per-blind boon / curse
            inside the well-known ANTE panel slot next to boss + stake
            badges. Replaces the floating VoidstormBadge that used to
            hover on the right rail. */}
        {voidstormDef && (() => {
          const isBoon = voidstormDef.tone === 'boon';
          const accent = isBoon ? '#7be3ff' : '#ff4d6d';
          const labelTint = isBoon ? '#7be3ff' : '#ff7847';
          const glyph = isBoon ? '✦' : '✺';
          return (
            <div
              className="has-tip"
              data-coach="voidstorm-badge"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: 6, padding: '2px 8px', borderRadius: 4,
                background: `${accent}22`, border: `1px solid ${accent}88`,
                boxShadow: `0 0 10px ${accent}44`,
                cursor: 'help', position: 'relative',
              }}
            >
              <span style={{
                fontSize: 11, color: accent,
                textShadow: `0 0 6px ${accent}`,
                lineHeight: 1,
              }}>{glyph}</span>
              <span className="f-mono uc" style={{
                fontSize: 9, letterSpacing: '0.22em', color: labelTint,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: tight ? 120 : 200,
              }}>
                {voidstormDef.tone} · {voidstormDef.name.toLowerCase()}
              </span>
              <span className={tight ? 'tip tip-above' : 'tip'}>
                <span className="tip-title">{voidstormDef.name} · Voidstorm {isBoon ? 'Boon' : 'Curse'}</span>
                {voidstormDef.flavor}
              </span>
            </div>
          );
        })()}
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
        maxWidth: tight ? 140 : 'none',
        pointerEvents: 'auto',
      }}>
        <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>treasury</div>
        <div className="has-tip" style={{ display: 'flex', alignItems: 'baseline', gap: 8, position: 'relative' }}>
          <Sigil kind="star" size={tight ? 14 : 20} color="#f5c451" />
          <div
            key={`shards-pulse-${shardPulseKey}`}
            className={`f-display num${
              shardPulseKey > 0
                ? shardPulseDir === 'spend' ? ' ff-shard-spend-pulse' : ' ff-shard-gain-pulse'
                : ''
            }`}
            style={{ fontSize: tight ? 22 : 32, color: '#f5c451', fontWeight: 700 }}
          >
            {shardsDisplay}
          </div>
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.2em' }}>shards</div>
          <span className="tip">
            <span className="tip-title">Shards ◆</span>
            Run currency. Earned by clearing trials and unused hands; spent at the Night Market on upgrades and rerolls.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: tight ? 0 : 6 }}>
          {catalystSlots && !tight && (
            <span className="f-mono has-tip" style={{ fontSize: 10, color: '#7be3ff', padding: '2px 6px',
              border: '1px solid rgba(123,227,255,0.4)', borderRadius: 4, position: 'relative', cursor: 'help',
              display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              catalysts
              <ConstellationCount filled={catalystSlots.used} total={catalystSlots.max} color="#7be3ff" size={6} />
              <span className="tip" style={{ maxWidth: 280, textAlign: 'left' }}>
                <span className="tip-title">Catalyst slots</span>
                {catalysts.length === 0 ? (
                  'Catalysts are persistent run-long modifiers. The Bench voucher and some constellations grant extra slots.'
                ) : (
                  // Wave FF — list each owned catalyst inline so the chip
                  // doubles as a "what's running" preview. Mirrors the
                  // voucher chip's per-item breakdown. Sorted by acquisition
                  // order (newest last) so the chip reads like a build log.
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
                    {catalysts.map((id, i) => {
                      const c = lookupCatalyst(id);
                      if (!c) return null;
                      return (
                        <span key={`${id}-${i}`} style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: c.color, fontSize: 11 }}>
                            <span style={{ opacity: 0.85, marginRight: 6 }}>{c.icon}</span>
                            {c.name}
                          </span>
                          {c.desc && (
                            <span style={{ color: '#bba8ff', fontSize: 10, lineHeight: 1.35 }}>{c.desc}</span>
                          )}
                        </span>
                      );
                    })}
                  </span>
                )}
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
                  'Permanent run perks bought at the Night Market.'
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
