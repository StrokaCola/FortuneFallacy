// One-time opt-in modal that interposes between NEW_RUN and the first
// blind. Mounts when tutorial.optInPending && meta.onboarding.firstLaunch.
// Yes → START_TUTORIAL + auto-START_BLIND. No → DISMISS_OPT_IN + auto-START_BLIND.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { dispatch } from '../../../actions/dispatch';
import { Z } from '../../hud/zLayers';
import { useStore } from '../../../state/store';
import type { GameState } from '../../../state/store';
import { useModalExit } from '../../hooks/useModalExit';
import { useFocusTrap } from '../../hud/useFocusTrap';

const selectOpen = (s: GameState): boolean =>
  s.tutorial.optInPending && (s.meta.onboarding.firstLaunch ?? false);

export function TutorialOptInModal() {
  const open = useStore(selectOpen);
  const { rendered, exiting } = useModalExit(open, 180);
  const yesRef = useRef<HTMLButtonElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(wrapRef, open && !exiting);

  useEffect(() => {
    if (!open) return;
    // Focus the recommended action so keyboard players can hit Enter.
    yesRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onNo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onYes = () => {
    dispatch({ type: 'START_TUTORIAL' });
    // Skip the Hub and drop straight into the round so the scripted
    // first roll lines up with the tour bubble's opening line.
    dispatch({ type: 'START_BLIND' });
  };

  const onNo = () => {
    dispatch({ type: 'DISMISS_OPT_IN' });
  };

  if (!rendered) return null;

  const portalRoot = document.getElementById('stage-root') ?? document.body;

  const node = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: Z.overlay,
        background: 'rgba(8, 5, 20, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'grid', placeItems: 'center',
        animation: exiting
          ? 'modalFadeOut var(--modal-out, 140ms) ease-in forwards'
          : 'fadein var(--modal-in, 200ms) var(--ease-modal, ease-out)',
        padding: 16,
      }}
    >
      <div
        ref={wrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tut-optin-title"
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'linear-gradient(180deg, rgba(32,20,82,0.96), rgba(12,6,36,0.96))',
          border: '1px solid rgba(245,196,81,0.5)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 36px rgba(245,196,81,0.22)',
          borderRadius: 16,
          padding: '28px 24px 22px',
          color: '#f3f0ff',
          textAlign: 'center',
        }}
      >
        <div className="f-mono uc" style={{
          fontSize: 10, letterSpacing: '0.42em', color: '#f5c451', marginBottom: 14,
        }}>
          ◇ a quick tour? ◇
        </div>
        <h2
          id="tut-optin-title"
          className="f-display"
          style={{ fontSize: 22, color: '#f3f0ff', margin: '0 0 10px', textShadow: '0 0 24px rgba(245,196,81,0.28)' }}
        >
          First time here?
        </h2>
        <p style={{
          fontSize: 13, lineHeight: 1.55,
          color: '#dcd4ff', margin: '0 0 22px', maxWidth: 360, marginInline: 'auto',
        }}>
          I can walk you through one hand and one shop visit. Two minutes, no spoilers — just so the buttons make sense.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
          <button
            ref={yesRef}
            className="btn btn-primary tap"
            onClick={onYes}
            style={{ minHeight: 52, padding: '0 18px', fontSize: 15 }}
          >
            Yes, show me
          </button>
          <button
            className="btn btn-ghost tap"
            onClick={onNo}
            style={{ minHeight: 42, padding: '0 16px', fontSize: 13 }}
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, portalRoot);
}
