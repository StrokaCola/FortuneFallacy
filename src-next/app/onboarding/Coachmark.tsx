// Anchored coachmark UI. Looks up its anchor by `data-coach="<id>"`,
// positions a small text bubble above or below it, and exposes "Got it"
// (mark seen) and "Skip tutorial" (dismiss all). Re-measures on resize.
//
// Mounted by CoachmarkController.tsx — this component is "dumb": given an
// active CoachmarkDef, render the bubble.
//
// Portaled to #stage-root so the bubble escapes #next-root's stacking
// context (z-index: 2) and stacks above #three-next (z-index: 3, the
// dice canvas). Without the portal the bubble's inline z-index is
// trapped inside next-root and gets covered by the dice.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { dispatch } from '../../actions/dispatch';
import type { CoachmarkDef } from './coachmarks';

type Rect = { top: number; left: number; width: number; height: number };

function readAnchorRect(anchor: string): Rect | null {
  const el = document.querySelector(`[data-coach="${anchor}"]`);
  if (!el) return null;
  const r = (el as HTMLElement).getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Coachmark({ def }: { def: CoachmarkDef }) {
  const [rect, setRect] = useState<Rect | null>(() => readAnchorRect(def.anchor));

  useEffect(() => {
    // Re-measure on a short interval initially so the anchor's
    // post-mount layout is captured (some elements settle a frame or two
    // after first paint when their content streams in).
    let raf = 0;
    let ticks = 0;
    const tick = () => {
      const next = readAnchorRect(def.anchor);
      if (next) setRect(next);
      ticks++;
      if (ticks < 30) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onResize = () => setRect(readAnchorRect(def.anchor));
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [def.anchor]);

  if (!rect) return null;

  const BUBBLE_W = 280;
  const ARROW = 10;
  const GAP = 14;

  // Center horizontally over the anchor, clamped to viewport.
  const anchorCenterX = rect.left + rect.width / 2;
  const rawLeft = anchorCenterX - BUBBLE_W / 2;
  const left = Math.max(8, Math.min(window.innerWidth - BUBBLE_W - 8, rawLeft));

  // For 'above': bubble bottom = anchor top - GAP. For 'below': bubble top = anchor bottom + GAP.
  const placeAbove = def.side === 'above';
  const top = placeAbove
    ? rect.top - GAP - 1 // bubble's bottom is here
    : rect.top + rect.height + GAP;

  // Arrow x relative to bubble: centered on anchor, clamped within bubble.
  const arrowX = Math.max(16, Math.min(BUBBLE_W - 16, anchorCenterX - left));

  // Portal target — fall back to body if #stage-root is missing (tests).
  const portalRoot = document.getElementById('stage-root') ?? document.body;

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
        background: 'linear-gradient(180deg, rgba(28,18,69,0.96), rgba(8,4,28,0.96))',
        border: '1px solid rgba(123,227,255,0.55)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 28px rgba(123,227,255,0.25)',
        borderRadius: 12,
        padding: 14,
        color: '#f3f0ff',
        zIndex: 200,
        pointerEvents: 'auto',
        animation: 'fadein 200ms ease-out',
      }}
    >
      <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#7be3ff', marginBottom: 6 }}>
        ⟡ a hint
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, marginBottom: 12 }}>
        {def.text}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <button
          className="tap"
          onClick={() => dispatch({ type: 'SKIP_ONBOARDING' })}
          style={{
            background: 'transparent', border: 'none', color: '#9577ff',
            fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer', padding: '6px 4px',
          }}
        >
          Skip tutorial
        </button>
        <button
          className="btn btn-primary tap"
          onClick={() => dispatch({ type: 'SEE_COACHMARK', id: def.id })}
          style={{ minHeight: 36, padding: '0 16px' }}
        >
          Got it
        </button>
      </div>

      {/* Arrow pointing at the anchor */}
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
          borderTop: placeAbove ? `${ARROW}px solid rgba(123,227,255,0.55)` : 'none',
          borderBottom: placeAbove ? 'none' : `${ARROW}px solid rgba(123,227,255,0.55)`,
        }}
      />
    </div>
  );

  return createPortal(bubble, portalRoot);
}
