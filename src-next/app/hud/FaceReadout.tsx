import { useStore, type GameState } from '../../state/store';
import { lookupConstellation, type Constellation } from '../../data/constellations';
import { maxNumericFace } from '../../data/dice';

const selectFaces = (s: GameState) => s.round.dice.map((d) => d.face);
const selectLocked = (s: GameState) => s.round.dice.map((d) => d.locked);
const selectConstellationId = (s: GameState) => s.run.constellationId;
const selectFirstRollDone = (s: GameState) => s.round.firstRollDone;

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
  const faces = useStore(selectFaces);
  const locked = useStore(selectLocked);
  const firstRollDone = useStore(selectFirstRollDone);

  const constellation = lookupConstellation(constellationId);
  if (!needsReadout(constellation)) return null;
  if (!firstRollDone) return null;

  // Single-die constellations (Argo's d100) get a hero readout: the rolled
  // number IS the score, so the visual treatment matches its weight. Multi-die
  // specs keep the original pill so the row stays readable.
  if (faces.length === 1) {
    const face = faces[0]!;
    const maxFace = maxNumericFace(constellation.dice[0]!.faces);
    const tone = toneForFace(face, maxFace);
    return (
      <div style={{
        position: 'absolute', left: '50%', top: '38%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center', pointerEvents: 'none', zIndex: 4,
      }}>
        <div className="f-mono uc" style={{
          fontSize: 10, letterSpacing: '0.4em',
          color: tone.glow, opacity: 0.7,
        }}>
          {tone.label || '◇ vessel ◇'}
        </div>
        <div className="f-display num" style={{
          fontSize: 128, lineHeight: 1, color: tone.fg,
          textShadow: `0 0 28px ${tone.glow}, 0 0 60px ${tone.glow}66`,
          marginTop: 4,
        }}>
          {describeFace(face)}
        </div>
        <div className="f-mono" style={{
          fontSize: 11, letterSpacing: '0.2em',
          color: '#bba8ff', opacity: 0.6, marginTop: 4,
        }}>
          / {maxFace}
        </div>
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
              minWidth: 24, textAlign: 'center',
              fontSize: 14,
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
