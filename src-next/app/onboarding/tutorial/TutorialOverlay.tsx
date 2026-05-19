// Tutorial bubble — anchored to a `data-coach` element, renders the
// active step's copy with mentor styling and a "Got it" affordance for
// click-advance steps. Borrows the rAF re-measure pattern from
// Coachmark.tsx so the bubble locks onto the anchor's post-mount layout.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { dispatch } from '../../../actions/dispatch';
import { Z } from '../../hud/zLayers';
import { useIsTightStage } from '../../hooks/useIsCompactStage';
import type { TutorialStep } from './tutorialScript';

type Rect = { top: number; left: number; width: number; height: number };

function readAnchorRect(anchor: string): Rect | null {
  const el = document.querySelector(`[data-coach="${anchor}"]`);
  if (!el) return null;
  const r = (el as HTMLElement).getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function rectsEqual(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

// Parse inline **bold** markers in the step copy. Renders as a flat
// React.Fragment array so the bubble can apply a stronger weight on
// the named mechanic without forcing the script to author JSX.
function renderBoldedText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: '#f5c451', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function TutorialOverlay({ step, exiting = false }: { step: TutorialStep; exiting?: boolean }) {
  const tight = useIsTightStage();
  const [rect, setRect] = useState<Rect | null>(() => readAnchorRect(step.anchor));

  useEffect(() => {
    let raf = 0;
    let ticks = 0;
    let lastRect: Rect | null = null;
    const apply = (next: Rect | null) => {
      if (rectsEqual(lastRect, next)) return;
      lastRect = next;
      setRect(next);
    };
    const tick = () => {
      const next = readAnchorRect(step.anchor);
      if (next) apply(next);
      ticks++;
      if (ticks < 30) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onResize = () => apply(readAnchorRect(step.anchor));
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [step.anchor]);

  if (!rect) return null;

  const BUBBLE_W = 300;
  const ARROW = 10;
  const GAP = 14;

  const anchorCenterX = rect.left + rect.width / 2;
  const rawLeft = anchorCenterX - BUBBLE_W / 2;
  const left = Math.max(8, Math.min(window.innerWidth - BUBBLE_W - 8, rawLeft));

  const placeAbove = step.side === 'above';
  const top = placeAbove ? rect.top - GAP - 1 : rect.top + rect.height + GAP;
  const arrowX = Math.max(16, Math.min(BUBBLE_W - 16, anchorCenterX - left));

  const portalRoot = document.getElementById('stage-root') ?? document.body;
  const showGotIt = step.advance.kind === 'click';

  const onGotIt = () => dispatch({ type: 'ADVANCE_TUTORIAL' });
  const onEnd = () => dispatch({ type: 'END_TUTORIAL', reason: 'skipped' });

  const bubble = (
    <div
      role="dialog"
      aria-label="Tutorial hint"
      style={{
        position: 'fixed',
        left,
        top: placeAbove ? undefined : top,
        bottom: placeAbove ? window.innerHeight - top : undefined,
        width: BUBBLE_W,
        background: 'linear-gradient(180deg, rgba(32,22,80,0.97), rgba(10,5,32,0.97))',
        border: '1px solid rgba(245,196,81,0.6)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.55), 0 0 32px rgba(245,196,81,0.22)',
        borderRadius: 12,
        padding: 14,
        color: '#f3f0ff',
        zIndex: Z.orientation,
        pointerEvents: exiting ? 'none' : 'auto',
        animation: exiting
          ? 'modalFadeOut 160ms ease-in forwards'
          : 'fadein 200ms ease-out',
        maxHeight: '60vh',
        overflow: 'hidden',
      }}
    >
      <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#f5c451', marginBottom: 6 }}>
        ⟡ guided tour
      </div>
      <div style={{ fontSize: tight ? 12 : 13, lineHeight: 1.5, marginBottom: 12 }}>
        {renderBoldedText(step.text)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <button
          className="tap"
          onClick={onEnd}
          style={{
            background: 'transparent', border: 'none', color: '#9577ff',
            fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer', padding: '6px 4px',
          }}
        >
          End tour
        </button>
        {showGotIt && (
          <button
            className="btn btn-primary tap"
            onClick={onGotIt}
            style={{ minHeight: 36, padding: '0 16px' }}
          >
            Got it
          </button>
        )}
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: arrowX - ARROW,
          top: placeAbove ? '100%' : -ARROW * 2,
          width: 0,
          height: 0,
          borderLeft: `${ARROW}px solid transparent`,
          borderRight: `${ARROW}px solid transparent`,
          borderTop: placeAbove ? `${ARROW}px solid rgba(245,196,81,0.6)` : 'none',
          borderBottom: placeAbove ? 'none' : `${ARROW}px solid rgba(245,196,81,0.6)`,
        }}
      />
    </div>
  );

  return createPortal(bubble, portalRoot);
}
