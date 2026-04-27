import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { BOSS_BLINDS } from '../../data/blinds';
import { BossSigil } from '../visual/BossSigil';
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
      setTimeout(() => setReveal(null), 2400);
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <div className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.5em', color: def.color, opacity: 0.85 }}>
          boss blind · arcanum {String(arcanumIdx).padStart(2, '0')}
        </div>
        <div style={{ marginTop: 10 }}>
          <BossSigil boss={def} size={220} drawIn drawDurationMs={1200} glow />
        </div>
        <div className="f-display" style={{
          fontSize: 36, color: '#f3f0ff', textAlign: 'center',
          opacity: 0,
          animation: 'fadein 600ms ease-out 1300ms both',
        }}>
          {def.name}
        </div>
        <div className="f-mono" style={{
          fontSize: 13, color: '#bba8ff', textAlign: 'center', fontStyle: 'italic', maxWidth: 360,
          opacity: 0,
          animation: 'fadein 600ms ease-out 1700ms both',
        }}>
          "{def.description}"
        </div>
      </div>
    </div>
  );
}
