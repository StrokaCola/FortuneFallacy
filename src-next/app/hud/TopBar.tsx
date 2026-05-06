import { useRef } from 'react';
import { Astrolabe } from '../visual/Astrolabe';
import { Sigil } from '../visual/Sigil';
import { lookupVoucher } from '../../data/vouchers';
import { useStore, type GameState } from '../../state/store';
import { lookupStake } from '../../data/stakes';
import { lookupChallenge } from '../../data/challenges';
import { Z } from './zLayers';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import { useReportHudHeight } from './useReportHudHeight';

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
}: {
  ante?: number; blind?: string; shards?: number; hands?: number; rerolls?: number;
  target?: number; score?: number;
  catalystSlots?: { used: number; max: number };
  voucherCount?: number;
  vouchers?: string[];
  accent?: string;
}) {
  const stakeId = useStore(selectStakeId);
  const challengeId = useStore(selectChallengeId);
  const stake = lookupStake(stakeId);
  const challenge = challengeId ? lookupChallenge(challengeId) : null;
  // Hide the badge on Spark when no challenge is active — that's the
  // canonical run and the badge would just be noise.
  const showStakeBadge = stake.id !== 'spark' || !!challenge;
  const scoreFmt = formatScore(score);
  const targetFmt = target ? formatScore(target) : null;
  const isCompactScore = scoreFmt.display !== scoreFmt.full;
  const tight = useIsTightStage();
  // The big blind line restates the same word that's already in the
  // small "ante NN · blind" label above it. On a phone where vertical
  // space is precious we drop it; on desktop the redundancy is fine
  // because it gives the panel typographic weight.
  const renderBigBlind = !tight;

  // Astrolabe collapses to a small dial (or hides) on tight stages so
  // the score panel doesn't eat half the visible viewport on a phone.
  const astrolabeSize = tight ? 0 : 92;
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
          {astrolabeSize > 0 && <Astrolabe size={astrolabeSize} score={score} target={target} accent={accent} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>score</div>
            <div
              className="f-display num"
              style={{ fontSize: scoreFontSize, lineHeight: 1, color: '#f3f0ff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
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
          hands {hands} · rerolls {rerolls}
        </div>
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

      <div className="panel" style={{ padding: '14px 18px', minWidth: 200, pointerEvents: 'auto' }}>
        <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>treasury</div>
        <div className="has-tip" style={{ display: 'flex', alignItems: 'baseline', gap: 8, position: 'relative' }}>
          <Sigil kind="star" size={20} color="#f5c451" />
          <div className="f-display num" style={{ fontSize: 32, color: '#f5c451', fontWeight: 700 }}>{shards}</div>
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.2em' }}>shards</div>
          <span className="tip">
            <span className="tip-title">Shards ◆</span>
            Run currency. Earned by clearing trials and unused hands; spent at the Bazaar on upgrades and rerolls.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {catalystSlots && (
            <span className="f-mono has-tip" style={{ fontSize: 10, color: '#7be3ff', padding: '2px 6px',
              border: '1px solid rgba(123,227,255,0.4)', borderRadius: 4, position: 'relative', cursor: 'help' }}>
              catalysts {catalystSlots.used}/{catalystSlots.max}
              <span className="tip">
                <span className="tip-title">Catalyst slots</span>
                Catalysts are persistent run-long modifiers. The Bench voucher and some constellations grant extra slots.
              </span>
            </span>
          )}
          {voucherCount > 0 && (
            <span className="f-mono has-tip" style={{ fontSize: 10, color: '#bba8ff', padding: '2px 6px',
              border: '1px solid rgba(149,119,255,0.3)', borderRadius: 4, position: 'relative', cursor: 'help' }}>
              vouchers {voucherCount}
              <span className="tip">
                <span className="tip-title">Vouchers</span>
                {vouchers.length === 0
                  ? 'Permanent run perks bought at the Bazaar.'
                  : vouchers.map((id) => lookupVoucher(id)?.name ?? id).join(' · ')}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
