// ForgeBackdrop — cosmic anvil layer drawn behind the Forge's main content.
//
// 2026-05-11 Forge overhaul · Phase 1.1
//
// Three layered visuals, all pure DOM/SVG so we don't fight the global
// nebula canvas:
//   1. A massive faint anvil silhouette behind the central panel,
//      rotating very slowly (~120s loop).
//   2. A spark drift — 18 sparks rising from the bottom edge, sin-wave
//      lateral drift, fade-in/fade-out. CSS keyframe staggered per spark.
//   3. An ambient ember pulse — a soft ring expands outward from behind
//      the central die panel every 4s.
//
// Everything respects `.reduce-motion` (sparks settle, anvil pauses,
// ember holds a static glow).

import { useStore } from '../../state/store';
import { lookupConstellation } from '../../data/constellations';

const SPARK_COUNT = 18;

// Anvil silhouette path. Procedural — keep the shape suggestive of an
// anvil but loose enough to read as a celestial body when faded out.
// Two horizontal blocks stacked on a tapered base.
const ANVIL_PATH =
  'M 60 220 L 340 220 L 320 200 L 80 200 Z ' +              // top block
  'M 80 200 L 320 200 L 300 170 L 100 170 Z ' +              // upper face
  'M 140 170 L 260 170 L 250 90 L 150 90 Z ' +               // tapered body
  'M 150 90 L 250 90 L 240 70 L 160 70 Z ' +                 // head
  'M 130 220 L 270 220 L 280 260 L 120 260 Z';               // base

export function ForgeBackdrop() {
  const constellationId = useStore((s) => s.run.constellationId);
  const constellation = lookupConstellation(constellationId);
  const accent = constellation.color;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}>
      {/* Anvil silhouette — rotates very slowly. Sized to feel ambient,
          not foreground. Sits centered behind the main panel column. */}
      <div
        className="forge-anvil"
        style={{
          position: 'absolute',
          left: '50%', top: '50%',
          width: 'min(900px, 90vw)',
          height: 'min(900px, 90vw)',
          transform: 'translate(-50%, -50%)',
          opacity: 0.07,
          color: accent,
        }}>
        <svg viewBox="0 0 400 320" width="100%" height="100%">
          <path d={ANVIL_PATH} fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Ember pulse — a single soft ring that expands from behind the
          central die panel every 4s. CSS keyframe + position. */}
      <div
        className="forge-ember-pulse"
        style={{
          position: 'absolute',
          left: '50%', top: '50%',
          width: 220, height: 220,
          marginLeft: -110, marginTop: -110,
          borderRadius: '50%',
          // The ring color tracks the constellation accent so the forge
          // feels tied to the run's identity.
          border: `2px solid ${accent}55`,
          boxShadow: `0 0 24px ${accent}33, inset 0 0 24px ${accent}22`,
          opacity: 0,
        }}
      />

      {/* Sparks — 18 sprite divs rising from a band along the bottom
          half. Each gets an animation-delay so they don't all rise at
          the same time. CSS keyframes do the lift + sin-wave drift. */}
      {Array.from({ length: SPARK_COUNT }, (_, i) => {
        const lateral = ((i * 113) % 100); // pseudo-random lateral position 0..100%
        const delay = (i * 0.42) % 5.6;
        const size = 2 + ((i * 7) % 4); // 2..6px
        return (
          <div
            key={i}
            className="forge-spark"
            style={{
              position: 'absolute',
              left: `${lateral}%`,
              bottom: -20,
              width: size, height: size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${accent} 0%, ${accent}66 40%, transparent 80%)`,
              boxShadow: `0 0 ${size * 2}px ${accent}aa`,
              opacity: 0,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}
