import React, { useEffect, useRef, useState } from 'react';

/**
 * ForgeVFX: Cosmic/ethereal visual effects for Forge operations
 * 
 * This component provides:
 * - Mod attachment burst ceremony (stars radiating from mod icon)
 * - Orbital approach animation (mods arriving at the die)
 * - Affinity link pulse effects (golden arcs glowing)
 * - Constellation sigil breathing (ambient glow)
 * - Edition forge ritual (orbs merging into mod card)
 * - Particle wisps (floating dust from attachment)
 * 
 * Integration:
 * 1. Import and render at the top level of your Forge screen
 * 2. Call forgeVFX.triggerAttach(modId, sourceEl, targetEl) on ATTACH_MOD
 * 3. Call forgeVFX.triggerForge(modId, edition, sourceEl) on FORGE_MOD
 * 4. Call forgeVFX.triggerAffinityPulse(affinityId) when affinity activates
 */

export const forgeVFX = {
  callbacks: {
    attach: null as ((modId: string) => void) | null,
    forge: null as ((modId: string, edition: string) => void) | null,
    affinity: null as ((id: string) => void) | null,
  },
  
  triggerAttach(modId: string, sourceEl?: HTMLElement, targetEl?: HTMLElement) {
    if (this.callbacks.attach) this.callbacks.attach(modId);
  },
  
  triggerForge(modId: string, edition: string, sourceEl?: HTMLElement) {
    if (this.callbacks.forge) this.callbacks.forge(modId, edition);
  },
  
  triggerAffinityPulse(affinityId: string) {
    if (this.callbacks.affinity) this.callbacks.affinity(affinityId);
  },
};

type AttachEvent = { modId: string; sourceEl?: HTMLElement; targetEl?: HTMLElement };
type ForgeEvent = { modId: string; edition: string; sourceEl?: HTMLElement };
type AffinityEvent = { id: string };

export function ForgeVFX() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<(AttachEvent & { key: string })[]>([]);
  const [forges, setForges] = useState<(ForgeEvent & { key: string })[]>([]);
  const [affinities, setAffinities] = useState<(AffinityEvent & { key: string })[]>([]);

  useEffect(() => {
    // Register callbacks for external triggers
    forgeVFX.callbacks.attach = (modId) => {
      const key = `attach-${modId}-${Date.now()}`;
      setAttachments((prev) => [...prev, { modId, key }]);
      setTimeout(() => {
        setAttachments((prev) => prev.filter((a) => a.key !== key));
      }, 800);
    };

    forgeVFX.callbacks.forge = (modId, edition) => {
      const key = `forge-${modId}-${edition}-${Date.now()}`;
      setForges((prev) => [...prev, { modId, edition, key }]);
      setTimeout(() => {
        setForges((prev) => prev.filter((f) => f.key !== key));
      }, 600);
    };

    forgeVFX.callbacks.affinity = (id) => {
      const key = `affinity-${id}-${Date.now()}`;
      setAffinities((prev) => [...prev, { id, key }]);
      setTimeout(() => {
        setAffinities((prev) => prev.filter((a) => a.key !== key));
      }, 1200);
    };

    return () => {
      forgeVFX.callbacks.attach = null;
      forgeVFX.callbacks.forge = null;
      forgeVFX.callbacks.affinity = null;
    };
  }, []);

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
      {/* MOD ATTACHMENT BURSTS */}
      {attachments.map((event) => (
        <ModAttachmentBurst key={event.key} modId={event.modId} />
      ))}

      {/* FORGE EDITION CEREMONIES */}
      {forges.map((event) => (
        <ForgeEditionRitual
          key={event.key}
          modId={event.modId}
          edition={event.edition}
        />
      ))}

      {/* AFFINITY PULSES */}
      {affinities.map((event) => (
        <AffinityPulse key={event.key} id={event.id} />
      ))}
    </div>
  );
}

/**
 * ModAttachmentBurst: Bursts of stars and wisps radiating from the attachment point
 */
function ModAttachmentBurst({ modId }: { modId: string }) {
  const STAR_COUNT = 8;
  const WISP_COUNT = 5;

  const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
    const angle = (i / STAR_COUNT) * Math.PI * 2;
    const distance = 60 + Math.random() * 40;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: i * 40,
      duration: 600 + Math.random() * 200,
    };
  });

  const wisps = Array.from({ length: WISP_COUNT }, (_, i) => {
    const angle = (i / WISP_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 40 + Math.random() * 60;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      scale: 0.5 + Math.random() * 0.8,
      delay: i * 50,
      duration: 700 + Math.random() * 300,
    };
  });

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        marginLeft: -32,
        marginTop: -32,
        width: 64,
        height: 64,
        pointerEvents: 'none',
      }}
    >
      {/* Center glow pulse */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #7be3ff88 0%, transparent 100%)',
          animation: 'dieAttachPulse 600ms cubic-bezier(0.34, 1.06, 0.64, 1)',
        }}
      />

      {/* Radiating stars */}
      {stars.map((star) => (
        <div
          key={`star-${star.id}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -6,
            marginTop: -6,
            width: 12,
            height: 12,
            fontSize: 12,
            lineHeight: '12px',
            textAlign: 'center',
            color: '#7be3ff',
            textShadow: '0 0 8px #7be3ff',
            pointerEvents: 'none',
            ['--burst-x' as any]: `${star.x}px`,
            ['--burst-y' as any]: `${star.y}px`,
            animation: `modAttachBurst ${star.duration}ms cubic-bezier(0.34, 1.06, 0.64, 1) ${star.delay}ms forwards`,
          }}
        >
          ✦
        </div>
      ))}

      {/* Particle wisps */}
      {wisps.map((wisp) => (
        <div
          key={`wisp-${wisp.id}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -8,
            marginTop: -8,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: `radial-gradient(circle, #7be3ff60 0%, transparent 100%)`,
            pointerEvents: 'none',
            ['--wisp-x' as any]: `${wisp.x}px`,
            ['--wisp-y' as any]: `${wisp.y}px`,
            animation: `particleWisp ${wisp.duration}ms cubic-bezier(0.34, 1.06, 0.64, 1) ${wisp.delay}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * ForgeEditionRitual: Orbs merging into the mod card during edition forging
 */
function ForgeEditionRitual({ modId, edition }: { modId: string; edition: string }) {
  const editionColors: Record<string, string> = {
    foil: '#a78bfa',
    holo: '#f97316',
    poly: '#06b6d4',
  };

  const color = editionColors[edition] || '#7be3ff';

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
        marginLeft: -48,
        marginTop: -48,
        width: 96,
        height: 96,
        pointerEvents: 'none',
      }}
    >
      {/* Central fusion point glow */}
      <div
        style={{
          position: 'absolute',
          inset: '50%',
          marginLeft: -24,
          marginTop: -24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}aa 0%, ${color}44 50%, transparent 100%)`,
          animation: 'lightShaftBreathe 1200ms ease-in-out infinite',
          filter: `drop-shadow(0 0 24px ${color})`,
        }}
      />

      {/* Orbiting edition orbs */}
      {orbs.map((orb) => {
        const radius = 40;
        const x = Math.cos(orb.angle) * radius;
        const y = Math.sin(orb.angle) * radius;

        return (
          <div
            key={`orb-${orb.id}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              marginLeft: -12,
              marginTop: -12,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, ${color}cc 0%, ${color}44 60%, rgba(15, 9, 37, 0.85) 100%)`,
              border: `1px solid ${color}aa`,
              boxShadow: `0 0 16px ${color}66, inset 0 0 12px ${color}55`,
              animation: `forgeConfirm 600ms cubic-bezier(0.34, 1.06, 0.64, 1) ${orb.delay}ms forwards`,
              ['--merge-x' as any]: `${-x}px`,
              ['--merge-y' as any]: `${-y}px`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * AffinityPulse: Golden glow intensification on affinity link arcs
 */
function AffinityPulse({ id }: { id: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        marginLeft: -200,
        marginTop: -200,
        width: 400,
        height: 400,
        pointerEvents: 'none',
        ['data-affinity-pulse' as any]: id,
      }}
    >
      {/* Radiating golden rings */}
      {[0, 1, 2].map((ring) => (
        <div
          key={`ring-${ring}`}
          style={{
            position: 'absolute',
            inset: `${ring * 30}px`,
            borderRadius: '50%',
            border: `1px solid rgba(245, 196, 81, ${0.6 - ring * 0.15})`,
            animation: `affinityArcPulse ${800 + ring * 200}ms ease-out ${ring * 100}ms forwards`,
          }}
        />
      ))}

      {/* Center focus point */}
      <div
        style={{
          position: 'absolute',
          inset: '50%',
          marginLeft: -4,
          marginTop: -4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#f5c451',
          boxShadow: '0 0 20px #f5c451',
          animation: 'sparkle 800ms ease-in-out',
        }}
      />
    </div>
  );
}

export default ForgeVFX;
