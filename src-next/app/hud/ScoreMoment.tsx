import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import { sfxPlay } from '../../audio/sfx';

type Chip = { label: string; value: string; color: string };
type Phase = 'idle' | 'cascade' | 'boom' | 'fade';

export function ScoreMoment() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [chips, setChips] = useState<Chip[]>([]);
  const [name, setName] = useState<string>('');
  const [total, setTotal] = useState<number>(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const offCombo = bus.on('onComboDetected', ({ combo }) => {
      setName(formatComboName(combo));
    });
    const offScore = bus.on('onScoreCalculated', ({ chips: chipCount, mult, total: t }) => {
      const built: Chip[] = [
        { label: 'Chips', value: String(chipCount), color: '#7be3ff' },
        { label: 'Mult', value: `× ${mult.toFixed(2)}`, color: '#ff7847' },
      ];
      setChips(built);
      setTotal(t);
      runSequence(built.length);
    });
    return () => { offCombo(); offScore(); clearTimers(); };
  }, []);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }
  function schedule(ms: number, fn: () => void) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function runSequence(chipCount: number) {
    clearTimers();
    setPhase('cascade');
    sfxPlay('castSwell');
    for (let i = 0; i < chipCount; i++) {
      schedule(180 + i * 140, () => sfxPlay('chipTick', { idx: i }));
    }
    const boomAt = 180 + chipCount * 140 + 80;
    schedule(boomAt, () => {
      setPhase('boom');
      sfxPlay('castBoom');
    });
    schedule(boomAt + 700, () => setPhase('fade'));
    schedule(boomAt + 1100, () => {
      setPhase('idle');
      dispatch({ type: 'END_SCORING' });
    });
  }

  if (phase === 'idle') return null;

  return (
    <div
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: phase === 'fade' ? 0 : 1,
        transition: 'opacity 400ms ease',
      }}>
      {name && (
        <div className="f-display" style={{
          fontSize: 32, color: '#f5c451',
          textShadow: '0 0 24px rgba(245,196,81,0.7)',
          letterSpacing: '0.18em', marginBottom: 18,
          opacity: phase === 'cascade' || phase === 'boom' ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}>
          {name}
        </div>
      )}
      {phase === 'cascade' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {chips.map((c, i) => (
            <div key={i}
              className="f-mono"
              style={{
                padding: '4px 10px', borderRadius: 6,
                background: `${c.color}25`, border: `1px solid ${c.color}80`,
                color: c.color, fontSize: 12,
                animation: 'chipPop 200ms ease-out',
                animationDelay: `${i * 140}ms`,
                animationFillMode: 'both',
              }}>
              <span style={{ opacity: 0.7, marginRight: 6 }}>{c.label}</span>{c.value}
            </div>
          ))}
        </div>
      )}
      {(phase === 'boom' || phase === 'fade') && (
        <div className="f-mono num" style={{
          fontSize: 96, color: '#fff', fontWeight: 700,
          textShadow: '0 0 40px #7be3ff, 0 0 80px rgba(123,227,255,0.5)',
          animation: 'boomPop 400ms cubic-bezier(0.2, 1.4, 0.5, 1)',
          animationFillMode: 'both',
        }}>
          {total.toLocaleString()}
        </div>
      )}
    </div>
  );
}

function formatComboName(id: string): string {
  const map: Record<string, string> = {
    five_kind: 'Cygnus',
    four_kind: 'Orion',
    full_house: 'Pegasus',
    three_kind: 'Auriga',
    lg_straight: 'The Lyre',
    sm_straight: 'Cassiopeia',
    two_pair: 'Gemini',
    one_pair: 'Vela',
    chance: 'Wandering Star',
  };
  return map[id] ?? '';
}
