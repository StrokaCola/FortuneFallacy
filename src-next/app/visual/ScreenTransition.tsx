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
  // Wave S — `fromKey` snapshots the screen the player left so the
  // overlay layer can branch on the specific pair (e.g. Hub → Round
  // gets the PortalWarp, but Shop → Round skips it). Updated alongside
  // the phase swap so the entering screen still knows where it came
  // from after lastKey.current rolls forward.
  const [fromKey, setFromKey] = useState<string>(screenKey);
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
    setFromKey(lastKey.current);

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
  // Wave S — Hub→Round is the most narratively-charged transition (the
  // player chose a trial; they're committing to it). On top of the
  // stellar dive, fire a PortalWarp: three concentric rings expand
  // outward from center with a subtle chromatic shimmer. Only on the
  // Hub→Round direction, not on Shop→Round or Forge→Round, so the
  // signature stays "commit to a trial" rather than "every Round
  // entry." Reads fromKey (the captured source screen) so the check
  // still works after lastKey.current rolls forward mid-swap.
  const portalWarp = phase === 'entering' && screenKey === 'round' && fromKey === 'hub';

  // Wave MM — per-pair transition flavor. Picks ONE bespoke overlay
  // based on (from → to) so the game doesn't fall back to the same
  // ConstellationWipe on every navigation. Returns null when the
  // generic wipe is enough (default). Read during the entering phase
  // so the overlay paints AS the new screen rises.
  const flavor = pickTransitionFlavor(fromKey, screenKey, phase);

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
      <ConstellationWipe phase={phase} flavor={flavor} />
      {enteringRound && <StellarDive />}
      {portalWarp && <PortalWarp />}
      {exitingRound && <StellarDrift />}
      {flavor === 'vellum' && <VellumSweep />}
      {flavor === 'coins' && <CoinShimmer />}
      {flavor === 'embers' && <ForgeEmbers />}
      {flavor === 'scrollroll' && <ScrollRoll />}
      {flavor === 'dustswirl' && <DustSwirl />}
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

// Wave S — Portal warp layer. Three concentric cyan rings expand
// outward from the center with a brief gold flare in the middle,
// plus a chromatic-shimmer split so the entry reads as "stepping
// through a gate" rather than "the screen faded." Only fires on
// Hub → Round (the player's deliberate commitment to a trial).
function PortalWarp() {
  return (
    <svg
      className="portal-warp"
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
        mixBlendMode: 'screen',
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* Three rings staggered 80ms apart so the warp reads as a
          ripple rather than a single pop. Each expands from r=4 to
          r=70 and fades out over 500ms. The middle ring picks up
          a faint chromatic split via a duplicate offset stroke. */}
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          className={`portal-warp-ring portal-warp-ring-${i}`}
          cx={50}
          cy={50}
          r={4}
          fill="none"
          stroke={i === 1 ? '#f5c451' : '#7be3ff'}
          strokeWidth={0.6}
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
      {/* Center flare — a brief gold bloom right as the rings
          expand outward, the visual "moment of crossing." */}
      <circle
        className="portal-warp-core"
        cx={50}
        cy={50}
        r={3}
        fill="#fff7e0"
      />
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

function ConstellationWipe({ phase, flavor }: { phase: Phase; flavor: TransitionFlavor | null }) {
  if (phase === 'idle') return null;
  const expand = phase === 'exiting' ? 1 : 0.5;
  // Wave MM — when a per-pair flavor overlay is firing, dim the
  // generic wipe so the bespoke layer reads as the primary signal.
  // Setting opacity to 0 entirely on flavored paths would lose the
  // connective tissue across the swap; the wipe stays as a faint
  // backdrop unless the flavor explicitly suppresses it.
  const baseOpacity = phase === 'exiting' ? 0.7 : 0.35;
  const opacity = flavor && FLAVOR_SUPPRESSES_WIPE.has(flavor) ? baseOpacity * 0.35 : baseOpacity;
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity,
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

// Wave MM — per-pair transition flavor system. Maps (fromKey, toKey)
// → a flavor key that selects a bespoke overlay component. The map
// only covers high-traffic transitions; everything else falls back to
// the generic ConstellationWipe (which is suppressed slightly when a
// flavor is active, see FLAVOR_SUPPRESSES_WIPE).
type TransitionFlavor =
  | 'vellum'      // Title → Codex: parchment sweep right-to-left
  | 'coins'       // Round → Shop (after blind clear): gold coin shimmer
  | 'embers'      // Hub → Forge: orange ember rise
  | 'scrollroll'  // Title → Challenges: vertical scroll unroll
  | 'dustswirl';  // Title → AstralForge / Scores / Settings: cosmic dust drift

const FLAVOR_SUPPRESSES_WIPE = new Set<TransitionFlavor>(['vellum', 'embers', 'scrollroll']);

function pickTransitionFlavor(from: string, to: string, phase: Phase): TransitionFlavor | null {
  if (phase !== 'entering') return null;
  if (from === 'title' && to === 'codex')         return 'vellum';
  if (from === 'title' && to === 'challenges')    return 'scrollroll';
  if (from === 'title' && to === 'astral_forge')  return 'dustswirl';
  if (from === 'title' && to === 'scores')        return 'dustswirl';
  if (from === 'title' && to === 'settings')      return 'dustswirl';
  if (from === 'hub'   && to === 'forge')         return 'embers';
  if (from === 'round' && to === 'shop')          return 'coins';
  return null;
}

// Vellum sweep — parchment-warm gradient bar sweeps right-to-left
// across the screen during Codex entry. Reads as "opening the codex."
function VellumSweep() {
  return (
    <div
      className="transition-flavor transition-vellum"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    />
  );
}

// Coin shimmer — falling gold particles during the Round → Shop swap
// after a blind clears. Spawns 12 staggered coins drifting downward.
function CoinShimmer() {
  return (
    <div
      className="transition-flavor transition-coins"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="coin-shimmer-mote"
          style={{
            left: `${8 + i * 7.4}%`,
            animationDelay: `${i * 40}ms`,
          }}
        />
      ))}
    </div>
  );
}

// Forge embers — orange ember particles rise from the bottom edge as
// the Forge screen arrives. Reads as "the anvil is hot."
function ForgeEmbers() {
  return (
    <div
      className="transition-flavor transition-embers"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="forge-ember-mote"
          style={{
            left: `${5 + i * 9.5}%`,
            animationDelay: `${i * 55}ms`,
          }}
        />
      ))}
    </div>
  );
}

// Scroll roll — top + bottom bars converge then snap apart, reads as
// a scroll unfurling for Challenges (constraint-runs as scripture).
function ScrollRoll() {
  return (
    <div
      className="transition-flavor transition-scrollroll"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    >
      <span className="scroll-bar scroll-bar-top" />
      <span className="scroll-bar scroll-bar-bot" />
    </div>
  );
}

// Dust swirl — small drifting violet motes sweep diagonally across.
// Quiet treatment for the Title → meta-screens (Astral Forge / Scores
// / Settings) so each meta screen feels reached, not jumped to.
function DustSwirl() {
  return (
    <div
      className="transition-flavor transition-dustswirl"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    >
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="dust-swirl-mote"
          style={{
            left: `${5 + (i * 6.7) % 90}%`,
            top: `${10 + (i * 13.3) % 70}%`,
            animationDelay: `${i * 35}ms`,
          }}
        />
      ))}
    </div>
  );
}
