import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import { stageScale } from '../../render/stage';
import { triggerShake } from '../visual/screenShake';
import type { Beat } from '../../core/scoring/types';
import { Z } from './zLayers';
import { store } from '../../state/store';
import { useIsTightStage } from '../hooks/useIsCompactStage';

type SlamOverlay = { id: number; label: string; multiplier: number; gold: boolean; tint?: 'gold' | 'magenta' };

type Star = { id: number; dx: number; dy: number; delay: number };

type BoomState =
  | { phase: 'hold'; total: number; gold: boolean; isNewBest: boolean }
  | { phase: 'fly';  total: number; gold: boolean; stars: Star[]; isNewBest: boolean };

let slamId = 1;

const HOLD_GOLD_MS = 1500;
const HOLD_BASE_MS = 1400;
const FLY_MS = 800;
const STAR_COUNT = 12;

const CONSTELLATION_NAMES: Record<string, string> = {
  FIVE_KIND: 'Cygnus',
  FOUR_KIND: 'Orion',
  FULL_HOUSE: 'Pegasus',
  THREE_KIND: 'Auriga',
  LG_STRAIGHT: 'Lyra',
  SM_STRAIGHT: 'Cassiopeia',
  TWO_PAIR: 'Gemini',
  ONE_PAIR: 'Vela',
  CHANCE: 'Wandering Star',
};

function isReducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
}

export function ScoreMoment() {
  // Tight viewports: shrink the boom + slams + stamp so the centered
  // overlay stops overflowing a 360×640 phone. Wide-mode untouched.
  const tight = useIsTightStage();
  const [active, setActive] = useState(false);
  const [comboName, setComboName] = useState('');
  const [slams, setSlams] = useState<SlamOverlay[]>([]);
  const [stamp, setStamp] = useState<'target' | 'bail' | null>(null);
  const [boom, setBoom] = useState<BoomState | null>(null);
  const boomRef = useRef<HTMLDivElement>(null);
  const timerIdsRef = useRef<number[]>([]);

  useEffect(() => {
    let crossed = false;

    const clearAllTimers = () => {
      for (const id of timerIdsRef.current) clearTimeout(id);
      timerIdsRef.current = [];
    };
    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timerIdsRef.current = timerIdsRef.current.filter((t) => t !== id);
        fn();
      }, ms);
      timerIdsRef.current.push(id);
    };

    const finishBoom = () => {
      // Fire the catch pulse on the score counter, then end scoring.
      const counter = document.querySelector<HTMLElement>('[data-score-counter]');
      if (counter) {
        counter.style.animation = 'scoreCounterCatch 220ms cubic-bezier(0.2, 1.6, 0.4, 1)';
        schedule(() => {
          if (counter) counter.style.animation = '';
        }, 240);
      }
      setActive(false);
      setBoom(null);
      dispatch({ type: 'END_SCORING' });
    };

    const off = bus.on('onScoreBeat', ({ beat }: { beat: Beat }) => {
      switch (beat.kind) {
        case 'cast-swell':
          clearAllTimers();
          setActive(true);
          setComboName('');
          setSlams([]);
          setStamp(null);
          setBoom(null);
          crossed = false;
          break;
        case 'combo-bonus':
          setComboName(CONSTELLATION_NAMES[beat.comboLabel] ?? beat.comboLabel);
          break;
        case 'mult-slam': {
          const id = slamId++;
          setSlams((s) => [...s, { id, label: beat.label, multiplier: beat.multiplier, gold: crossed, tint: beat.tint }]);
          // Bigger mults punch harder. Threshold tuned so common pair-mults
          // don't shake; only meaningful x4+ slams or post-cross slams do.
          if (beat.multiplier >= 4 || crossed) triggerShake('tiny');
          schedule(() => setSlams((s) => s.filter((x) => x.id !== id)), 600);
          break;
        }
        case 'cross-target':
          crossed = true;
          setStamp('target');
          triggerShake('mid');
          schedule(() => setStamp((cur) => (cur === 'target' ? null : cur)), 700);
          break;
        case 'boom': {
          const gold = beat.crossedTarget;
          if (gold) triggerShake('big');
          const reduced = isReducedMotion();
          // Mega-boom hit-stop: when the final score is ≥ 3× the target,
          // freeze the stage with chromatic aberration for ~480ms so the
          // big number actually LANDS. Above 8× we extend to 720ms.
          // Reduced-motion users skip — the effect is purely cosmetic.
          const ratio = beat.megaRatio ?? 0;
          if (ratio >= 3 && !reduced) {
            const stage = document.getElementById('stage-root');
            if (stage) {
              const tier = ratio >= 8 ? 'mega-boom-deep' : 'mega-boom';
              stage.classList.add(tier);
              const dur = ratio >= 8 ? 720 : 480;
              schedule(() => stage.classList.remove(tier), dur);
            }
          }
          const useStars = gold && !reduced;
          const hold = gold ? HOLD_GOLD_MS : HOLD_BASE_MS;
          // New-best detection — updateRunStats has already mutated
          // peakHand by the time boom fires, so we check whether the
          // current peak EQUALS this hand's total. If so, this hand
          // IS the run's best (possibly tied with a prior identical
          // hand — the celebration still fires, which is fine since
          // matching your record is itself a moment).
          const peakHandNow = store.getState().run.runStats?.peakHand ?? 0;
          const isNewBest = peakHandNow > 0 && peakHandNow === beat.finalTotal;

          setBoom({ phase: 'hold', total: beat.finalTotal, gold, isNewBest });

          schedule(() => {
            if (!useStars) {
              setActive(false);
              setBoom(null);
              dispatch({ type: 'END_SCORING' });
              return;
            }
            // Measure source (boom number) and target (score counter).
            const fromEl = boomRef.current;
            const toEl = document.querySelector<HTMLElement>('[data-score-counter]');
            if (!fromEl || !toEl) {
              setActive(false);
              setBoom(null);
              dispatch({ type: 'END_SCORING' });
              return;
            }
            const fr = fromEl.getBoundingClientRect();
            const tr = toEl.getBoundingClientRect();
            const scale = stageScale() || 1;
            const dx = ((tr.left + tr.width / 2) - (fr.left + fr.width / 2)) / scale;
            const dy = ((tr.top  + tr.height / 2) - (fr.top  + fr.height / 2)) / scale;
            const stars: Star[] = Array.from({ length: STAR_COUNT }, (_, i) => ({
              id: i,
              dx: dx + (Math.random() - 0.5) * 60,
              dy: dy + (Math.random() - 0.5) * 24,
              delay: i * 30,
            }));
            setBoom({ phase: 'fly', total: beat.finalTotal, gold, stars, isNewBest });
            schedule(finishBoom, FLY_MS);
          }, hold);
          break;
        }
        case 'bail':
          setStamp('bail');
          triggerShake('mid');
          schedule(() => {
            setActive(false);
            setStamp(null);
            dispatch({ type: 'END_SCORING' });
          }, 2400);
          break;
      }
    });
    return () => {
      off();
      clearAllTimers();
    };
  }, []);

  if (!active) return null;

  const boomColor = boom?.gold ? '#f5c451' : '#fff';
  const boomGlow = boom?.gold
    ? '0 0 40px #f5c451, 0 0 80px rgba(245,196,81,0.5)'
    : '0 0 40px #7be3ff, 0 0 80px rgba(123,227,255,0.5)';
  const starColor = boom?.gold ? '#f5c451' : '#7be3ff';

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: Z.fx,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {comboName && (
        <div className="f-display" style={{
          fontSize: tight ? 22 : 32, color: '#f5c451',
          textShadow: '0 0 24px rgba(245,196,81,0.7)',
          letterSpacing: '0.18em', marginBottom: tight ? 12 : 18,
          animation: 'chipPop 200ms ease-out',
        }}>
          {comboName}
        </div>
      )}
      <div style={{
        display: 'flex',
        // Slams wrap on tight so a 4+ mult chain doesn't blow past the
        // viewport edge. 18px gap shrinks to 10px to keep wrapped rows
        // visually grouped instead of spilling.
        flexWrap: tight ? 'wrap' : 'nowrap',
        justifyContent: 'center',
        gap: tight ? 10 : 18,
        marginBottom: tight ? 12 : 18,
        maxWidth: tight ? 'calc(100vw - 32px)' : undefined,
      }}>
        {slams.map((s) => {
          const isMagenta = s.tint === 'magenta';
          const baseColor = isMagenta ? '#cc88ff' : (s.gold ? '#f5c451' : '#ff7847');
          return (
            <div key={s.id} className="f-mono" style={{
              padding: tight ? '6px 12px' : '8px 18px', borderRadius: 8,
              background: `${baseColor}20`,
              border: `2px solid ${baseColor}`,
              color: baseColor,
              fontSize: tight ? 20 : 28, fontWeight: 700,
              boxShadow: `0 0 24px ${baseColor}`,
              animation: 'boomPop 250ms cubic-bezier(0.2, 1.4, 0.5, 1)',
            }}>
              ×{s.multiplier}
            </div>
          );
        })}
      </div>
      {stamp === 'target' && (
        <div style={{
          position: 'absolute',
          top: 'calc(var(--hud-top-h, 0px) + (var(--stage-h, 100vh) - var(--hud-top-h, 0px) - var(--hud-bottom-h, 0px)) * 0.32)',
          fontFamily: '"Cinzel Decorative", serif', fontSize: tight ? 32 : 48, fontWeight: 900,
          color: '#f5c451', letterSpacing: '0.2em',
          textShadow: '0 0 30px #f5c451',
          animation: 'boomPop 350ms cubic-bezier(0.2, 1.6, 0.5, 1)',
        }}>TARGET BEAT</div>
      )}
      {stamp === 'bail' && (
        <div style={{
          position: 'absolute',
          top: 'calc(var(--hud-top-h, 0px) + (var(--stage-h, 100vh) - var(--hud-top-h, 0px) - var(--hud-bottom-h, 0px)) * 0.32)',
          fontFamily: '"Cinzel Decorative", serif', fontSize: tight ? 32 : 48, fontWeight: 900,
          color: '#ff4d6d', letterSpacing: '0.2em',
          textShadow: '0 0 30px #ff4d6d',
          animation: 'boomPop 350ms cubic-bezier(0.2, 1.6, 0.5, 1)',
        }}>NOT ENOUGH</div>
      )}
      {boom && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            ref={boomRef}
            className="f-mono num"
            style={{
              fontSize: tight ? 60 : 96, fontWeight: 700,
              color: boomColor,
              textShadow: boomGlow,
              animation: boom.phase === 'fly'
                ? 'boomImplode 200ms ease-in forwards'
                : 'boomPop 400ms cubic-bezier(0.2, 1.4, 0.5, 1)',
            }}
          >
            {boom.total.toLocaleString()}
          </div>
          {/* NEW BEST stamp — sits above the boom number for the run's
              new peak hand. Fires alongside the boom, fades through
              the hold + fly phases so it tracks with the celebration. */}
          {boom.isNewBest && (
            <div
              className="f-mono uc new-best-stamp"
              style={{
                position: 'absolute',
                top: -52,
                fontSize: 12, letterSpacing: '0.5em',
                color: '#f5c451',
                textShadow: '0 0 14px #f5c451, 0 0 28px rgba(245,196,81,0.6)',
                fontWeight: 900,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              ★ NEW BEST ★
            </div>
          )}
          {boom.phase === 'fly' && boom.stars.map((s) => (
            <div
              key={s.id}
              className="score-star f-display"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                marginLeft: -14,
                marginTop: -14,
                width: 28,
                height: 28,
                lineHeight: '28px',
                textAlign: 'center',
                fontSize: 24,
                color: starColor,
                textShadow: `0 0 12px ${starColor}, 0 0 24px ${starColor}`,
                pointerEvents: 'none',
                willChange: 'transform, opacity',
                ['--dx' as string]: `${s.dx}px`,
                ['--dy' as string]: `${s.dy}px`,
                animation: `starFly 720ms cubic-bezier(0.34, 1.06, 0.64, 1) ${s.delay}ms forwards`,
              }}
            >
              ★
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
