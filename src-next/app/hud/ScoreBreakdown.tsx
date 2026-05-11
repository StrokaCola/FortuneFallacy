import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import type { Beat } from '../../core/scoring/types';
import { formatNumber } from './scoreExplainData';
import { Z } from './zLayers';
import { useIsTightStage } from '../hooks/useIsCompactStage';

const FADE_OUT_MS = 1200;

function formatMult(m: number): string {
  return Number.isInteger(m) ? String(m) : m.toFixed(2);
}

// Slot-spin tween — rAF-driven roll-up from the previous mult to the
// new one over MULT_TWEEN_MS. Restarts mid-tween if mult changes again,
// so back-to-back slams chain visually instead of stalling on the
// previous tween. Matches the audio pitch ladder cadence.
const MULT_TWEEN_MS = 240;
function easeOutQuart(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u * u;
}

function useTweenedMult(target: number): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  shownRef.current = shown;

  useEffect(() => {
    if (shownRef.current === target) return;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const from = shownRef.current;
    const to = target;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / MULT_TWEEN_MS);
      const eased = easeOutQuart(t);
      const v = from + (to - from) * eased;
      shownRef.current = v;
      setShown(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return shown;
}

// Four-tier color escalation for cumulative mult. Hue progresses
// cyan-purple-magenta-ember-red so the player gets a continuous visual
// signal as they stack mults — Balatro's "red mult bar" tradition,
// but tied directly to magnitude bands rather than an arbitrary chain.
function multTier(m: number): { color: string; glow: string; flash: string } {
  if (m >= 16) return { color: '#ff4d6d', glow: 'rgba(255,77,109,0.75)',  flash: 'rgba(255,77,109,0.28)' };
  if (m >= 8)  return { color: '#f5c451', glow: 'rgba(245,196,81,0.65)',  flash: 'rgba(245,196,81,0.22)' };
  if (m >= 4)  return { color: '#cc88ff', glow: 'rgba(204,136,255,0.6)',  flash: 'rgba(204,136,255,0.20)' };
  return         { color: '#ff7847', glow: 'rgba(255,120,71,0.55)',      flash: 'rgba(255,120,71,0.18)' };
}

function tierIndex(m: number): number {
  if (m >= 16) return 3;
  if (m >= 8)  return 2;
  if (m >= 4)  return 1;
  return 0;
}

export function ScoreBreakdown() {
  // Tight viewports (≤375 wide / ≤640×360 landscape) get smaller chip
  // and mult numerals so the strip stops fighting the centered
  // ScoreMoment overlay during the scoring crescendo.
  const tight = useIsTightStage();
  const [chips, setChips] = useState(0);
  const [mult, setMult] = useState(1);
  const [visible, setVisible] = useState(false);
  const [chipsPulse, setChipsPulse] = useState(0);
  const [multPulse, setMultPulse] = useState(0);
  const [tierPulse, setTierPulse] = useState(0);
  const fadeTimerRef = useRef<number | null>(null);
  const prevTierRef = useRef(0);
  // Slot-spin tween for the mult readout. mult is the snap-to value;
  // displayedMult is what the digit shows, easing toward it over 240ms.
  // Pairs with the multSlam SFX pitch ramp so the roll-up + audio cohere.
  const displayedMult = useTweenedMult(mult);

  useEffect(() => {
    const clearFade = () => {
      if (fadeTimerRef.current !== null) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };

    const off = bus.on('onScoreBeat', ({ beat }: { beat: Beat }) => {
      switch (beat.kind) {
        case 'cast-swell':
          clearFade();
          setChips(0);
          setMult(beat.initialMult ?? 1);
          setChipsPulse(0);
          setMultPulse(0);
          setTierPulse(0);
          prevTierRef.current = beat.initialMult !== undefined ? tierIndex(beat.initialMult) : 0;
          setVisible(true);
          break;
        case 'die-tick':
          setChips((c) => c + beat.chipDelta);
          setChipsPulse((p) => p + 1);
          break;
        case 'combo-bonus':
          if (beat.chipDelta !== 0) {
            setChips((c) => c + beat.chipDelta);
            setChipsPulse((p) => p + 1);
          }
          break;
        case 'upgrade-chip':
          setChips((c) => c + beat.chipDelta);
          setChipsPulse((p) => p + 1);
          break;
        case 'upgrade-mult':
          setMult((m) => {
            const next = m + beat.multDelta;
            const prevT = tierIndex(m);
            const nextT = tierIndex(next);
            if (nextT > prevT) setTierPulse((p) => p + 1);
            prevTierRef.current = nextT;
            return next;
          });
          setMultPulse((p) => p + 1);
          break;
        case 'mult-slam':
          setMult((m) => {
            const next = Math.round(m * beat.multiplier * 100) / 100;
            const prevT = tierIndex(m);
            const nextT = tierIndex(next);
            if (nextT > prevT) setTierPulse((p) => p + 1);
            prevTierRef.current = nextT;
            return next;
          });
          setMultPulse((p) => p + 1);
          break;
        case 'boom':
        case 'bail':
          clearFade();
          fadeTimerRef.current = window.setTimeout(() => {
            setVisible(false);
            fadeTimerRef.current = null;
          }, FADE_OUT_MS);
          break;
      }
    });
    return () => {
      off();
      if (fadeTimerRef.current !== null) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  const tier = multTier(mult);

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        // Sit cleanly below the catalyst/consumable rows. Strips are 88px
        // tall starting at `--hud-top-h + 8`, so we clear them with
        // 96 + 8 = 104px instead of the previous 76px (which left a
        // ~20px vertical overlap with the strip card bottoms).
        top: 'calc(var(--hud-top-h, 134px) + 104px)',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: tight ? 10 : 22,
        alignItems: 'center',
        zIndex: Z.hud,
        pointerEvents: 'none',
        animation: 'fadein 0.25s ease-out',
      }}
    >
      <div
        key={`chips-${chipsPulse}`}
        className="panel"
        style={{
          // Tight shrinks horizontal padding so the centered chips+mult
          // strip doesn't reach into the catalyst/consumable cards at
          // the screen edges on a ~360px portrait phone.
          padding: tight ? '8px 16px' : '14px 26px',
          borderRadius: 14,
          textAlign: 'center',
          // Mult-tier escalation: as cumulative mult crosses 4×/8×/16×,
          // the chips panel border + glow shift hue in sympathy with
          // the mult readout, so the entire score strip reads as one
          // escalating instrument rather than two independent panels.
          borderColor: `${tier.color}66`,
          boxShadow: tierIndex(mult) >= 1 ? `0 0 18px ${tier.glow}` : undefined,
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
          // Tight uses the gentler keyframe (scale 1.08 vs 1.22, glow
          // 10px vs 28px) so back-to-back die-tick pulses every 280ms
          // don't strobe. Wide/desktop keep the full juicy 1.22 pop.
          animation: chipsPulse > 0
            ? (tight
                ? 'chipsTickPopTight 180ms cubic-bezier(0.2, 1.4, 0.5, 1)'
                : 'chipsTickPop 240ms cubic-bezier(0.2, 1.4, 0.5, 1)')
            : undefined,
        }}
      >
        <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.18em' }}>chips</div>
        <div
          className="f-display num"
          style={{
            fontSize: tight ? 28 : 44,
            color: '#7be3ff',
            fontWeight: 700,
            lineHeight: 1,
            textShadow: '0 0 18px rgba(123,227,255,0.55)',
          }}
        >
          {formatNumber(chips)}
        </div>
      </div>
      <div
        className="f-display"
        style={{
          fontSize: tight ? 32 : 48,
          // The × itself escalates with the mult tier — at 16× it reads
          // as ember-red, matching the mult panel.
          color: tierIndex(mult) >= 1 ? tier.color : '#bba8ff',
          alignSelf: 'center',
          textShadow: tierIndex(mult) >= 1
            ? `0 0 14px ${tier.glow}`
            : '0 0 12px rgba(187,168,255,0.4)',
          transition: 'color 200ms ease, text-shadow 200ms ease',
        }}
      >
        ×
      </div>
      <div style={{ position: 'relative' }}>
        {tierPulse > 0 && (
          <div
            key={`ring-${tierPulse}`}
            aria-hidden
            style={{
              position: 'absolute',
              inset: -12,
              borderRadius: 22,
              border: `2px solid ${tier.color}`,
              boxShadow: `0 0 28px ${tier.glow}`,
              animation: 'ringExpand 0.6s ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          key={`mult-${multPulse}`}
          className="panel"
          style={{
            padding: tight ? '8px 16px' : '14px 26px',
            borderRadius: 14,
            textAlign: 'center',
            ['--tier-flash' as string]: tier.flash,
            animation: multPulse > 0
              ? 'multSlamPunch 320ms cubic-bezier(0.2, 1.6, 0.4, 1), multTierFlash 320ms ease-out'
              : undefined,
          }}
        >
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.18em' }}>mult</div>
          <div
            className="f-display num"
            style={{
              fontSize: tight ? 28 : 44,
              color: tier.color,
              fontWeight: 700,
              lineHeight: 1,
              textShadow: `0 0 22px ${tier.glow}`,
              transition: 'color 200ms ease, text-shadow 200ms ease',
            }}
          >
            {formatMult(displayedMult)}
          </div>
        </div>
      </div>
    </div>
  );
}
