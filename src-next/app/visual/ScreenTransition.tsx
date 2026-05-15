import { useEffect, useRef, useState, type ReactNode } from 'react';

type Phase = 'idle' | 'exiting' | 'entering';

// 720ms is the sweet spot between "snappy" (≤600ms feels abrupt
// after the recent scoring-celebration changes) and "slow" (≥900ms
// drags on Hub ↔ Forge round-trips). Tuned with the post-boom screen
// swap in mind: the celebration finishes, the round screen lingers
// briefly, then the fade carries the player into the shop.
const SAVORED_MS = 720;
const SNAP_MS = 120;
// Outgoing scale — slightly past 1 so the leaving screen reads as
// "pulling away" instead of just dimming in place. Paired with the
// 0.98 entering scale, the effect is a soft push-out / settle-in
// rather than a static crossfade.
const EXIT_SCALE = 1.05;
const ENTER_SCALE = 0.985;

export function ScreenTransition({
  screenKey,
  children,
}: {
  screenKey: string;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [renderedKey, setRenderedKey] = useState(screenKey);
  const [renderedChildren, setRenderedChildren] = useState<ReactNode>(children);
  const lastKey = useRef(screenKey);
  const tEnterRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    if (screenKey === lastKey.current) return;
    const reduced = document.documentElement.classList.contains('reduce-motion');
    const half = reduced ? SNAP_MS : SAVORED_MS / 2;

    setPhase('exiting');
    const tExit = window.setTimeout(() => {
      lastKey.current = screenKey;
      setRenderedKey(screenKey);
      setRenderedChildren(children);
      setPhase('entering');
      tEnterRef.current = window.setTimeout(() => {
        setPhase('idle');
        tEnterRef.current = null;
      }, half);
    }, half);

    return () => {
      window.clearTimeout(tExit);
      if (tEnterRef.current !== null) {
        window.clearTimeout(tEnterRef.current);
        tEnterRef.current = null;
      }
    };
  }, [screenKey, children]);

  // Keep rendered children fresh during 'idle'
  useEffect(() => {
    if (phase === 'idle') setRenderedChildren(children);
  }, [phase, children]);

  const opacity = phase === 'exiting' ? 0 : 1;
  const scale = phase === 'exiting' ? EXIT_SCALE : phase === 'entering' ? ENTER_SCALE : 1;

  // Entering a Round is the player's commitment moment — fold in a
  // "stellar dive" overlay (inward star streaks) on top of the standard
  // constellation wipe so the descent into play has a distinct visual
  // signature vs. routine screen-to-screen swaps.
  const enteringRound = phase === 'entering' && screenKey === 'round';

  return (
    <div
      data-screen={renderedKey}
      data-phase={phase}
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        transform: `scale(${scale})`,
        transition: `opacity var(--savored, 720ms) var(--ease-savor, ease), transform var(--savored, 720ms) var(--ease-savor, ease)`,
        pointerEvents: phase === 'idle' ? 'auto' : 'none',
      }}
    >
      <ConstellationWipe phase={phase} />
      {enteringRound && <StellarDive />}
      {renderedChildren}
    </div>
  );
}

// "Stellar dive" — inward streaking-stars overlay fired when the
// player commits to a Round. 12 lines radiate from off-screen edges
// toward the center over ~500ms, signalling "the cosmos has narrowed
// onto the play table." Skipped under reduce-motion via class hook.
function StellarDive() {
  return (
    <svg
      className="stellar-dive"
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        // Each streak runs from an outer ring (radius 70) inward to a
        // center ring (radius 8). The actual collapse is done via the
        // stroke-dasharray animation in CSS so the GPU can offload it.
        const xOuter = 50 + Math.cos(angle) * 70;
        const yOuter = 50 + Math.sin(angle) * 70;
        const xInner = 50 + Math.cos(angle) * 8;
        const yInner = 50 + Math.sin(angle) * 8;
        return (
          <line
            key={i}
            className="stellar-dive-streak"
            x1={xOuter} y1={yOuter}
            x2={xInner} y2={yInner}
            stroke="#fff7e0"
            strokeWidth={0.2}
            strokeLinecap="round"
            style={{ animationDelay: `${(i * 20)}ms` }}
          />
        );
      })}
    </svg>
  );
}

function ConstellationWipe({ phase }: { phase: Phase }) {
  if (phase === 'idle') return null;
  const expand = phase === 'exiting' ? 1 : 0.5;
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: phase === 'exiting' ? 0.7 : 0.35,
        transition: 'opacity var(--savored, 720ms) var(--ease-savor, ease)',
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const len = 50 * expand;
        const x = 50 + Math.cos(angle) * len;
        const y = 50 + Math.sin(angle) * len;
        return (
          <line
            key={i}
            x1={50}
            y1={50}
            x2={x}
            y2={y}
            stroke="#7be3ff"
            strokeWidth={0.18}
            strokeDasharray="1.5 2.5"
          />
        );
      })}
    </svg>
  );
}
