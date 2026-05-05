import { useStore, type GameState } from '../../state/store';
import { lookupConstellation, type Constellation } from '../../data/constellations';
import { maxNumericFace } from '../../data/dice';
import { useIsCompactStage } from '../hooks/useIsCompactStage';

// `useStore` is a thin wrapper over `useSyncExternalStore` and must return a
// stable reference for the same underlying state. Selectors that build a new
// array via `.map(...)` violate that contract and trigger React error #185
// (Maximum update depth) — see commit history for the prod regression. Subscribe
// to the dice array itself (a stable reference between updates) and derive the
// face/locked arrays during render instead.
const selectDice = (s: GameState) => s.round.dice;
const selectConstellationId = (s: GameState) => s.run.constellationId;
const selectFirstRollDone = (s: GameState) => s.round.firstRollDone;
const selectScoringMode = (s: GameState) => lookupConstellation(s.run.constellationId).modifiers?.scoringMode ?? 'combo';
const selectScoringOrder = (s: GameState) => s.round.scoringOrder;

// WILD sentinel value emitted by the simulation for wildcard faces.
const WILD_SENTINEL = -1;

function describeFace(f: number): string {
  if (f === WILD_SENTINEL) return '★';
  return String(f);
}

// Constellations whose dice all use d6 faces (1..6) get the readout hidden —
// pips on the 3D dice already convey the value unambiguously. Anything else
// (d12, d100, Fibonacci, Eclipse 0/1, wildcards) shows the readout.
function needsReadout(c: Constellation): boolean {
  for (const die of c.dice) {
    for (const f of die.faces) {
      if (typeof f !== 'number') return true;
      if (f < 1 || f > 6) return true;
    }
  }
  return false;
}

// Quartile-based palette for the hero readout — gives the player an immediate
// "how good is this roll" cue beyond the raw number. Max face triggers an
// emphasised glow tier.
type QuartileTone = { fg: string; glow: string; label: string };
function toneForFace(face: number, maxFace: number): QuartileTone {
  if (face === WILD_SENTINEL) return { fg: '#f5c451', glow: '#f5c451', label: 'WILD' };
  if (maxFace <= 0) return { fg: '#dcd4ff', glow: '#7be3ff', label: '' };
  if (face >= maxFace)            return { fg: '#fff3c4', glow: '#ffd66e', label: 'crit' };
  const ratio = face / maxFace;
  if (ratio >= 0.75)              return { fg: '#ffd66e', glow: '#f5c451', label: 'high' };
  if (ratio >= 0.50)              return { fg: '#7be3ff', glow: '#7be3ff', label: 'mid' };
  if (ratio >= 0.25)              return { fg: '#bba8ff', glow: '#9577ff', label: 'low' };
  return                                  { fg: '#7a6fa6', glow: '#5c39c4', label: 'cold' };
}

export function FaceReadout() {
  const constellationId = useStore(selectConstellationId);
  const dice = useStore(selectDice);
  const firstRollDone = useStore(selectFirstRollDone);
  const scoringMode = useStore(selectScoringMode);
  const scoringOrder = useStore(selectScoringOrder);
  const compact = useIsCompactStage();

  const constellation = lookupConstellation(constellationId);
  if (!needsReadout(constellation)) return null;
  if (!firstRollDone) return null;

  const faces = dice.map((d) => d.face);
  const locked = dice.map((d) => d.locked);

  // Captain-crew (Argo): highlight the highest HELD die as the captain — the
  // one that rides the catalyst multiplier — with quartile coloring + glow,
  // and render the other held dice smaller alongside as flat-chip "crew".
  // Mirrors the held-only contract in `core/phases/evaluation.ts:43-66` so
  // the on-screen captain matches what the engine actually scores. Unheld
  // dice render in a muted style so the player sees they don't contribute.
  if (scoringMode === 'captain_crew') {
    const numeric = faces.map((f) => (f === WILD_SENTINEL ? 0 : f));
    const heldIdxs = scoringOrder.filter((idx) => idx >= 0 && idx < faces.length);
    // First-occurrence (lowest die index) wins ties so the captain badge
    // doesn't jitter when two held dice show the same face.
    const captainIdx = heldIdxs.length > 0
      ? heldIdxs.reduce((best, i) => (numeric[i]! > numeric[best]! ? i : best), heldIdxs[0]!)
      : -1;
    const captainValue = captainIdx >= 0 ? numeric[captainIdx]! : 0;
    const captainMaxFace = maxNumericFace(constellation.dice[captainIdx]?.faces ?? []);
    const tone = toneForFace(captainValue, captainMaxFace);
    // Compact mode bumps every readout dimension since user feedback is the
    // row felt cramped against the dice on a landscape phone. Captain matches
    // desktop now (96), crew goes 36 → 60, gap 10 → 32. Position drops from
    // 38% → 30% so the numerals sit clear of the dice underneath.
    return (
      <div style={{
        position: 'absolute', left: '50%', top: compact ? '30%' : '38%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center', pointerEvents: 'none', zIndex: 4,
        display: 'flex', alignItems: 'center', gap: compact ? 32 : 18,
      }}>
        {faces.map((f, i) => {
          if (i === captainIdx) {
            return (
              <div key={i} style={{ textAlign: 'center' }}>
                <div className="f-mono uc" style={{
                  fontSize: compact ? 13 : 10, letterSpacing: '0.4em',
                  color: tone.glow, opacity: 0.85,
                }}>
                  {tone.label || '◇ captain ◇'}
                </div>
                <div className="f-display num" style={{
                  fontSize: compact ? 112 : 96, lineHeight: 1, color: tone.fg,
                  textShadow: `0 0 24px ${tone.glow}, 0 0 56px ${tone.glow}66`,
                  marginTop: 2,
                }}>
                  {describeFace(f)}
                </div>
              </div>
            );
          }
          const isHeld = heldIdxs.includes(i);
          if (isHeld) {
            return (
              <div key={i} style={{ textAlign: 'center' }}>
                <div className="f-mono uc" style={{
                  fontSize: compact ? 12 : 9, letterSpacing: '0.3em',
                  color: '#bba8ff', opacity: 0.6,
                }}>
                  crew
                </div>
                <div className="f-display num" style={{
                  fontSize: compact ? 60 : 36, lineHeight: 1,
                  color: '#dcd4ff',
                  marginTop: 2,
                }}>
                  {describeFace(f)}
                </div>
              </div>
            );
          }
          // Unheld: visible but clearly inert. No 'crew' label so the player
          // doesn't think this die contributes to the captain×mult + crew sum.
          return (
            <div key={i} style={{ textAlign: 'center', opacity: 0.35 }}>
              <div className="f-mono uc" style={{
                fontSize: compact ? 12 : 9, letterSpacing: '0.3em',
                color: '#7a6fa6', opacity: 0.7,
              }}>
                unheld
              </div>
              <div className="f-display num" style={{
                fontSize: compact ? 60 : 36, lineHeight: 1,
                color: '#7a6fa6',
                marginTop: 2,
              }}>
                {describeFace(f)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 92,
      transform: 'translateX(-50%)',
      display: 'flex', gap: 8, padding: '6px 14px',
      background: 'rgba(15,9,37,0.78)',
      border: '1px solid rgba(149,119,255,0.35)',
      borderRadius: 999,
      pointerEvents: 'none',
      zIndex: 4,
    }}>
      {faces.map((f, i) => {
        const isLocked = locked[i];
        const isWild = f === WILD_SENTINEL;
        return (
          <div key={i} className="f-mono num"
            style={{
              minWidth: compact ? 28 : 24, textAlign: 'center',
              fontSize: compact ? 18 : 14,
              color: isWild ? '#f5c451' : isLocked ? '#7be3ff' : '#dcd4ff',
              textShadow: isWild ? '0 0 6px #f5c451' : 'none',
              opacity: isLocked ? 1 : 0.65,
            }}>
            {describeFace(f)}
          </div>
        );
      })}
    </div>
  );
}
