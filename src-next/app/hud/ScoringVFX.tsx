import React, { useEffect, useRef, useState } from 'react';

/**
 * ScoringVFX Refined — Orchestrated scoring theatre as narrative arc
 *
 * The scoring sequence tells a story:
 * 1. BUILDING PHASE: Slams establish multiplier tier, each one escalates
 * 2. CROSSROADS: Target beat or bail moment (turning point)
 * 3. CLIMAX: Boom number reveals, new best stamp, stars fly home
 * 4. RESOLUTION: Score counter catches stars, screen settles
 *
 * Effects are state-driven: gold on successful cross, crimson on bail,
 * star count + burst radius scaled by finalTotal / target ratio.
 */

type ShakeIntensity = 'tiny' | 'mid' | 'big';

type SlamEvent = {
  id: string;
  label: string;
  multiplier: number;
  gold: boolean;
  tint?: string | null;
};

type BoomEvent = {
  id: string;
  total: number;
  crossed: boolean;
  isNewBest: boolean;
  ratio: number;
};

export const scoringVFX = {
  callbacks: {
    slam: null as ((label: string, multiplier: number, gold: boolean, tint?: string | null) => void) | null,
    targetBeat: null as (() => void) | null,
    bail: null as (() => void) | null,
    boom: null as ((total: number, crossed: boolean, isNewBest: boolean, ratio: number) => void) | null,
    shakeScreen: null as ((intensity: ShakeIntensity) => void) | null,
    chromatic: null as ((duration: number) => void) | null,
    crossTargetCascade: null as (() => void) | null,
  },

  triggerSlam(label: string, multiplier: number, gold: boolean = false, tint: string | null = null) {
    if (this.callbacks.slam) this.callbacks.slam(label, multiplier, gold, tint);
  },

  triggerTargetBeat() {
    if (this.callbacks.targetBeat) this.callbacks.targetBeat();
  },

  triggerBail() {
    if (this.callbacks.bail) this.callbacks.bail();
  },

  // Boom is the climax moment. ratio = finalTotal / targetScore (affects intensity).
  triggerBoom(total: number, crossed: boolean = false, isNewBest: boolean = false, ratio: number = 1) {
    if (this.callbacks.boom) this.callbacks.boom(total, crossed, isNewBest, ratio);
  },

  shakeScreen(intensity: ShakeIntensity = 'mid') {
    if (this.callbacks.shakeScreen) this.callbacks.shakeScreen(intensity);
  },

  chromatic(duration: number = 480) {
    if (this.callbacks.chromatic) this.callbacks.chromatic(duration);
  },

  // Golden screen flash when score crosses the round target.
  triggerCrossTargetCascade() {
    if (this.callbacks.crossTargetCascade) this.callbacks.crossTargetCascade();
  },
};

export function ScoringVFX() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [slams, setSlams] = useState<SlamEvent[]>([]);
  const [targetBeat, setTargetBeat] = useState(false);
  const [bail, setBail] = useState(false);
  const [boom, setBoom] = useState<BoomEvent | null>(null);
  const [shakeClass, setShakeClass] = useState('');
  const [chromaticActive, setChromaticActive] = useState(false);
  const [crossTargetFlash, setCrossTargetFlash] = useState(false);

  useEffect(() => {
    scoringVFX.callbacks.slam = (label, multiplier, gold, tint) => {
      const id = `slam-${Date.now()}-${Math.random()}`;
      const event: SlamEvent = { id, label, multiplier, gold, tint };
      setSlams((prev) => [...prev, event]);
      setTimeout(() => {
        setSlams((prev) => prev.filter((s) => s.id !== id));
      }, 800);
    };

    scoringVFX.callbacks.targetBeat = () => {
      setTargetBeat(true);
      setTimeout(() => setTargetBeat(false), 800);
    };

    scoringVFX.callbacks.bail = () => {
      setBail(true);
      setTimeout(() => setBail(false), 2600);
    };

    scoringVFX.callbacks.boom = (total, crossed, isNewBest, ratio) => {
      setBoom({ id: `boom-${Date.now()}`, total, crossed, isNewBest, ratio });
    };

    scoringVFX.callbacks.shakeScreen = (intensity) => {
      const durationMs = intensity === 'tiny' ? 150 : intensity === 'mid' ? 320 : 520;
      setShakeClass(`vfx-shake-${intensity}`);
      setTimeout(() => setShakeClass(''), durationMs);
    };

    scoringVFX.callbacks.chromatic = (duration) => {
      setChromaticActive(true);
      setTimeout(() => setChromaticActive(false), duration);
    };

    scoringVFX.callbacks.crossTargetCascade = () => {
      setCrossTargetFlash(true);
      setTimeout(() => setCrossTargetFlash(false), 600);
    };

    return () => {
      scoringVFX.callbacks.slam = null;
      scoringVFX.callbacks.targetBeat = null;
      scoringVFX.callbacks.bail = null;
      scoringVFX.callbacks.boom = null;
      scoringVFX.callbacks.shakeScreen = null;
      scoringVFX.callbacks.chromatic = null;
      scoringVFX.callbacks.crossTargetCascade = null;
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
      {/* Screen shake + chromatic layer */}
      <div
        className={shakeClass}
        style={{
          position: 'absolute',
          inset: 0,
          animation: chromaticActive ? 'screenChromatic 480ms ease-out forwards' : undefined,
        }}
      />

      {/* Cross-target flash (golden screen glow) */}
      {crossTargetFlash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(245,196,81,0.4) 0%, rgba(245,196,81,0.1) 50%, transparent 100%)',
            animation: 'crossTargetFlash 600ms ease-out forwards',
            pointerEvents: 'none',
          }}
        />
      )}

      {slams.map((slam) => (
        <SlamPopup key={slam.id} event={slam} />
      ))}

      {targetBeat && <TargetBeatStamp />}
      {bail && <BailStamp />}
      {boom && <BoomSequence event={boom} onComplete={() => setBoom(null)} />}
    </div>
  );
}

/**
 * Multiplier badge with contextual coloring:
 * gold for post-target, orange-red for default, magenta for special tint.
 */
function SlamPopup({ event }: { event: SlamEvent }) {
  const isMagenta = event.tint === 'magenta';
  const baseColor = isMagenta ? '#cc88ff' : event.gold ? '#f5c451' : '#ff7847';
  const bgOpacity = event.gold ? 0.25 : 0.18;

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          padding: '10px 22px',
          borderRadius: 10,
          background: `${baseColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
          border: `2px solid ${baseColor}`,
          color: baseColor,
          fontSize: 32,
          fontWeight: 700,
          fontFamily: 'monospace',
          boxShadow: `0 0 28px ${baseColor}99, inset 0 0 12px ${baseColor}33`,
          animation: 'slamPopEnhanced 500ms cubic-bezier(0.2, 1.4, 0.5, 1) forwards',
          whiteSpace: 'nowrap',
        }}
      >
        ×{event.multiplier}
      </div>
    </div>
  );
}

/**
 * Celebratory stamp when crossing the target: gold, 3D rotation entrance.
 */
function TargetBeatStamp() {
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        perspective: '1000px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: '"Cinzel Decorative", serif',
          fontSize: 56,
          fontWeight: 900,
          color: '#f5c451',
          letterSpacing: '0.15em',
          textShadow: '0 0 40px #f5c451, 0 0 80px rgba(245,196,81,0.5)',
          animation: 'targetBeatPop 600ms cubic-bezier(0.2, 1.6, 0.5, 1) forwards',
          whiteSpace: 'nowrap',
        }}
      >
        ★ TARGET BEAT ★
      </div>
    </div>
  );
}

/**
 * Failure stamp when not reaching target: red, sustained hold, then fades.
 */
function BailStamp() {
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: '"Cinzel Decorative", serif',
          fontSize: 52,
          fontWeight: 900,
          color: '#ff4d6d',
          letterSpacing: '0.18em',
          textShadow: '0 0 40px #ff4d6d, 0 0 80px rgba(255,77,109,0.4)',
          animation: 'bailStampPop 2600ms cubic-bezier(0.2, 1.6, 0.5, 1) forwards',
          whiteSpace: 'nowrap',
        }}
      >
        NOT ENOUGH
      </div>
    </div>
  );
}

/**
 * Final score reveal: pop → hold → fly with star cascade.
 * Phases: pop (400ms) / hold (1400–1500ms) / fly (800ms).
 * High-ratio booms get 16 stars + wider burst.
 */
function BoomSequence({
  event,
  onComplete,
}: {
  event: BoomEvent;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'pop' | 'hold' | 'fly'>('pop');
  const boomRef = useRef<HTMLDivElement>(null);
  const HOLD_MS = event.crossed ? 1500 : 1400;
  const FLY_MS = 800;
  const STAR_COUNT = event.ratio > 2 ? 16 : 12;

  useEffect(() => {
    const popTimer = setTimeout(() => setPhase('hold'), 400);
    const holdTimer = setTimeout(() => setPhase('fly'), 400 + HOLD_MS);
    const flyTimer = setTimeout(() => onComplete(), 400 + HOLD_MS + FLY_MS);

    return () => {
      clearTimeout(popTimer);
      clearTimeout(holdTimer);
      clearTimeout(flyTimer);
    };
  }, [event, onComplete, HOLD_MS, FLY_MS]);

  const boomColor = event.crossed ? '#f5c451' : '#fff';
  const boomGlow = event.crossed
    ? '0 0 48px #f5c451, 0 0 96px rgba(245,196,81,0.6)'
    : '0 0 48px #7be3ff, 0 0 96px rgba(123,227,255,0.5)';
  const starColor = event.crossed ? '#f5c451' : '#7be3ff';

  const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: i,
    angle: (i / STAR_COUNT) * Math.PI * 2,
    delay: i * (event.ratio > 2 ? 25 : 35),
    distance: 60 + Math.random() * (event.ratio > 2 ? 100 : 80),
  }));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {event.ratio > 1.5 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -240,
            marginTop: -240,
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${starColor}44 0%, transparent 100%)`,
            animation: `radioBurst ${FLY_MS}ms cubic-bezier(0.34, 1.06, 0.64, 1)`,
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        ref={boomRef}
        style={{
          fontSize: 120,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: boomColor,
          textShadow: boomGlow,
          animation:
            phase === 'pop'
              ? 'boomNumberPop 400ms cubic-bezier(0.2, 1.4, 0.5, 1) forwards'
              : phase === 'hold'
                ? 'boomNumberHold 1500ms ease-in-out infinite'
                : `boomNumberFly ${FLY_MS}ms ease-in forwards`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {event.total.toLocaleString()}
      </div>

      {event.isNewBest && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(50% - 140px)',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: '0.6em',
            color: '#f5c451',
            textShadow: '0 0 20px #f5c451, 0 0 40px rgba(245,196,81,0.7)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            animation: 'newBestGlow 1400ms ease-in-out infinite',
            pointerEvents: 'none',
          }}
        >
          ★ NEW BEST ★
        </div>
      )}

      {phase === 'fly' &&
        stars.map((star) => (
          <div
            key={`star-${star.id}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              marginLeft: -14,
              marginTop: -14,
              width: 28,
              height: 28,
              fontSize: 28,
              lineHeight: '28px',
              textAlign: 'center',
              color: starColor,
              textShadow: `0 0 16px ${starColor}, 0 0 32px ${starColor}`,
              animation: `starFlyEnhanced ${FLY_MS}ms cubic-bezier(0.34, 1.06, 0.64, 1) ${star.delay}ms forwards`,
              ['--fly-x' as never]: `${Math.cos(star.angle) * star.distance * 4}px`,
              ['--fly-y' as never]: `${Math.sin(star.angle) * star.distance * 4}px`,
              pointerEvents: 'none',
            } as React.CSSProperties}
          >
            ★
          </div>
        ))}
    </div>
  );
}

export default ScoringVFX;
