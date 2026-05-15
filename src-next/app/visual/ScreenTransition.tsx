import { useEffect, useRef, useState, type ReactNode } from 'react';

type Phase = 'idle' | 'exiting' | 'entering';
type Direction = 'forward' | 'back' | 'neutral';

// 720ms is the sweet spot between "snappy" (≤600ms feels abrupt
// after the recent scoring-celebration changes) and "slow" (≥900ms
// drags on Hub ↔ Forge round-trips). Tuned with the post-boom screen
// swap in mind: the celebration finishes, the round screen lingers
// briefly, then the fade carries the player into the shop.
const SAVORED_MS = 720;
const SNAP_MS = 120;

// Direction-aware scale curve so the swap reads as "forward
// commitment" (leaving pushes outward, arriving rises up) vs.
// "back retreat" (leaving recedes inward, arriving settles down).
// Neutral keeps the gentle Wave 1 default.
const SCALES: Record<Direction, { exit: number; enter: number }> = {
  forward: { exit: 1.08, enter: 0.96 },
  back:    { exit: 0.97, enter: 1.03 },
  neutral: { exit: 1.05, enter: 0.985 },
};

// Screen "depth" — higher = further into the run. Used to derive
// transition direction from (from, to) pairs. The tier values
// describe a meaningful hierarchy:
//   0 = top-level menus (title, codex, settings, scores, …)
//   1 = run-setup screens (constellation_select, nameentry)
//   2 = run home (hub)
//   3 = run sidesteps (shop, forge, event)
//   4 = active play (round)
//   5 = terminal outcomes (win, fail)
const SCREEN_DEPTH: Record<string, number> = {
  title: 0,
  codex: 0,
  settings: 0,
  scores: 0,
  challenges: 0,
  astral_forge: 0,
  nameentry: 1,
  constellation_select: 1,
  hub: 2,
  shop: 3,
  forge: 3,
  event: 3,
  round: 4,
  win: 5,
  fail: 5,
};

function transitionDirection(from: string, to: string): Direction {
  const f = SCREEN_DEPTH[from] ?? 0;
  const t = SCREEN_DEPTH[to] ?? 0;
  if (t > f) return 'forward';
  if (t < f) return 'back';
  return 'neutral';
}

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
  const [direction, setDirection] = useState<Direction>('neutral');
  const lastKey = useRef(screenKey);
  const tEnterRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    if (screenKey === lastKey.current) return;
    const reduced = document.documentElement.classList.contains('reduce-motion');
    const half = reduced ? SNAP_MS : SAVORED_MS / 2;
    // Compute direction from the OUTGOING screen (lastKey.current) to
    // the new screenKey. Lives in state so the same direction is
    // active across both phases of the swap (exit + enter), giving
    // the entering screen its matching "arriving up" or "settling
    // down" scale.
    const nextDirection = transitionDirection(lastKey.current, screenKey);
    setDirection(nextDirection);

    setPhase('exiting');
    const tExit = window.setTimeout(() => {
      lastKey.current = screenKey;
      setRenderedKey(screenKey);
      setRenderedChildren(children);
      setPhase('entering');
      tEnterRef.current = window.setTimeout(() => {
        setPhase('idle');
        setDirection('neutral');
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
  const { exit: exitScale, enter: enterScale } = SCALES[direction];
  const scale = phase === 'exiting' ? exitScale : phase === 'entering' ? enterScale : 1;

  // Entering a Round is the player's commitment moment — fold in a
  // "stellar dive" overlay (inward star streaks) on top of the standard
  // constellation wipe so the descent into play has a distinct visual
  // signature vs. routine screen-to-screen swaps.
  const enteringRound = phase === 'entering' && screenKey === 'round';
  // Leaving a Round — counterpart drift OUTWARD as the round screen
  // fades, so the player feels the cosmos releasing them back to the
  // hub / shop / postmortem instead of just dimming in place. Reads
  // the currently-rendered key (which is still the OUTGOING screen
  // during the exit phase).
  const exitingRound = phase === 'exiting' && renderedKey === 'round';

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
      {exitingRound && <StellarDrift />}
      {renderedChildren}
    </div>
  );
}

// "Stellar drift" — counterpart to StellarDive, fired when the
// player leaves the Round. A handful of soft star points drift
// OUTWARD from center as the round screen fades, signalling "the
// cosmos releases the play table" — the boom celebration's energy
// doesn't just disappear with the fade; it gently radiates outward
// into the next screen. Skipped under reduce-motion via class hook.
function StellarDrift() {
  return (
    <svg
      className="stellar-drift"
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {Array.from({ length: 10 }).map((_, i) => {
        // Each streak runs from a small inner ring (radius 6) outward
        // to a wider outer ring (radius 58) — softer reach than
        // StellarDive's 70 so the drift reads as "letting go" rather
        // than "diving in."
        const angle = (i / 10) * Math.PI * 2 + 0.18; // small offset so drift doesn't mirror dive exactly
        const xInner = 50 + Math.cos(angle) * 6;
        const yInner = 50 + Math.sin(angle) * 6;
        const xOuter = 50 + Math.cos(angle) * 58;
        const yOuter = 50 + Math.sin(angle) * 58;
        return (
          <line
            key={i}
            className="stellar-drift-streak"
            x1={xInner} y1={yInner}
            x2={xOuter} y2={yOuter}
            stroke="#fff7e0"
            strokeWidth={0.18}
            strokeLinecap="round"
            style={{ animationDelay: `${i * 24}ms` }}
          />
        );
      })}
    </svg>
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
