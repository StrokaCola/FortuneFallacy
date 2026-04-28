import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import type { Beat } from '../../core/scoring/types';

type SlamOverlay = { id: number; label: string; multiplier: number; gold: boolean };

let slamId = 1;

const CONSTELLATION_NAMES: Record<string, string> = {
  FIVE_KIND: 'Cygnus',
  FOUR_KIND: 'Orion',
  FULL_HOUSE: 'Pegasus',
  THREE_KIND: 'Auriga',
  LG_STRAIGHT: 'The Lyre',
  SM_STRAIGHT: 'Cassiopeia',
  TWO_PAIR: 'Gemini',
  ONE_PAIR: 'Vela',
  CHANCE: 'Wandering Star',
};

export function ScoreMoment() {
  const [active, setActive] = useState(false);
  const [comboName, setComboName] = useState('');
  const [slams, setSlams] = useState<SlamOverlay[]>([]);
  const [stamp, setStamp] = useState<'target' | 'bail' | null>(null);
  const [boom, setBoom] = useState<{ total: number; gold: boolean } | null>(null);

  useEffect(() => {
    let crossed = false;
    const off = bus.on('onScoreBeat', ({ beat }: { beat: Beat }) => {
      switch (beat.kind) {
        case 'cast-swell':
          setActive(true);
          setComboName('');
          setSlams([]);
          setStamp(null);
          setBoom(null);
          crossed = false;
          break;
        case 'combo-bonus':
          setComboName(CONSTELLATION_NAMES[beat.comboLabel] ?? beat.comboLabel);
          break;
        case 'mult-slam': {
          const id = slamId++;
          setSlams((s) => [...s, { id, label: beat.label, multiplier: beat.multiplier, gold: crossed }]);
          setTimeout(() => setSlams((s) => s.filter((x) => x.id !== id)), 600);
          break;
        }
        case 'cross-target':
          crossed = true;
          setStamp('target');
          setTimeout(() => setStamp((cur) => (cur === 'target' ? null : cur)), 700);
          break;
        case 'boom':
          setBoom({ total: beat.finalTotal, gold: beat.crossedTarget });
          setTimeout(() => {
            setActive(false);
            setBoom(null);
            dispatch({ type: 'END_SCORING' });
          }, 1100);
          break;
        case 'bail':
          setStamp('bail');
          setTimeout(() => {
            setActive(false);
            setStamp(null);
            dispatch({ type: 'END_SCORING' });
          }, 1200);
          break;
      }
    });
    return () => off();
  }, []);

  if (!active) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {comboName && (
        <div className="f-display" style={{
          fontSize: 32, color: '#f5c451',
          textShadow: '0 0 24px rgba(245,196,81,0.7)',
          letterSpacing: '0.18em', marginBottom: 18,
          animation: 'chipPop 200ms ease-out',
        }}>
          {comboName}
        </div>
      )}
      <div style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
        {slams.map((s) => (
          <div key={s.id} className="f-mono" style={{
            padding: '8px 18px', borderRadius: 8,
            background: s.gold ? '#f5c45120' : '#ff784720',
            border: `2px solid ${s.gold ? '#f5c451' : '#ff7847'}`,
            color: s.gold ? '#f5c451' : '#ff7847',
            fontSize: 28, fontWeight: 700,
            boxShadow: `0 0 24px ${s.gold ? '#f5c451' : '#ff7847'}`,
            animation: 'boomPop 250ms cubic-bezier(0.2, 1.4, 0.5, 1)',
          }}>
            ×{s.multiplier}
          </div>
        ))}
      </div>
      {stamp === 'target' && (
        <div style={{
          position: 'absolute', top: '32%',
          fontFamily: '"Cinzel Decorative", serif', fontSize: 48, fontWeight: 900,
          color: '#f5c451', letterSpacing: '0.2em',
          textShadow: '0 0 30px #f5c451',
          animation: 'boomPop 350ms cubic-bezier(0.2, 1.6, 0.5, 1)',
        }}>TARGET BEAT</div>
      )}
      {stamp === 'bail' && (
        <div style={{
          position: 'absolute', top: '32%',
          fontFamily: '"Cinzel Decorative", serif', fontSize: 48, fontWeight: 900,
          color: '#ff4d6d', letterSpacing: '0.2em',
          textShadow: '0 0 30px #ff4d6d',
          animation: 'boomPop 350ms cubic-bezier(0.2, 1.6, 0.5, 1)',
        }}>NOT ENOUGH</div>
      )}
      {boom && (
        <div className="f-mono num" style={{
          fontSize: 96, fontWeight: 700,
          color: boom.gold ? '#f5c451' : '#fff',
          textShadow: boom.gold
            ? '0 0 40px #f5c451, 0 0 80px rgba(245,196,81,0.5)'
            : '0 0 40px #7be3ff, 0 0 80px rgba(123,227,255,0.5)',
          animation: 'boomPop 400ms cubic-bezier(0.2, 1.4, 0.5, 1)',
        }}>
          {boom.total.toLocaleString()}
        </div>
      )}
    </div>
  );
}
