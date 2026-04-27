import { useEffect, useRef, useState, type ReactNode } from 'react';

type Phase = 'idle' | 'exiting' | 'entering';

const SAVORED_MS = 600;
const SNAP_MS = 120;

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
  const scale = phase === 'exiting' ? 1.04 : phase === 'entering' ? 0.98 : 1;

  return (
    <div
      data-screen={renderedKey}
      data-phase={phase}
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        transform: `scale(${scale})`,
        transition: `opacity var(--savored, 600ms) var(--ease-savor, ease), transform var(--savored, 600ms) var(--ease-savor, ease)`,
        pointerEvents: phase === 'idle' ? 'auto' : 'none',
      }}
    >
      <ConstellationWipe phase={phase} />
      {renderedChildren}
    </div>
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
        transition: 'opacity var(--savored, 600ms) var(--ease-savor, ease)',
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
