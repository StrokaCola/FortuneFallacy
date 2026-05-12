import React, { useEffect, useRef, useState } from 'react';

/**
 * ForgeVFX Refined — Integrated cosmic rituals that respond to game state
 *
 * Ties visual effects to game data:
 * - Mod rarity (legendary → bigger burst, more stars)
 * - Edition power (foil/holo/poly each have signature glow)
 * - Affinity activations (golden resonance rings on new pairs)
 * - Active affinity count (ambient constellation sigil intensity)
 */

type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
type Edition = 'base' | 'foil' | 'holo' | 'poly';

type AttachEvent = { modId: string; rarity: Rarity; edition: Edition; key: string };
type ForgeEvent = { modId: string; edition: Edition; key: string };
type AffinityEvent = { affinityId: string; modIds: string[]; key: string };

type RarityConfig = { color: string; starCount: number; dustCount: number };
type EditionConfig = { glow: string; filter: string };

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

export function ForgeVFX() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<AttachEvent[]>([]);
  const [forges, setForges] = useState<ForgeEvent[]>([]);
  const [affinities, setAffinities] = useState<AffinityEvent[]>([]);
  const [constellationIntensity, setConstellationIntensity] = useState(0);

  useEffect(() => {
    forgeVFX.callbacks.attach = (modId, rarity, edition) => {
      const key = `attach-${modId}-${Date.now()}`;
      const event: AttachEvent = { modId, rarity, edition, key };
      setAttachments((prev) => [...prev, event]);
      setTimeout(() => setAttachments((prev) => prev.filter((a) => a.key !== key)), 900);
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
    common: { color: '#bba8ff', starCount: 6, dustCount: 3 },
    uncommon: { color: '#7be3ff', starCount: 8, dustCount: 4 },
    rare: { color: '#f5c451', starCount: 12, dustCount: 5 },
    legendary: { color: '#ff7847', starCount: 16, dustCount: 8 },
  };

  const editionConfig: Record<Edition, EditionConfig> = {
    base: { glow: '#7be3ff', filter: 'drop-shadow(0 0 16px #7be3ff)' },
    foil: { glow: '#a78bfa', filter: 'drop-shadow(0 0 20px #a78bfa) drop-shadow(0 0 40px rgba(167,139,250,0.4))' },
    holo: { glow: '#f97316', filter: 'drop-shadow(0 0 24px #f97316) drop-shadow(0 0 48px rgba(249,115,22,0.5))' },
    poly: { glow: '#06b6d4', filter: 'drop-shadow(0 0 20px #06b6d4) drop-shadow(0 0 40px rgba(6,182,212,0.4))' },
  };

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
            left: '50%',
            top: '50%',
            marginLeft: -240,
            marginTop: -240,
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(123,227,255,${0.04 + constellationIntensity * 0.02}) 0%, transparent 100%)`,
            pointerEvents: 'none',
            transition: 'all 400ms ease-out',
          }}
        />
      )}

      {attachments.map((event) => (
        <ModAttachmentRitual
          key={event.key}
          event={event}
          config={rarityConfig[event.rarity] ?? rarityConfig.common}
        />
      ))}

      {forges.map((event) => (
        <EditionForgeRitual
          key={event.key}
          event={event}
          config={editionConfig[event.edition] ?? editionConfig.base}
        />
      ))}

      {affinities.map((event) => (
        <AffinityActivationPulse key={event.key} event={event} />
      ))}
    </div>
  );
}

/**
 * Rarity-scaled burst: legendary gets bigger, more stars, longer tail.
 */
function ModAttachmentRitual({ event, config }: { event: AttachEvent; config: RarityConfig }) {
  const stars = Array.from({ length: config.starCount }, (_, i) => {
    const angle = (i / config.starCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const distance = 50 + Math.random() * (config.starCount === 16 ? 60 : 40);
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: i * 30,
      duration: 600 + Math.random() * 300,
    };
  });

  const dust = Array.from({ length: config.dustCount }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 120,
    y: (Math.random() - 0.5) * 120,
    delay: i * 60,
    duration: 700 + Math.random() * 200,
  }));

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        marginLeft: -40,
        marginTop: -40,
        width: 80,
        height: 80,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${config.color}88 0%, transparent 100%)`,
          animation: `dieAttachPulse ${config.starCount === 16 ? 700 : 600}ms cubic-bezier(0.34, 1.06, 0.64, 1)`,
        }}
      />

      {stars.map((star) => (
        <div
          key={`star-${star.id}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -6,
            marginTop: -6,
            color: config.color,
            textShadow: `0 0 8px ${config.color}`,
            fontSize: 12,
            pointerEvents: 'none',
            ['--burst-x' as never]: `${star.x}px`,
            ['--burst-y' as never]: `${star.y}px`,
            animation: `modAttachBurst ${star.duration}ms cubic-bezier(0.34, 1.06, 0.64, 1) ${star.delay}ms forwards`,
          } as React.CSSProperties}
        >
          ✦
        </div>
      ))}

      {dust.map((w) => (
        <div
          key={`dust-${w.id}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -8,
            marginTop: -8,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${config.color}60 0%, transparent 100%)`,
            pointerEvents: 'none',
            ['--wisp-x' as never]: `${w.x}px`,
            ['--wisp-y' as never]: `${w.y}px`,
            animation: `particleWisp ${w.duration}ms cubic-bezier(0.34, 1.06, 0.64, 1) ${w.delay}ms forwards`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/**
 * Edition-specific glow and merge: foil purple, holo orange, poly cyan.
 */
function EditionForgeRitual({ event: _event, config }: { event: ForgeEvent; config: EditionConfig }) {
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
        left: '50%',
        top: '50%',
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
function AffinityActivationPulse({ event }: { event: AffinityEvent }) {
  return (
    <div
      data-affinity-pulse={event.affinityId}
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
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
