// One-shot easter-egg modal that fires the first time the player
// enters Void Mode (clicks the title-screen black hole). Dismisses on
// the "Step Through" button, Escape, or backdrop click. Sets
// meta.onboarding.seenVoidEasterEgg = true so it never re-shows after
// dismissal — even across runs.
//
// Visually scoped to the void palette (violet/gold accents, Cinzel
// header) so the modal reads as part of the alt-mode aesthetic rather
// than the normal-game chrome.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { dispatch } from '../../actions/dispatch';
import { Z } from '../hud/zLayers';
import { useStore } from '../../state/store';
import type { GameState } from '../../state/store';
import { useModalExit } from '../hooks/useModalExit';
import { useFocusTrap } from '../hud/useFocusTrap';

// Gate: only render when the player is currently in void mode AND
// hasn't already seen + dismissed the easter-egg modal. The flag
// flips on DISMISS_VOID_ONBOARDING; persistence rehydrates it so the
// modal stays dismissed across browser refreshes.
const selectOpen = (s: GameState): boolean =>
  s.run.mode === 'void' && !(s.meta.onboarding?.seenVoidEasterEgg ?? false);

const selectSeed = (s: GameState): number => s.run.voidSeed ?? 0;
const selectAlias = (s: GameState): string => s.run.runAlias ?? '';

export function VoidOnboarding() {
  const open = useStore(selectOpen);
  const voidSeed = useStore(selectSeed);
  const runAlias = useStore(selectAlias);
  const { rendered, exiting } = useModalExit(open, 200);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(wrapRef, open && !exiting);

  useEffect(() => {
    if (!open) return;
    // Focus the dismiss button so keyboard players can hit Enter to close.
    buttonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'DISMISS_VOID_ONBOARDING' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!rendered) return null;

  const onDismiss = () => {
    dispatch({ type: 'DISMISS_VOID_ONBOARDING' });
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only fire when the click lands on the backdrop itself, not a
    // child (so clicks inside the modal panel don't accidentally
    // close it).
    if (e.target === e.currentTarget) onDismiss();
  };

  // Footer caption — hex-formatted seed so it reads as a fingerprint
  // rather than a decimal number. Falls back gracefully when the seed
  // or alias is missing (e.g. legacy save mid-rehydrate).
  const seedHex = voidSeed
    ? `0x${(voidSeed >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
    : '—';
  const aliasLabel = runAlias || '—';

  const portalRoot = (typeof document !== 'undefined'
    ? document.getElementById('stage-root') ?? document.body
    : null);
  if (!portalRoot) return null;

  const node = (
    <div
      data-testid="void-onboarding"
      onClick={onBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: Z.overlay,
        background: 'rgba(5, 3, 18, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid', placeItems: 'center',
        animation: exiting
          ? 'modalFadeOut var(--modal-out, 160ms) ease-in forwards'
          : 'fadein var(--modal-in, 220ms) var(--ease-modal, ease-out)',
        padding: 16,
      }}
    >
      <div
        ref={wrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="void-onboard-title"
        style={{
          width: '100%',
          maxWidth: 520,
          // Deep violet wash with a thin gold rim — keeps the modal
          // chrome inside the void palette so it doesn't break the
          // scene's mood.
          background:
            'linear-gradient(180deg, rgba(28,18,69,0.96), rgba(7,5,26,0.97))',
          border: '1px solid rgba(167,139,250,0.45)',
          boxShadow:
            '0 24px 64px rgba(0,0,0,0.6), 0 0 48px rgba(167,139,250,0.18), 0 0 96px rgba(245,196,81,0.08)',
          borderRadius: 16,
          padding: '32px 28px 24px',
          color: '#f3f0ff',
          textAlign: 'center',
          // Cinzel-driven header pull below; modal body keeps the
          // default Exo 2 weight.
          fontFamily: "'Exo 2', system-ui, sans-serif",
          // Brief scale-in so the modal feels like it materialises out
          // of the void rather than popping in.
          transformOrigin: '50% 40%',
          animation: exiting ? undefined : 'voidOnboardEnter 320ms cubic-bezier(0.25,0.46,0.2,1.0)',
        }}
      >
        <style>{`
          @keyframes voidOnboardEnter {
            0%   { opacity: 0; transform: scale(0.92); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
        <div className="f-mono uc" style={{
          fontSize: 10, letterSpacing: '0.42em',
          color: '#a78bfa', marginBottom: 16,
          textShadow: '0 0 12px rgba(167,139,250,0.4)',
        }}>
          ◇ easter egg ◇
        </div>
        <h2
          id="void-onboard-title"
          style={{
            fontFamily: "'Cinzel', serif",
            fontWeight: 600,
            fontSize: 28,
            letterSpacing: '0.04em',
            color: '#f3f0ff',
            margin: '0 0 14px',
            textShadow: '0 0 24px rgba(245,196,81,0.25)',
          }}
        >
          You found the Void
        </h2>
        <p style={{
          fontSize: 14, lineHeight: 1.65,
          color: '#dcd4ff', margin: '0 0 22px',
          maxWidth: 420, marginInline: 'auto',
        }}>
          Past the curtain of probability, the dice play themselves
          differently here.
        </p>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 26px',
            textAlign: 'left',
            display: 'grid',
            gap: 10,
            color: '#dcd4ff',
            fontSize: 13,
            lineHeight: 1.5,
            maxWidth: 460,
            marginInline: 'auto',
          }}
        >
          {[
            'Every catalyst and consumable rolls with procedurally generated affixes — prefix + suffix — that modify their behavior.',
            'Trial blinds carry generated rules that can ban combos, raise reroll cost, or warp scoring.',
            'Boss sigils are unique to your seed — no two runs see the same shape.',
            'The aesthetic shifts to match the void: violet/cosmic palette, accretion ring, gravitational lensing.',
            'Nothing carries between Void runs — refresh and you’re back to the normal cosmos.',
          ].map((line, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span aria-hidden="true" style={{
                color: '#f5c451',
                flex: '0 0 auto',
                fontSize: 11,
                lineHeight: 1.5,
                textShadow: '0 0 8px rgba(245,196,81,0.45)',
              }}>◇</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <button
          ref={buttonRef}
          className="btn btn-primary tap"
          onClick={onDismiss}
          style={{
            minHeight: 52,
            padding: '0 24px',
            fontSize: 14,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            fontFamily: "'JetBrains Mono', monospace",
            width: '100%',
            maxWidth: 280,
            marginInline: 'auto',
            display: 'block',
          }}
        >
          Step Through
        </button>
        <div
          className="f-mono uc"
          style={{
            marginTop: 18,
            fontSize: 9,
            letterSpacing: '0.32em',
            color: 'rgba(187,168,255,0.55)',
          }}
        >
          seed: {seedHex} · alias: {aliasLabel}
        </div>
      </div>
    </div>
  );

  return createPortal(node, portalRoot);
}
