import { useStore, type GameState } from '../../state/store';
import { lookupConstellation } from '../../data/constellations';

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
function needsReadout(constellationId: string): boolean {
  const c = lookupConstellation(constellationId);
  for (const die of c.dice) {
    for (const f of die.faces) {
      if (typeof f !== 'number') return true;
      if (f < 1 || f > 6) return true;
    }
  }
  return false;
}

export function FaceReadout() {
  const constellationId = useStore(selectConstellationId);
  const faces = useStore(selectFaces);
  const locked = useStore(selectLocked);
  const firstRollDone = useStore(selectFirstRollDone);

  if (!needsReadout(constellationId)) return null;
  if (!firstRollDone) return null;

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
