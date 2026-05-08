import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import type { Beat } from '../../core/scoring/types';
import { formatNumber } from './scoreExplainData';

const FADE_OUT_MS = 1200;

function formatMult(m: number): string {
  return Number.isInteger(m) ? String(m) : m.toFixed(2);
}

function multTier(m: number): { color: string; glow: string; flash: string } {
  if (m >= 8)  return { color: '#f5c451', glow: 'rgba(245,196,81,0.65)', flash: 'rgba(245,196,81,0.22)' };
  if (m >= 4)  return { color: '#cc88ff', glow: 'rgba(204,136,255,0.6)',  flash: 'rgba(204,136,255,0.20)' };
  return         { color: '#ff7847', glow: 'rgba(255,120,71,0.55)',  flash: 'rgba(255,120,71,0.18)' };
}

function tierIndex(m: number): number {
  if (m >= 8) return 2;
  if (m >= 4) return 1;
  return 0;
}

export function ScoreBreakdown() {
  const [chips, setChips] = useState(0);
  const [mult, setMult] = useState(1);
  const [visible, setVisible] = useState(false);
  const [chipsPulse, setChipsPulse] = useState(0);
  const [multPulse, setMultPulse] = useState(0);
  const [tierPulse, setTierPulse] = useState(0);
  const fadeTimerRef = useRef<number | null>(null);
  const prevTierRef = useRef(0);

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
        // Sit just below the catalyst/consumable rows so the breakdown
        // strip never overlaps TopBar even when it wraps. 76px is the
        // approximate combined chip height of the strips above it.
        top: 'calc(var(--hud-top-h, 134px) + 76px)',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 22,
        alignItems: 'center',
        zIndex: 3,
        pointerEvents: 'none',
        animation: 'fadein 0.25s ease-out',
      }}
    >
      <div
        key={`chips-${chipsPulse}`}
        className="panel"
        style={{
          padding: '14px 26px',
          borderRadius: 14,
          textAlign: 'center',
          animation: chipsPulse > 0 ? 'chipsTickPop 240ms cubic-bezier(0.2, 1.4, 0.5, 1)' : undefined,
        }}
      >
        <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.18em' }}>chips</div>
        <div
          className="f-display num"
          style={{
            fontSize: 44,
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
          fontSize: 48,
          color: '#bba8ff',
          alignSelf: 'center',
          textShadow: '0 0 12px rgba(187,168,255,0.4)',
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
            padding: '14px 26px',
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
              fontSize: 44,
              color: tier.color,
              fontWeight: 700,
              lineHeight: 1,
              textShadow: `0 0 22px ${tier.glow}`,
              transition: 'color 200ms ease, text-shadow 200ms ease',
            }}
          >
            {formatMult(mult)}
          </div>
        </div>
      </div>
    </div>
  );
}
