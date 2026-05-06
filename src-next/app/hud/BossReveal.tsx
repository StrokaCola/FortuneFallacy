import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { BOSS_BLINDS } from '../../data/blinds';
import { BossSigil } from '../visual/BossSigil';
import { OrnateFrame } from '../visual/OrnateFrame';
import { sfxPlay } from '../../audio/sfx';
import { triggerShake } from '../visual/screenShake';
import { Z } from './zLayers';

type Reveal = { id: string; ts: number; ante: number };

export function BossReveal() {
  const [reveal, setReveal] = useState<Reveal | null>(null);
  // Hold every timer so the auto-dismiss + secondary stings can be
  // cleared if the player taps to skip or the component unmounts.
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
  };

  const dismiss = () => {
    clearTimers();
    setReveal(null);
  };

  useEffect(() => {
    const off = bus.on('onBossRevealed', ({ blindId, ante }) => {
      setReveal({ id: blindId, ts: Date.now(), ante });
      sfxPlay('sigilDraw');
      triggerShake('big');
      const sting1 = setTimeout(() => sfxPlay('sigilDraw'), 350);
      const sting2 = setTimeout(() => sfxPlay('sigilDraw'), 700);
      const auto   = setTimeout(() => dismiss(), 3200);
      timersRef.current.add(sting1);
      timersRef.current.add(sting2);
      timersRef.current.add(auto);
    });
    return () => { off(); clearTimers(); };
    // dismiss is stable (no deps), eslint-disable for the empty array.
  }, []);

  useEffect(() => {
    if (!reveal) return;
    const onKey = () => dismiss();
    window.addEventListener('keydown', onKey, { once: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [reveal]);

  if (!reveal) return null;
  const def = BOSS_BLINDS.find((b) => b.id === reveal.id);
  if (!def) return null;
  const anomalyIdx = BOSS_BLINDS.findIndex((b) => b.id === reveal.id) + 1;

  return (
    <div
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={`Boss revealed: ${def.name}. Tap to continue.`}
      style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        pointerEvents: 'auto', zIndex: Z.bannerBoss,
        background: 'rgba(7,5,26,0.65)',
        animation: 'fadein 0.4s ease-out',
        cursor: 'pointer',
      }}>
      <div style={{
        width: 440, height: 600, position: 'relative',
        animation: 'float-y 4s ease-in-out infinite',
      }}>
        <div className="panel-strong" style={{
          width: '100%', height: '100%', padding: 28,
          border: `2px solid ${def.color}`,
          boxShadow: `0 0 60px ${def.color}66, 0 30px 80px rgba(0,0,0,0.7)`,
          background: `linear-gradient(180deg, ${def.color}15, rgba(15,9,37,0.95))`,
          position: 'relative',
        }}>
          <OrnateFrame style={{ width: '100%', height: '100%' }} color={def.color}>
            <div style={{
              position: 'absolute', inset: 24,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div className="f-mono uc" style={{
                fontSize: 10, letterSpacing: '0.5em', color: '#e2334a', marginTop: 12,
              }}>
                final trial
              </div>
              <div style={{ width: 36, height: 1, background: def.color, marginTop: 8, opacity: 0.6 }} />

              <div style={{
                marginTop: 20,
                filter: `drop-shadow(0 0 30px ${def.color}cc)`,
                lineHeight: 1,
              }}>
                <BossSigil boss={def} size={180} animate="both" glow />
              </div>

              <div className="f-display" style={{
                fontSize: 28, color: '#f3f0ff', marginTop: 16, textAlign: 'center',
                opacity: 0,
                animation: 'fadein 600ms ease-out 1300ms both',
              }}>
                {def.name}
              </div>
              <div className="f-mono uc" style={{
                fontSize: 10, letterSpacing: '0.32em', color: def.color, marginTop: 6,
                opacity: 0,
                animation: 'fadein 600ms ease-out 1500ms both',
              }}>
                anomaly {String(anomalyIdx).padStart(2, '0')} · ante {reveal.ante}
              </div>

              <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '20px 0' }} />

              <div className="f-mono uc" style={{
                fontSize: 9, letterSpacing: '0.3em', color: '#bba8ff',
                opacity: 0, animation: 'fadein 500ms ease-out 1800ms both',
              }}>
                effect
              </div>
              <div style={{
                fontFamily: '"Exo 2", sans-serif',
                fontSize: 14, color: '#f3f0ff', marginTop: 6,
                textAlign: 'center', fontStyle: 'italic',
                opacity: 0, animation: 'fadein 600ms ease-out 2000ms both',
              }}>
                "{def.description}"
              </div>
            </div>
          </OrnateFrame>
        </div>
      </div>
    </div>
  );
}
