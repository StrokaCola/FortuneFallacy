import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { BOSS_BLINDS } from '../../data/blinds';
import { BossSigil } from '../visual/BossSigil';
import { OrnateFrame } from '../visual/OrnateFrame';
import { sfxPlay } from '../../audio/sfx';

type Reveal = { id: string; ts: number; ante: number };

export function BossReveal() {
  const [reveal, setReveal] = useState<Reveal | null>(null);

  useEffect(() => {
    return bus.on('onBossRevealed', ({ blindId, ante }) => {
      setReveal({ id: blindId, ts: Date.now(), ante });
      sfxPlay('sigilDraw');
      setTimeout(() => sfxPlay('sigilDraw'), 350);
      setTimeout(() => sfxPlay('sigilDraw'), 700);
      setTimeout(() => setReveal(null), 3200);
    });
  }, []);

  if (!reveal) return null;
  const def = BOSS_BLINDS.find((b) => b.id === reveal.id);
  if (!def) return null;
  const arcanumIdx = BOSS_BLINDS.findIndex((b) => b.id === reveal.id) + 1;

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      pointerEvents: 'none', zIndex: 30,
      background: 'rgba(7,5,26,0.65)',
      animation: 'fadein 0.4s ease-out',
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
                boss blind
              </div>
              <div style={{ width: 36, height: 1, background: def.color, marginTop: 8, opacity: 0.6 }} />

              <div style={{
                marginTop: 20,
                filter: `drop-shadow(0 0 30px ${def.color}cc)`,
                lineHeight: 1,
              }}>
                <BossSigil boss={def} size={180} drawIn drawDurationMs={1200} glow />
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
                arcanum {String(arcanumIdx).padStart(2, '0')} · ante {reveal.ante}
              </div>

              <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '20px 0' }} />

              <div className="f-mono uc" style={{
                fontSize: 9, letterSpacing: '0.3em', color: '#bba8ff',
                opacity: 0, animation: 'fadein 500ms ease-out 1800ms both',
              }}>
                hex
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
