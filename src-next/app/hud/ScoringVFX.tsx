import React, { useEffect, useRef, useState } from 'react';

/**
 * ScoringVFX: Enhanced cosmic/ethereal visual effects for scoring theatre
 * 
 * This component provides:
 * - Enhanced multiplier slam popups with glow and fade
 * - Target beat / bail stamps with rotation and chromatic effects
 * - Boom number reveal with hold and fly-to-counter sequence
 * - Star fly animation with trails toward score counter
 * - Screen shake and chromatic aberration for mega-booms
 * - NEW BEST stamp with steady glow pulse
 * - Cross-target flash effect
 * 
 * Integration:
 * 1. Import and render at the top level of your Round/Scoring screen
 * 2. Import the CSS file: import './ScoringVFX.css'
 * 3. Dispatch events via scoringVFX.triggerSlam(), triggerBoom(), etc.
 * 4. For screen shake: call scoringVFX.shakeScreen(intensity)
 * 5. For CA effect: call scoringVFX.chromatic(duration)
 */

export const scoringVFX = {
  callbacks: {
    slam: null as ((label: string, multiplier: number, gold: boolean, tint?: string) => void) | null,
    targetBeat: null as (() => void) | null,
    bail: null as (() => void) | null,
    boom: null as ((total: number, gold: boolean, isNewBest: boolean) => void) | null,
    shakeScreen: null as ((intensity: 'tiny' | 'mid' | 'big') => void) | null,
    chromatic: null as ((duration: number) => void) | null,
  },

  triggerSlam(label: string, multiplier: number, gold: boolean = false, tint?: string) {
    if (this.callbacks.slam) this.callbacks.slam(label, multiplier, gold, tint);
  },

  triggerTargetBeat() {
    if (this.callbacks.targetBeat) this.callbacks.targetBeat();
  },

  triggerBail() {
    if (this.callbacks.bail) this.callbacks.bail();
  },

  triggerBoom(total: number, gold: boolean = false, isNewBest: boolean = false) {
    if (this.callbacks.boom) this.callbacks.boom(total, gold, isNewBest);
  },

  shakeScreen(intensity: 'tiny' | 'mid' | 'big' = 'mid') {
    if (this.callbacks.shakeScreen) this.callbacks.shakeScreen(intensity);
  },

  chromatic(duration: number = 480) {
    if (this.callbacks.chromatic) this.callbacks.chromatic(duration);
  },
};

type SlamEvent = {
  id: string;
  label: string;
  multiplier: number;
  gold: boolean;
  tint?: string;
};

type BoomEvent = {
  id: string;
  total: number;
  gold: boolean;
  isNewBest: boolean;
};

export function ScoringVFX() {
  const containerRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [slams, setSlams] = useState<SlamEvent[]>([]);
  const [targetBeat, setTargetBeat] = useState(false);
  const [bail, setBail] = useState(false);
  const [boom, setBoom] = useState<BoomEvent | null>(null);
  const [shakeClass, setShakeClass] = useState('');
  const [chromaticActive, setChromaticActive] = useState(false);

  useEffect(() => {
    // Register external callbacks
    scoringVFX.callbacks.slam = (label, multiplier, gold, tint) => {
      const id = `slam-${Date.now()}-${Math.random()}`;
      const event: SlamEvent = { id, label, multiplier, gold, tint };
      setSlams((prev) => [...prev, event]);

      // Remove after animation completes
      setTimeout(() => {
        setSlams((prev) => prev.filter((s) => s.id !== id));
      }, 600);
    };

    scoringVFX.callbacks.targetBeat = () => {
      setTargetBeat(true);
      setTimeout(() => setTargetBeat(false), 700);
    };

    scoringVFX.callbacks.bail = () => {
      setBail(true);
      setTimeout(() => setBail(false), 2400);
    };

    scoringVFX.callbacks.boom = (total, gold, isNewBest) => {
      setBoom({ id: `boom-${Date.now()}`, total, gold, isNewBest });
    };

    scoringVFX.callbacks.shakeScreen = (intensity) => {
      const durationMs = intensity === 'tiny' ? 150 : intensity === 'mid' ? 300 : 500;
      setShakeClass(`vfx-shake-${intensity}`);
      setTimeout(() => setShakeClass(''), durationMs);
    };

    scoringVFX.callbacks.chromatic = (duration) => {
      setChromaticActive(true);
      setTimeout(() => setChromaticActive(false), duration);
    };

    return () => {
      scoringVFX.callbacks.slam = null;
      scoringVFX.callbacks.targetBeat = null;
      scoringVFX.callbacks.bail = null;
      scoringVFX.callbacks.boom = null;
      scoringVFX.callbacks.shakeScreen = null;
      scoringVFX.callbacks.chromatic = null;
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
      {/* Screen shake & chromatic aberration layer */}
      <div
        ref={screenRef}
        className={shakeClass}
        style={{
          position: 'absolute',
          inset: 0,
          animation: chromaticActive ? 'screenChromatic 480ms ease-out forwards' : undefined,
        }}
      />

      {/* Multiplier slams */}
      {slams.map((slam) => (
        <SlamPopup key={slam.id} event={slam} />
      ))}

      {/* Target beat stamp */}
      {targetBeat && <TargetBeatStamp />}

      {/* Bail stamp */}
      {bail && <BailStamp />}

      {/* Boom sequence */}
      {boom && <BoomSequence event={boom} onComplete={() => setBoom(null)} />}
    </div>
  );
}

/**
 * SlamPopup: Multiplier badge with glow and fade
 */
function SlamPopup({ event }: { event: SlamEvent }) {
  const isMagenta = event.tint === 'magenta';
  const baseColor = isMagenta ? '#cc88ff' : event.gold ? '#f5c451' : '#ff7847';

  return (
    <div
      className="vfx-slam"
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        marginLeft: -28,
        marginTop: -20,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          padding: '8px 18px',
          borderRadius: 8,
          background: `${baseColor}20`,
          border: `2px solid ${baseColor}`,
          color: baseColor,
          fontSize: 28,
          fontWeight: 700,
          fontFamily: 'monospace',
          boxShadow: `0 0 24px ${baseColor}`,
          animation: 'slamPopEnhanced 400ms cubic-bezier(0.2, 1.4, 0.5, 1) forwards',
          whiteSpace: 'nowrap',
        }}
      >
        ×{event.multiplier}
      </div>
    </div>
  );
}

/**
 * TargetBeatStamp: Gold stamp with 3D rotation
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
          fontSize: 48,
          fontWeight: 900,
          color: '#f5c451',
          letterSpacing: '0.2em',
          textShadow: '0 0 30px #f5c451',
          animation: 'targetBeatPop 500ms cubic-bezier(0.2, 1.6, 0.5, 1) forwards',
          whiteSpace: 'nowrap',
        }}
      >
        TARGET BEAT
      </div>
    </div>
  );
}

/**
 * BailStamp: Red stamp indicating failure
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
          fontSize: 48,
          fontWeight: 900,
          color: '#ff4d6d',
          letterSpacing: '0.2em',
          textShadow: '0 0 30px #ff4d6d',
          animation: 'bailStampPop 2400ms cubic-bezier(0.2, 1.6, 0.5, 1) forwards',
          whiteSpace: 'nowrap',
        }}
      >
        NOT ENOUGH
      </div>
    </div>
  );
}

/**
 * BoomSequence: Final score reveal, hold, and star fly
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
  const HOLD_MS = event.gold ? 1500 : 1400;
  const FLY_MS = 800;
  const STAR_COUNT = 12;

  useEffect(() => {
    // Pop phase: 400ms
    const popTimer = setTimeout(() => {
      setPhase('hold');
    }, 400);

    // Hold phase
    const holdTimer = setTimeout(() => {
      setPhase('fly');
    }, 400 + HOLD_MS);

    // Fly phase
    const flyTimer = setTimeout(() => {
      onComplete();
    }, 400 + HOLD_MS + FLY_MS);

    return () => {
      clearTimeout(popTimer);
      clearTimeout(holdTimer);
      clearTimeout(flyTimer);
    };
  }, [event, onComplete]);

  const boomColor = event.gold ? '#f5c451' : '#fff';
  const boomGlow = event.gold
    ? '0 0 40px #f5c451, 0 0 80px rgba(245,196,81,0.5)'
    : '0 0 40px #7be3ff, 0 0 80px rgba(123,227,255,0.5)';
  const starColor = event.gold ? '#f5c451' : '#7be3ff';

  const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: i,
    angle: (i / STAR_COUNT) * Math.PI * 2,
    delay: i * 30,
    distance: 40 + Math.random() * 80,
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
      {/* Radiating burst (mega-boom effect) */}
      {event.gold && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -200,
            marginTop: -200,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #f5c45144 0%, transparent 100%)',
            animation: 'radioBurst 800ms cubic-bezier(0.34, 1.06, 0.64, 1)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Boom number */}
      <div
        ref={boomRef}
        className="vfx-boom"
        style={{
          fontSize: 96,
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

      {/* NEW BEST stamp */}
      {event.isNewBest && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(50% - 100px)',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: '0.5em',
            color: '#f5c451',
            textShadow: '0 0 14px #f5c451, 0 0 28px rgba(245,196,81,0.6)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            animation: 'newBestGlow 1200ms ease-in-out infinite',
            pointerEvents: 'none',
          }}
        >
          ★ NEW BEST ★
        </div>
      )}

      {/* Stars (only in fly phase for performance) */}
      {phase === 'fly' &&
        stars.map((star) => (
          <div
            key={`star-${star.id}`}
            className="vfx-star"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              marginLeft: -12,
              marginTop: -12,
              width: 24,
              height: 24,
              fontSize: 24,
              lineHeight: '24px',
              textAlign: 'center',
              color: starColor,
              textShadow: `0 0 12px ${starColor}, 0 0 24px ${starColor}`,
              animation: `starFlyEnhanced ${FLY_MS}ms cubic-bezier(0.34, 1.06, 0.64, 1) ${star.delay}ms forwards`,
              ['--fly-x' as any]: `${Math.cos(star.angle) * star.distance * 3}px`,
              ['--fly-y' as any]: `${Math.sin(star.angle) * star.distance * 3}px`,
              pointerEvents: 'none',
            }}
          >
            ★
          </div>
        ))}
    </div>
  );
}

export default ScoringVFX;
