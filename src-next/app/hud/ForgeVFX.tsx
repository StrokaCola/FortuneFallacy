import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * ForgeVFX Refined — Integrated cosmic rituals that respond to game state
 *
 * Ties visual effects to game data:
 * - Mod rarity (legendary → denser, larger stellar collapse)
 * - Edition power (foil/holo/poly each have signature glow)
 * - Affinity activations (golden resonance rings on new pairs)
 * - Active affinity count (ambient constellation sigil intensity)
 */

type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
type Edition = 'base' | 'foil' | 'holo' | 'poly';

type AttachEvent = { modId: string; rarity: Rarity; edition: Edition; key: string };
type ForgeEvent = { modId: string; edition: Edition; key: string };
type AffinityEvent = { affinityId: string; modIds: string[]; key: string };

type RarityConfig = { color: string; intensity: number };
type EditionConfig = { glow: string; filter: string };

// Rarity → stellar intensity (1..5). Each step scales particle count,
// orbit radius, core peak, and shockwave reach for the attachment
// ritual. Tuned so legendary feels noticeably bigger than rare without
// pushing the particle count past what mobile can comfortably draw.
const RARITY_INTENSITY: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  legendary: 5,
};

// Stellar ritual total runtime: collapse (1300–1800ms) + core flash
// (1500ms delay + 700ms = 2200ms) + shockwave (1650ms + 900ms = 2550ms).
// We hold the attachment event in state long enough for everything to
// finish; the particles are inside this wrapper, so they get unmounted
// the instant we drop it.
const STELLAR_LIFE_MS = 2200;

export const forgeVFX = {
  callbacks: {
    attach: null as ((modId: string, rarity: Rarity, edition: Edition) => void) | null,
    forge: null as ((modId: string, edition: Edition) => void) | null,
    affinityActivate: null as ((affinityId: string, modIds: string[]) => void) | null,
    constellationUpdate: null as ((activeAffinityCount: number) => void) | null,
  },

  triggerAttach(modId: string, rarity: Rarity = 'common', edition: Edition = 'base') {
    if (this.callbacks.attach) this.callbacks.attach(modId, rarity, edition);
  },

  triggerForge(modId: string, edition: Edition) {
    if (this.callbacks.forge) this.callbacks.forge(modId, edition);
  },

  triggerAffinityActivate(affinityId: string, modIds: string[]) {
    if (this.callbacks.affinityActivate) this.callbacks.affinityActivate(affinityId, modIds);
  },

  updateConstellation(activeAffinityCount: number) {
    if (this.callbacks.constellationUpdate) this.callbacks.constellationUpdate(activeAffinityCount);
  },
};

export function ForgeVFX({ anchorRef }: { anchorRef?: React.RefObject<HTMLElement | null> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<AttachEvent[]>([]);
  const [forges, setForges] = useState<ForgeEvent[]>([]);
  const [affinities, setAffinities] = useState<AffinityEvent[]>([]);
  const [constellationIntensity, setConstellationIntensity] = useState(0);
  // Live center of the anchored element (typically the die panel). The
  // rituals position themselves on this point with `position: fixed` —
  // re-measured on scroll/resize so they stay glued to the die rather
  // than the viewport center for the full 2.2s lifetime of an attach.
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const hasActiveEffect = attachments.length > 0 || forges.length > 0 || affinities.length > 0;

  useEffect(() => {
    if (!anchorRef) {
      setAnchor(null);
      return;
    }
    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setAnchor({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    };
    measure();
    // Only listen while there's a ritual playing — when idle, the static
    // anchor we last measured is fine and we avoid wasting scroll work.
    if (!hasActiveEffect) return;
    // The Forge content scrolls inside its own container, so we catch
    // scroll in capture phase to pick up nested scrollers as well as
    // the document.
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure, { passive: true });
    let raf = 0;
    const tick = () => {
      measure();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
  }, [anchorRef, hasActiveEffect]);

  useEffect(() => {
    forgeVFX.callbacks.attach = (modId, rarity, edition) => {
      const key = `attach-${modId}-${Date.now()}`;
      const event: AttachEvent = { modId, rarity, edition, key };
      setAttachments((prev) => [...prev, event]);
      setTimeout(() => setAttachments((prev) => prev.filter((a) => a.key !== key)), STELLAR_LIFE_MS);
    };

    forgeVFX.callbacks.forge = (modId, edition) => {
      const key = `forge-${modId}-${edition}-${Date.now()}`;
      const event: ForgeEvent = { modId, edition, key };
      setForges((prev) => [...prev, event]);
      setTimeout(() => setForges((prev) => prev.filter((f) => f.key !== key)), 700);
    };

    forgeVFX.callbacks.affinityActivate = (affinityId, modIds) => {
      const key = `affinity-${affinityId}-${Date.now()}`;
      const event: AffinityEvent = { affinityId, modIds, key };
      setAffinities((prev) => [...prev, event]);
      setTimeout(() => setAffinities((prev) => prev.filter((a) => a.key !== key)), 1400);
    };

    forgeVFX.callbacks.constellationUpdate = (count) => {
      setConstellationIntensity(Math.min(count, 4));
    };

    return () => {
      forgeVFX.callbacks.attach = null;
      forgeVFX.callbacks.forge = null;
      forgeVFX.callbacks.affinityActivate = null;
      forgeVFX.callbacks.constellationUpdate = null;
    };
  }, []);

  const rarityConfig: Record<Rarity, RarityConfig> = {
    common: { color: '#bba8ff', intensity: RARITY_INTENSITY.common },
    uncommon: { color: '#7be3ff', intensity: RARITY_INTENSITY.uncommon },
    rare: { color: '#f5c451', intensity: RARITY_INTENSITY.rare },
    legendary: { color: '#ff7847', intensity: RARITY_INTENSITY.legendary },
  };

  const editionConfig: Record<Edition, EditionConfig> = {
    base: { glow: '#7be3ff', filter: 'drop-shadow(0 0 16px #7be3ff)' },
    foil: { glow: '#a78bfa', filter: 'drop-shadow(0 0 20px #a78bfa) drop-shadow(0 0 40px rgba(167,139,250,0.4))' },
    holo: { glow: '#f97316', filter: 'drop-shadow(0 0 24px #f97316) drop-shadow(0 0 48px rgba(249,115,22,0.5))' },
    poly: { glow: '#06b6d4', filter: 'drop-shadow(0 0 20px #06b6d4) drop-shadow(0 0 40px rgba(6,182,212,0.4))' },
  };

  // When an anchor is wired up (the Forge die panel), all rituals
  // position themselves at the anchor center; otherwise they fall back
  // to viewport center so callers without a ref still get something.
  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9998,
        overflow: 'hidden',
      }}
    >
      {/* Constellation sigil background glow (tied to active affinities) */}
      {constellationIntensity > 0 && (
        <div
          style={{
            position: 'fixed',
            left: anchor ? anchor.x : '50%',
            top: anchor ? anchor.y : '50%',
            marginLeft: -240,
            marginTop: -240,
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(123,227,255,${0.04 + constellationIntensity * 0.02}) 0%, transparent 100%)`,
            pointerEvents: 'none',
            transition: 'opacity 400ms ease-out, background 400ms ease-out',
          }}
        />
      )}

      {attachments.map((event) => (
        <ModAttachmentRitual
          key={event.key}
          event={event}
          config={rarityConfig[event.rarity] ?? rarityConfig.common}
          anchor={anchor}
        />
      ))}

      {forges.map((event) => (
        <EditionForgeRitual
          key={event.key}
          event={event}
          config={editionConfig[event.edition] ?? editionConfig.base}
          anchor={anchor}
        />
      ))}

      {affinities.map((event) => (
        <AffinityActivationPulse key={event.key} event={event} anchor={anchor} />
      ))}
    </div>
  );
}

/**
 * Stellar ritual — particles spiral inward from an outer ring, collapse
 * into a white-hot core, and finish with a shockwave. Intensity
 * (1..5, derived from the installed mod's rarity) scales:
 *   - particle count: legendary clouds the stage; common stays sparse
 *   - outer orbit radius: bigger rarities reach wider
 *   - core peak scale + shockwave reach: legendary lands harder
 *
 * The motion uses `rotate(angle) translateX(r)` as the orbit anchor and
 * lets `stellarCollapse` (defined in ForgeVFX.css) sweep angle inward
 * to r=0 over the particle's lifetime.
 */
function ModAttachmentRitual({ event, config, anchor }: {
  event: AttachEvent;
  config: RarityConfig;
  anchor: { x: number; y: number } | null;
}) {
  const intensity = Math.max(1, Math.min(5, config.intensity));

  // Particle count, orbit radius, core/shockwave peaks all key off
  // intensity so the ritual scales linearly with rarity. The Math.min
  // ceilings keep mobile FPS sane on legendary attaches.
  const particleCount = Math.min(28, 14 + intensity * 3);
  const baseRadius = 110 + intensity * 14;       // 124 (common) → 180 (legendary)
  const radiusJitter = 60 + intensity * 8;       // adds a bit of "cloud" thickness
  const corePeak = 1.6 + intensity * 0.4;        // 2.0 → 3.6
  const shockPeak = 2.4 + intensity * 0.4;       // 2.8 → 4.4
  const stageRadius = baseRadius + radiusJitter; // sets the wrapper size so absolutely-positioned particles aren't clipped

  // Build the particle list once per event (the random jitter would
  // shuffle on every render otherwise, snapping particles mid-flight).
  const particles = useMemo(() => {
    const arr: Array<{
      id: number;
      angle: number;
      rStart: number;
      dur: number;
      delay: number;
      size: number;
      isStar: boolean;
    }> = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * 360 + (Math.random() - 0.5) * 18;
      const rStart = baseRadius + Math.random() * radiusJitter;
      const dur = 1300 + Math.random() * 500;
      const delay = Math.random() * 350;
      const size = 8 + Math.random() * 10;
      arr.push({ id: i, angle, rStart, dur, delay, size, isStar: i % 3 === 0 });
    }
    return arr;
    // event.key is unique per attach, so this remounts the particle field on every fire
  }, [event.key, particleCount, baseRadius, radiusJitter]);

  return (
    <div
      style={{
        position: 'fixed',
        left: anchor ? anchor.x : '50%',
        top: anchor ? anchor.y : '50%',
        marginLeft: -stageRadius,
        marginTop: -stageRadius,
        width: stageRadius * 2,
        height: stageRadius * 2,
        pointerEvents: 'none',
      }}
    >
      {particles.map((p) => (
        <div
          key={`star-${p.id}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
            color: config.color,
            transformOrigin: '0 0',
            animation: `stellarCollapse ${p.dur}ms cubic-bezier(0.5, 0, 0.75, 0.2) ${p.delay}ms forwards`,
            ['--angle' as never]: `${p.angle}deg`,
            ['--r-start' as never]: `${p.rStart}px`,
          } as React.CSSProperties}
        >
          {p.isStar ? (
            <svg width={p.size} height={p.size} viewBox="-20 -20 40 40" style={{ overflow: 'visible' }}>
              <path
                d="M0,-18 L5.5,-6 L18,-5 L8.5,3 L11,16 L0,9 L-11,16 L-8.5,3 L-18,-5 L-5.5,-6 Z"
                fill={config.color}
                style={{ filter: `drop-shadow(0 0 6px ${config.color})` }}
              />
            </svg>
          ) : (
            <svg width={p.size} height={p.size} viewBox="-20 -20 40 40" style={{ overflow: 'visible' }}>
              <path
                d="M0,-18 C2,-6 6,-2 18,0 C6,2 2,6 0,18 C-2,6 -6,2 -18,0 C-6,-2 -2,-6 0,-18 Z"
                fill={config.color}
                style={{ filter: `drop-shadow(0 0 6px ${config.color})` }}
              />
            </svg>
          )}
        </div>
      ))}

      {/* White-hot core that flashes when the particles arrive */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: `radial-gradient(circle, #fff 0%, ${config.color} 40%, transparent 100%)`,
          boxShadow: `0 0 40px ${config.color}, 0 0 80px ${config.color}`,
          transform: 'translate(-50%, -50%) scale(0)',
          animation: 'stellarCore 700ms cubic-bezier(0.2, 1.6, 0.4, 1) 1500ms forwards',
          ['--core-peak' as never]: `${corePeak}`,
        } as React.CSSProperties}
      />

      {/* Shockwave ring that expands from the core after the collapse */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 100,
          height: 100,
          borderRadius: '50%',
          border: `2px solid ${config.color}`,
          transform: 'translate(-50%, -50%)',
          opacity: 0,
          animation: 'stellarShockwave 900ms cubic-bezier(0.18, 0.7, 0.3, 1) 1650ms forwards',
          ['--shock-peak' as never]: `${shockPeak}`,
        } as React.CSSProperties}
      />
    </div>
  );
}

/**
 * Edition-specific glow and merge: foil purple, holo orange, poly cyan.
 */
function EditionForgeRitual({ event: _event, config, anchor }: {
  event: ForgeEvent;
  config: EditionConfig;
  anchor: { x: number; y: number } | null;
}) {
  const ORB_COUNT = 3;
  const orbs = Array.from({ length: ORB_COUNT }, (_, i) => ({
    id: i,
    angle: (i / ORB_COUNT) * Math.PI * 2,
    delay: i * 80,
  }));

  return (
    <div
      style={{
        position: 'fixed',
        left: anchor ? anchor.x : '50%',
        top: anchor ? anchor.y : '50%',
        marginLeft: -60,
        marginTop: -60,
        width: 120,
        height: 120,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '50%',
          marginLeft: -30,
          marginTop: -30,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${config.glow}aa 0%, ${config.glow}44 50%, transparent 100%)`,
          animation: 'lightShaftBreathe 1200ms ease-in-out infinite',
          filter: config.filter,
        }}
      />

      {orbs.map((orb) => {
        const radius = 50;
        const x = Math.cos(orb.angle) * radius;
        const y = Math.sin(orb.angle) * radius;

        return (
          <div
            key={`orb-${orb.id}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              marginLeft: -14,
              marginTop: -14,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, ${config.glow}cc 0%, ${config.glow}44 60%, rgba(15, 9, 37, 0.85) 100%)`,
              border: `1px solid ${config.glow}aa`,
              boxShadow: config.filter,
              animation: `forgeConfirm 700ms cubic-bezier(0.34, 1.06, 0.64, 1) ${orb.delay}ms forwards`,
              ['--merge-x' as never]: `${-x}px`,
              ['--merge-y' as never]: `${-y}px`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

/**
 * Golden resonance rings when an affinity pair activates.
 */
function AffinityActivationPulse({ event, anchor }: {
  event: AffinityEvent;
  anchor: { x: number; y: number } | null;
}) {
  return (
    <div
      data-affinity-pulse={event.affinityId}
      style={{
        position: 'fixed',
        left: anchor ? anchor.x : '50%',
        top: anchor ? anchor.y : '50%',
        marginLeft: -240,
        marginTop: -240,
        width: 480,
        height: 480,
        pointerEvents: 'none',
      }}
    >
      {[0, 1, 2].map((ring) => (
        <div
          key={`ring-${ring}`}
          style={{
            position: 'absolute',
            inset: `${ring * 40}px`,
            borderRadius: '50%',
            border: `1.5px solid rgba(245, 196, 81, ${0.7 - ring * 0.2})`,
            animation: `affinityArcPulse ${900 + ring * 200}ms ease-out ${ring * 120}ms forwards`,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          inset: '50%',
          marginLeft: -5,
          marginTop: -5,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#f5c451',
          boxShadow: '0 0 28px #f5c451, 0 0 56px rgba(245, 196, 81, 0.6)',
          animation: 'sparkle 900ms ease-in-out',
        }}
      />
    </div>
  );
}

export default ForgeVFX;
