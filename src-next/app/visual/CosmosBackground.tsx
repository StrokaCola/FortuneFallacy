import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { isPerfDegraded, subscribePerfMode } from '../perf/perfMode';
import { bus } from '../../events/bus';

export type ThemeKey = 'midnight' | 'voidlit' | 'sandstorm' | 'abyssal';

// Live perf-mode hook for components that want to skip rendering
// expensive overlays. Subscribes to the perf-mode bus so the gate
// flips when the auto-degrade watcher or the manual Settings toggle
// changes state — without a re-mount or prop drilling.
function useIsPerfDegraded(): boolean {
  const [degraded, setDegraded] = useState(isPerfDegraded);
  useEffect(() => subscribePerfMode(() => setDegraded(isPerfDegraded())), []);
  return degraded;
}

const THEMES: Record<ThemeKey, {
  bgFar: string; bgMid: string; bgNear: string;
  nebulaA: string; nebulaB: string; nebulaC: string;
  star: string; accent: string;
}> = {
  midnight: { bgFar: '#07051a', bgMid: '#0f0925', bgNear: '#1c1245',
    nebulaA: 'rgba(118, 71, 245, 0.35)', nebulaB: 'rgba(123, 227, 255, 0.18)', nebulaC: 'rgba(255, 120, 71, 0.12)',
    star: '#dcd4ff', accent: '#7be3ff' },
  voidlit: { bgFar: '#020108', bgMid: '#04031a', bgNear: '#0a0830',
    nebulaA: 'rgba(255, 71, 168, 0.22)', nebulaB: 'rgba(123, 227, 255, 0.20)', nebulaC: 'rgba(245, 196, 81, 0.10)',
    star: '#ffe7fb', accent: '#ff7adf' },
  sandstorm: { bgFar: '#1a0a05', bgMid: '#2c1408', bgNear: '#3d1d10',
    nebulaA: 'rgba(255, 138, 71, 0.30)', nebulaB: 'rgba(245, 196, 81, 0.22)', nebulaC: 'rgba(226, 51, 74, 0.14)',
    star: '#ffe9c8', accent: '#f5c451' },
  abyssal: { bgFar: '#02080d', bgMid: '#04141d', bgNear: '#072330',
    nebulaA: 'rgba(123, 227, 255, 0.32)', nebulaB: 'rgba(71, 245, 173, 0.18)', nebulaC: 'rgba(149, 119, 255, 0.12)',
    star: '#dff7ff', accent: '#7be3ff' },
};

function Starfield({ density = 1, theme = 'voidlit', drift = true, tension = 0 }: { density?: number; theme?: ThemeKey; drift?: boolean; tension?: number }) {
  const t = THEMES[theme];
  // Speed up drift with tension: tension=0 → 1×, tension=1 → 1.4×
  const driftMul = 1 + 0.4 * tension;
  const layers = useMemo(() => {
    const make = (count: number, sizeMin: number, sizeMax: number, dist: number) => {
      const stars = [];
      for (let i = 0; i < count * density; i++) {
        stars.push({
          x: Math.random() * 100,
          y: Math.random() * 100,
          r: sizeMin + Math.random() * (sizeMax - sizeMin),
          o: 0.3 + Math.random() * 0.7,
          d: 1 + Math.random() * 4,
          c: Math.random() < 0.06 ? '#7be3ff' : Math.random() < 0.07 ? '#f5c451' : t.star,
        });
      }
      return { stars, dist };
    };
    return [make(60, 0.5, 1.2, 0.3), make(40, 0.8, 1.8, 0.6), make(18, 1.4, 2.6, 1.0)];
  }, [density, theme, t.star]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {layers.map((layer, li) => (
        <svg key={li}
          width="100%" height="100%"
          viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
          style={{
            position: 'absolute', inset: 0,
            animation: drift ? `drift ${(180 / layer.dist) / driftMul}s linear infinite alternate` : 'none',
            opacity: 0.5 + layer.dist * 0.4,
          }}>
          {layer.stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.15} fill={s.c} opacity={s.o}
              style={{ animation: `twinkle ${2 + s.d}s ${s.d}s ease-in-out infinite` }} />
          ))}
        </svg>
      ))}
    </div>
  );
}

function Nebula({ theme = 'voidlit', intensity = 1 }: { theme?: ThemeKey; intensity?: number }) {
  const t = THEMES[theme];
  if (intensity <= 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: intensity }}>
      <div style={{ position: 'absolute', left: '-10%', top: '-15%', width: '70%', height: '70%',
        background: `radial-gradient(circle, ${t.nebulaA} 0%, transparent 65%)`, filter: 'blur(20px)' }} />
      <div style={{ position: 'absolute', right: '-15%', top: '20%', width: '70%', height: '80%',
        background: `radial-gradient(circle, ${t.nebulaB} 0%, transparent 60%)`, filter: 'blur(28px)' }} />
      <div style={{ position: 'absolute', left: '20%', bottom: '-20%', width: '70%', height: '60%',
        background: `radial-gradient(circle, ${t.nebulaC} 0%, transparent 60%)`, filter: 'blur(24px)' }} />
    </div>
  );
}

export function CosmosBackground({
  theme = 'voidlit',
  density = 1,
  nebula = true,
  drift = true,
  tension = 0,
  progress = 0,
}: { theme?: ThemeKey; density?: number; nebula?: boolean; drift?: boolean; tension?: number; progress?: number }) {
  const t = THEMES[theme];
  // Perf-mode gate. When degraded we skip rendering the celebratory
  // gold + halo overlays AND the two stardust drift layers — those
  // three full-screen mix-blend-mode reads cost a framebuffer round-
  // trip per layer per frame on integrated Mac GPUs (~3-5 FPS in
  // testing). The crimson tint + vignette stay; both are cheap and
  // they're the only signals that carry actual gameplay meaning
  // (tension during boss hands). Stardust + halos are pure mood and
  // worth shedding when the frame budget is tight.
  const degraded = useIsPerfDegraded();
  const tensionClamped = Math.max(0, Math.min(1, tension));
  // Crimson tint fades in from 0 starting at tension=0.3, reaching opacity 0.25 at tension=1.
  const crimsonOpacity = tensionClamped < 0.3 ? 0 : (tensionClamped - 0.3) * (0.25 / 0.7);
  // Dark corner vignette ramps from 0 starting at tension=0.6 toward 0.55 at
  // tension=1. Pulls the edges into the dark and pushes attention to centre,
  // mimicking Clover Pit's claustrophobic moods on boss/late-blind hands.
  const vigOpacity = tensionClamped < 0.6 ? 0 : (tensionClamped - 0.6) * (0.55 / 0.4);
  // Score-progress reactivity — completely orthogonal to tension. When
  // the player is CLIMBING the score (approaching/crossing target), a
  // gold tint fades in across the top half of the cosmos. The cosmos
  // itself reacts to your over-clear flex. progress=1.0 → over target.
  // We treat progress >=1 as "you crossed", brightening the scene.
  const progressClamped = Math.max(0, Math.min(2, progress));
  const goldOpacity = progressClamped < 0.6 ? 0 : Math.min(0.35, (progressClamped - 0.6) * 0.45);
  // Star halo brightness boost — additive overlay that brightens the
  // upper third of the screen as score crosses target.
  const haloOpacity = progressClamped < 1.0 ? 0 : Math.min(0.45, (progressClamped - 1.0) * 0.6);

  // Portal the backdrop to a host OUTSIDE #next-root so its opaque radial
  // gradient paints UNDER the dice canvas (#three-next, z=1). Rendering it
  // inside #next-root (z=2) covered the dice when #three-next was lowered
  // from z=3 to z=1 to stop dice from punching through modals.
  const host = typeof document !== 'undefined' ? document.getElementById('cosmos-root') : null;
  const tree = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: `radial-gradient(ellipse at 50% 35%, ${t.bgNear} 0%, ${t.bgMid} 45%, ${t.bgFar} 100%)`,
    }}>
      <Nebula theme={theme} intensity={nebula ? 1 : 0.3} />
      <Starfield density={density} theme={theme} drift={drift} tension={tensionClamped} />
      {/* Meteor shower — graceful shooting stars across the cosmos
          sky, triggered by mega booms via the onMeteorShowerTriggered
          bus event. Sits behind the celebratory gold/halo overlays so
          a crushed hand's halo still reads as the dominant signal,
          but in front of the static starfield + nebula so the streaks
          read as cosmic foreground motion. Skipped in degraded mode
          (same gate as stardust + halo). */}
      <MeteorShowerLayer enabled={!degraded} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(226,51,74,1) 100%)',
        opacity: crimsonOpacity,
        mixBlendMode: 'multiply',
        transition: 'opacity 600ms ease',
        willChange: 'opacity',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,1) 105%)',
        opacity: vigOpacity,
        transition: 'opacity 800ms ease',
        willChange: 'opacity',
      }} />
      {/* Gold "you're crushing it" overlay — fades in as score crosses
          60% of target, peaks at 200% (over-clear). screen blend so it
          brightens stars + nebula without flattening the contrast.
          Skipped in degraded mode (full-screen mix-blend-mode reads
          cost a framebuffer round-trip per layer per frame). */}
      {!degraded && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 30%, rgba(245,196,81,1) 0%, transparent 70%)',
          opacity: goldOpacity,
          mixBlendMode: 'screen',
          transition: 'opacity 600ms ease',
          willChange: 'opacity',
        }} />
      )}
      {/* Halo aura on cross-target — top half brightens further when
          score is above 1× target, capping at progress=1.75. Same
          perf-degraded gate as the gold overlay above. */}
      {!degraded && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,232,180,0.85) 0%, transparent 55%)',
          opacity: haloOpacity,
          mixBlendMode: 'screen',
          transition: 'opacity 800ms ease',
          willChange: 'opacity',
        }} />
      )}
      {/* Drifting stardust — slow diagonal motion gives the cosmos a
          continuous "the world is alive" beat between actions. Two
          layered SVG bands at different opacities + speeds parallax-
          drift toward the bottom-left. Suppressed under reduce-motion
          via the class hook in styles/index.css. */}
      {/* Stardust layers — gated on perf-mode too. The CSS suppression
          in styles/index.css stops the infinite drift animation under
          .perf-degraded, but the divs themselves still cost a paint
          pass and a mix-blend-mode read per frame. Skipping the JSX
          entirely is a clean win on integrated GPUs. */}
      {drift && !degraded && (
        <>
          <div className="cosmos-stardust cosmos-stardust-near" aria-hidden="true" style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `radial-gradient(circle at 18% 22%, ${t.star}44 0.6px, transparent 0.8px),
                              radial-gradient(circle at 62% 78%, ${t.star}33 0.7px, transparent 0.9px),
                              radial-gradient(circle at 86% 14%, ${t.star}3a 0.6px, transparent 0.8px),
                              radial-gradient(circle at 38% 56%, ${t.star}30 0.5px, transparent 0.7px)`,
            backgroundSize: '320px 320px, 280px 280px, 360px 360px, 240px 240px',
            mixBlendMode: 'screen',
            opacity: 0.55,
          }} />
          <div className="cosmos-stardust cosmos-stardust-far" aria-hidden="true" style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `radial-gradient(circle at 50% 50%, ${t.star}50 0.4px, transparent 0.6px),
                              radial-gradient(circle at 12% 88%, ${t.star}40 0.4px, transparent 0.6px)`,
            backgroundSize: '180px 180px, 220px 220px',
            mixBlendMode: 'screen',
            opacity: 0.45,
          }} />
        </>
      )}
      {/* Distant-lightning vignette — fires randomly when tension is
          high (>0.65), simulating storm clouds rolling across the
          backdrop. Each flash is a brief warm-white pulse across the
          top of the screen, ~180ms. Adds atmospheric depth on late-
          blind / boss tension without competing with the crimson
          tint or the score-celebration halos. */}
      <LightningFlash tension={tensionClamped} />
    </div>
  );
  return host ? createPortal(tree, host) : tree;
}

// Graceful cosmic meteor shower. Subscribes to `onMeteorShowerTriggered`
// (emitted by ScoreMoment on mega booms) and renders N streaks that
// arc diagonally across the cosmos backdrop with soft fade-in / fade-
// out, slower travel times, and gentler downward angles than the
// foreground-VFX predecessor. Each shower auto-clears after 3500ms.
//
// Geometry: outer wrapper carries the rotation + start position; the
// inner `.cosmos-meteor` translates along its local X axis so the
// rotation and the translate compose cleanly (avoids the keyframe
// transform clobbering the inline rotate).
function MeteorShowerLayer({ enabled }: { enabled: boolean }) {
  const [showers, setShowers] = useState<Array<{ id: number; accent: string; count: number }>>([]);
  useEffect(() => {
    if (!enabled) return;
    let nextId = 1;
    const off = bus.on('onMeteorShowerTriggered', ({ accent, count }) => {
      const id = nextId++;
      setShowers((prev) => [...prev, { id, accent, count }]);
      window.setTimeout(() => {
        setShowers((prev) => prev.filter((s) => s.id !== id));
      }, 3500);
    });
    return off;
  }, [enabled]);
  if (!enabled || showers.length === 0) return null;
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
    }}>
      {showers.flatMap((shower) =>
        Array.from({ length: shower.count }).map((_, i) => {
          // Deterministic per-streak parameters keyed off index so a
          // shower's streaks scatter consistently without re-render
          // jitter.
          const startXPct = 5 + ((i * 41) % 70);          // 5-75% from the left
          const angleDeg = 22 + ((i * 17) % 14);          // 22-36° below horizontal
          const delay = (i * 220) % 1400;                 // 0-1400ms stagger
          const duration = 1900 + ((i * 71) % 600);       // 1900-2500ms travel
          return (
            <div
              key={`${shower.id}-${i}`}
              style={{
                position: 'absolute',
                top: `${-12 - ((i * 9) % 10)}vmax`,
                left: `${startXPct}%`,
                transform: `rotate(${angleDeg}deg)`,
                transformOrigin: '0 0',
              }}
            >
              <div
                className="cosmos-meteor"
                style={{
                  animationDelay: `${delay}ms`,
                  animationDuration: `${duration}ms`,
                  ['--meteor-accent' as string]: shower.accent,
                }}
              >
                <div className="cosmos-meteor-trail" />
                <div className="cosmos-meteor-head" />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// Tension-driven random lightning flashes. Schedules itself between
// 6 and 14 seconds apart once tension crosses 0.65, and re-evaluates
// on tension change so a falling tension quiets the storm.
function LightningFlash({ tension }: { tension: number }) {
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (tension < 0.65) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const delay = 6000 + Math.random() * 8000;
      timer = setTimeout(() => {
        setPulseKey((k) => k + 1);
        schedule();
      }, delay);
    };
    schedule();
    return () => { if (timer) clearTimeout(timer); };
  }, [tension < 0.65]); // re-arm only on threshold cross
  if (tension < 0.65 || pulseKey === 0) return null;
  return (
    <div
      key={pulseKey}
      aria-hidden="true"
      className="cosmos-lightning"
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,240,210,0.55) 0%, transparent 45%)',
        mixBlendMode: 'screen',
        opacity: 0,
      }}
    />
  );
}
