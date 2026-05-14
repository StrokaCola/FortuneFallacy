import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { BOSS_BLINDS, BOSS_CINEMATIC_FLAVOR } from '../../data/blinds';
import { BossSigil } from '../visual/BossSigil';
import { OrnateFrame } from '../visual/OrnateFrame';
import { sfxPlay } from '../../audio/sfx';
import { triggerShake } from '../visual/screenShake';
import { audioEngine } from '../../audio/AudioEngine';
import { DUCK_PRESETS } from '../../audio/duckEnvelope';
import { Z } from './zLayers';

type RevealPhase = 'dread' | 'reveal';
type Reveal = { id: string; ts: number; ante: number; phase: RevealPhase };

// "Void approaches" pre-reveal — the music ducks, the screen darkens
// from the edges inward, and a low drone sting plays. Then the full
// reveal panel slams in. Tuned tight (1100ms) so the boss anticipation
// hits without slowing the loop too far. See plan §5.2.
const DREAD_DURATION_MS = 1100;

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
      // Phase 1: void approaches. Darken edges, duck music, low drone.
      // The reveal panel itself doesn't render yet — the screen
      // becomes a frame of dread before the boss lands.
      setReveal({ id: blindId, ts: Date.now(), ante, phase: 'dread' });
      audioEngine.duck(DUCK_PRESETS.holdBreath(DREAD_DURATION_MS));
      sfxPlay('bossSting');

      const dreadEnd = setTimeout(() => {
        // Phase 2: actual reveal. Slam in with the existing sigil
        // sequence on top of the established mood.
        setReveal((cur) => cur ? { ...cur, phase: 'reveal' } : null);
        sfxPlay('sigilDraw');
        triggerShake('big');
      }, DREAD_DURATION_MS);
      const sting1 = setTimeout(() => sfxPlay('sigilDraw'), DREAD_DURATION_MS + 350);
      const sting2 = setTimeout(() => sfxPlay('sigilDraw'), DREAD_DURATION_MS + 700);
      const auto   = setTimeout(() => dismiss(), DREAD_DURATION_MS + 3200);
      timersRef.current.add(dreadEnd);
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

  // Phase 1: dread. Edges darken inward; sigil silhouettes faintly in
  // the center. Player can still tap to skip ahead to the panel.
  if (reveal.phase === 'dread') {
    return (
      <div
        onClick={() => {
          // Skipping the dread → jump to reveal phase immediately.
          setReveal((cur) => cur ? { ...cur, phase: 'reveal' } : null);
        }}
        role="presentation"
        aria-hidden
        className="boss-dread-overlay"
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'auto', zIndex: Z.bannerBoss,
          cursor: 'pointer',
        }}>
        {/* Boss-sting flash — fires in sync with the bossSting SFX cue.
            A brief crimson-tinted white flash punches the moment the
            sting hits so the audio + visual land as one beat. Fades
            back out by 220ms so the dread vignette takes over. */}
        <div className="boss-sting-flash" style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at center, ${def.color}aa 0%, ${def.color}33 30%, transparent 70%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }} />
        <div className="boss-dread-vignette" style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at center, transparent 0%, transparent 35%, rgba(3,2,12,0.85) 75%, ${def.color}55 100%)`,
        }} />
        <div className="boss-dread-silhouette" style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center',
          opacity: 0.18,
          filter: `drop-shadow(0 0 24px ${def.color}88)`,
        }}>
          <BossSigil boss={def} size={240} animate="none" glow />
        </div>
        <div className="f-mono uc boss-dread-label" style={{
          position: 'absolute',
          left: '50%', bottom: '12%',
          transform: 'translateX(-50%)',
          fontSize: 11, letterSpacing: '0.5em',
          color: def.color,
          textShadow: `0 0 16px ${def.color}99`,
          opacity: 0,
        }}>
          ◇ {BOSS_CINEMATIC_FLAVOR[def.id] ?? 'something approaches'} ◇
        </div>
      </div>
    );
  }

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
        // Cap to viewport so the reveal panel never overflows on
        // landscape phones; preserves the original 440×600 on desktop.
        width: 'min(440px, calc(100vw - 32px))',
        // 100dvh tracks the visible viewport on mobile browsers.
        height: 'min(600px, calc(100dvh - 32px))',
        position: 'relative',
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
