// Wave T+1 (2026-05-19) Scoring Architecture — ComboFlash.
//
// Listens for the `combo-detect` beat (fired right after cast-swell)
// and briefly flashes the combo name + base values above the dice so
// the player reads WHICH hand they played before any dice tick.
// Tutorial value: scoring sequences become legible — "Three of a
// Kind detected" → dice ticking → +20 pips combo bonus → catalyst
// fires → final boom. The flash anchors the rest of the sequence.

import { useEffect, useState } from 'react';
import { bus } from '../../../events/bus';
import { Z } from '../zLayers';

type Flash = {
  comboLabel: string;
  baseChips: number;
  baseMult: number;
};

// Wave T+1 (2026-05-19) UX loop 2 — combo flash now lives the WHOLE
// scoring sequence (combo-detect → boom/bail), not just 1200ms. After
// the initial dramatic entrance the flash transitions to a quieter
// persistent label so the player can always answer "what hand am I
// looking at?" while the catalyst chain plays out. Auto-fades on the
// next cast-swell or after boom/bail finalization.
const ENTRANCE_MS = 1100;
const POST_BOOM_FADE_MS = 1000;

export function ComboFlash() {
  const [flash, setFlash] = useState<Flash | null>(null);
  const [stage, setStage] = useState<'entrance' | 'persistent' | 'fading'>('entrance');

  useEffect(() => {
    let entranceTimer: number | null = null;
    let fadeTimer: number | null = null;
    const clearTimers = () => {
      if (entranceTimer !== null) clearTimeout(entranceTimer);
      if (fadeTimer !== null) clearTimeout(fadeTimer);
      entranceTimer = fadeTimer = null;
    };
    const off = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'combo-detect') {
        clearTimers();
        setFlash({
          comboLabel: beat.comboLabel,
          baseChips: beat.baseChips,
          baseMult: beat.baseMult,
        });
        setStage('entrance');
        // After entrance animation finishes, demote to persistent
        // (smaller, quieter — sits as identity tag while sequence plays).
        entranceTimer = window.setTimeout(() => setStage('persistent'), ENTRANCE_MS);
        return;
      }
      if (beat.kind === 'cast-swell') {
        clearTimers();
        setFlash(null);
        setStage('entrance');
        return;
      }
      if (beat.kind === 'boom' || beat.kind === 'bail') {
        // Final fade after the boom/bail celebration completes.
        clearTimers();
        setStage('fading');
        fadeTimer = window.setTimeout(() => setFlash(null), POST_BOOM_FADE_MS);
      }
    });
    return () => {
      off();
      clearTimers();
    };
  }, []);

  if (!flash) return null;
  return (
    <div
      aria-hidden
      className={`theater-combo-flash theater-combo-flash--${stage}`}
      style={{
        position: 'absolute',
        left: '50%',
        // Wave T+1 (2026-05-19) responsive UI pass — anchor below the
        // scoreboard normally (+220 from --hud-top-h), but clamp so
        // the bottom never overflows on short viewports (mobile
        // landscape ~375h). At 375vh the +220 offset pushed bottom
        // off-screen; min() caps the offset so it never reaches
        // within 80px of the viewport bottom.
        top: 'min(calc(var(--hud-top-h, 134px) + 220px), calc(100vh - 100px))',
        transform: 'translateX(-50%)',
        zIndex: Z.bannerBoss - 1,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {/* Halo only renders during the dramatic entrance and dim
          slightly during persistent so it doesn't fight the upgrade
          tracers / floaters for attention. */}
      {stage !== 'fading' && (
        <div
          aria-hidden
          className="theater-combo-halo"
          style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: stage === 'entrance' ? 320 : 220,
            height: stage === 'entrance' ? 100 : 60,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(245, 196, 81, 0.22) 0%, rgba(255, 120, 71, 0.10) 40%, transparent 70%)',
            filter: 'blur(8px)',
            opacity: stage === 'entrance' ? 1 : 0.45,
            transition: 'opacity 280ms ease-out, width 320ms ease-out, height 320ms ease-out',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        className="f-mono uc"
        style={{
          fontSize: 9,
          letterSpacing: '0.42em',
          color: '#bba8ff',
          textShadow: '0 0 8px rgba(187, 168, 255, 0.6)',
        }}
      >
        ◇ combo ◇
      </div>
      <div
        className="f-display"
        style={{
          fontSize: 'clamp(18px, 3.4vw, 26px)',
          color: '#f3f0ff',
          letterSpacing: '0.14em',
          textShadow: '0 0 18px rgba(255, 217, 122, 0.7), 0 0 6px rgba(255, 217, 122, 0.9)',
          fontWeight: 800,
          lineHeight: 1.1,
        }}
      >
        {flash.comboLabel}
      </div>
      {/* Wave T+1 (2026-05-19) clarity pass — sub-line "+N pips · ×M
          mult" only renders during the entrance stage. Once demoted
          to persistent identity tag, the line dropped (the player can
          already read the live PIPS × MULT panel below the flash). */}
      {stage === 'entrance' && (
        <div
          className="f-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            color: '#7be3ff',
            opacity: 0.8,
          }}
        >
          +{flash.baseChips} pips · ×{flash.baseMult} mult
        </div>
      )}
    </div>
  );
}
