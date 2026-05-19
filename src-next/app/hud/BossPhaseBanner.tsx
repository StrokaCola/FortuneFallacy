// Boss Phase Escalation (Pillar B) — banner that fires when the active
// boss promotes to phase 2 mid-blind. Surfaces the boss's secondWind
// flavor line and the new/removed debuffs so the player gets a clear
// "the rules just changed" beat. Self-dismisses after 3.6s.
//
// Visually distinct from HotStreakBanner (ember red, "three in a row")
// and BossReveal (full-screen ritual). This is a center-stage flash
// that uses the boss's accent color and an inset frame instead of
// taking over the canvas.

import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { Z } from './zLayers';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import { BOSS_BLINDS } from '../../data/blinds';
import { triggerShake } from '../visual/screenShake';

const SHOW_MS = 3600;
// Brief input-shield window. The banner itself stays on-screen for
// SHOW_MS, but pointer input is absorbed for the first INPUT_GATE_MS
// so the player gets a beat to absorb the rule change instead of
// getting their pending roll/score dispatched mid-banner-entry. Tuned
// to the `--savored` design token in styles/index.css.
const INPUT_GATE_MS = 600;

type Banner = {
  blindId: string;
  flavor: string;
  addedDebuffs: string[];
  removedDebuffs: string[];
};

export function BossPhaseBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const tight = useIsTightStage();

  useEffect(() => {
    const off = bus.on('onBossSecondWind', (payload) => {
      setBanner(payload);
      setGateOpen(true);
      sfxPlay('multSlam', { freq: 380, gain: 1.15 });
      window.setTimeout(() => sfxPlay('bossSting', { gain: 0.6 }), 140);
      triggerShake('big');
      playHaptic('clear');
      window.setTimeout(() => setGateOpen(false), INPUT_GATE_MS);
      window.setTimeout(() => setBanner(null), SHOW_MS);
    });
    // Wave T (Batch E) — phase-2 incoming telegraph. Brief screen-edge
    // crimson pulse + the listener stub so audioBridge's whisperChime
    // and duck land alongside a visible cue. 900ms total, then the
    // class lifts so the cosmos tint returns to normal.
    const offIncoming = bus.on('onBossPhase2Incoming', () => {
      if (typeof document === 'undefined') return;
      const stage = document.getElementById('stage-root');
      if (!stage) return;
      stage.classList.add('boss-phase-incoming');
      window.setTimeout(() => stage.classList.remove('boss-phase-incoming'), 900);
    });
    return () => { off(); offIncoming(); };
  }, []);

  if (!banner) return null;
  const def = BOSS_BLINDS.find((b) => b.id === banner.blindId);
  const color = def?.color ?? '#e2334a';
  const isSoftened = banner.removedDebuffs.length > 0 && banner.addedDebuffs.length === 0;

  return (
    <>
      {/* Input-absorbing shield. Transparent, sits over the play surface
          for INPUT_GATE_MS so the player can't dispatch a roll/score
          while the banner is sliding in and the new rule is being
          read. Removed when gateOpen flips false. */}
      {gateOpen && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            zIndex: Z.bannerBoss - 1,
            pointerEvents: 'auto',
            background: 'transparent',
            cursor: 'wait',
          }}
        />
      )}
    {/* Wave T (Batch D) — escalation flare. Single 700ms radial burst
        at banner center on phase-2 entry so the moment lands as a
        visible pulse, not just a banner slide-in. Soft style on
        relent (boss softens) so the player reads the tone-shift
        visually before they read the text. */}
    <div
      aria-hidden
      className="boss-phase-flare"
      style={{
        position: 'absolute',
        top: tight
          ? 'calc(var(--hud-top-h, 0px) + (var(--stage-h, 100vh) - var(--hud-top-h, 0px) - var(--hud-bottom-h, 0px)) * 0.22)'
          : '26%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: Z.bannerBoss - 1,
        pointerEvents: 'none',
        width: 320, height: 320,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}aa 0%, ${color}55 28%, ${color}11 55%, transparent 75%)`,
        opacity: 0,
        animation: 'boss-phase-flare 700ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards',
        mixBlendMode: 'screen',
      }}
    />
    <div
      aria-hidden
      className="boss-phase-banner"
      style={{
        position: 'absolute',
        top: tight
          ? 'calc(var(--hud-top-h, 0px) + (var(--stage-h, 100vh) - var(--hud-top-h, 0px) - var(--hud-bottom-h, 0px)) * 0.22)'
          : '26%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: Z.bannerBoss,
        pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        animation: `hot-streak-in 380ms cubic-bezier(0.2, 1.2, 0.4, 1) both, hot-streak-out 600ms ease-in ${SHOW_MS - 600}ms both`,
      }}
    >
      <div className="f-mono uc" style={{
        fontSize: 11, letterSpacing: '0.5em',
        color,
        textShadow: `0 0 14px ${color}cc`,
      }}>
        ◇ {isSoftened ? 'the boss relents' : 'second wind'} ◇
      </div>
      <div className="f-display" style={{
        fontSize: tight ? 'clamp(24px, 6vw, 38px)' : 'clamp(30px, 7vw, 54px)',
        color: isSoftened ? '#f5c451' : '#f3f0ff',
        letterSpacing: '0.16em',
        textShadow: `0 0 30px ${color}dd, 0 0 60px ${color}55`,
        fontWeight: 900,
      }}>
        {def?.name?.toUpperCase() ?? 'PHASE TWO'}
      </div>
      <div style={{
        fontFamily: '"Exo 2", sans-serif',
        fontSize: tight ? 12 : 14,
        color: '#f3f0ff',
        fontStyle: 'italic',
        textAlign: 'center',
        textShadow: '0 0 8px rgba(0,0,0,0.65)',
        maxWidth: '80%',
        padding: '0 12px',
      }}>
        "{banner.flavor}"
      </div>
    </div>
    </>
  );
}
