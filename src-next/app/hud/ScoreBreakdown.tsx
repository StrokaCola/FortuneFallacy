import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import type { Beat } from '../../core/scoring/types';

const FADE_OUT_MS = 1200;

function formatMult(m: number): string {
  return Number.isInteger(m) ? String(m) : m.toFixed(2);
}

export function ScoreBreakdown() {
  const [chips, setChips] = useState(0);
  const [mult, setMult] = useState(1);
  const [visible, setVisible] = useState(false);
  const [chipsPulse, setChipsPulse] = useState(0);
  const [multPulse, setMultPulse] = useState(0);
  const fadeTimerRef = useRef<number | null>(null);

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
          setMult(1);
          setChipsPulse(0);
          setMultPulse(0);
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
        case 'mult-slam':
          setMult((m) => Math.round(m * beat.multiplier * 100) / 100);
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

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 230,
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 16,
        zIndex: 3,
        pointerEvents: 'none',
        animation: 'fadein 0.25s ease-out',
      }}
    >
      <div
        key={`chips-${chipsPulse}`}
        className="panel"
        style={{
          padding: '8px 16px',
          textAlign: 'center',
          animation: chipsPulse > 0 ? 'boomPop 220ms cubic-bezier(0.2, 1.4, 0.5, 1)' : undefined,
        }}
      >
        <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.18em' }}>chips</div>
        <div className="f-display num" style={{ fontSize: 28, color: '#7be3ff' }}>{chips}</div>
      </div>
      <div className="f-display" style={{ fontSize: 36, color: '#bba8ff', alignSelf: 'center' }}>×</div>
      <div
        key={`mult-${multPulse}`}
        className="panel"
        style={{
          padding: '8px 16px',
          textAlign: 'center',
          animation: multPulse > 0 ? 'boomPop 220ms cubic-bezier(0.2, 1.4, 0.5, 1)' : undefined,
        }}
      >
        <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.18em' }}>mult</div>
        <div className="f-display num" style={{ fontSize: 28, color: '#ff7847' }}>{formatMult(mult)}</div>
      </div>
    </div>
  );
}
