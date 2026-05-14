// Compact, fixed-position panel showing the player's leveled hand
// types. Only renders rows where the level is > 0 — keeps the panel
// out of the way at the start of a run, then grows as galaxies are
// picked. Hidden on tight portrait (collides with the stacked offer
// column; players can still see hand levels on the Round screen).

import { useIsTightStage } from '../../hooks/useIsCompactStage';
import { GALAXY_BONUS } from '../../../core/consumables/galaxies';

const HAND_LEVEL_ROWS: { id: string; label: string }[] = [
  { id: 'five_kind',   label: '5 Kind'    },
  { id: 'four_kind',   label: '4 Kind'    },
  { id: 'lg_straight', label: 'Lg Str'    },
  { id: 'full_house',  label: 'Full Hse'  },
  { id: 'sm_straight', label: 'Sm Str'    },
  { id: 'three_kind',  label: '3 Kind'    },
  { id: 'two_pair',    label: '2 Pair'    },
  { id: 'one_pair',    label: 'Pair'      },
  { id: 'chance',      label: 'Chance'    },
];

export function HandLevelsPanel({ comboLevels }: { comboLevels: Record<string, number> }) {
  const tight = useIsTightStage();
  const rows = HAND_LEVEL_ROWS
    .map((r) => ({ ...r, lvl: comboLevels[r.id] ?? 0, bonus: GALAXY_BONUS[r.id] }))
    .filter((r) => r.lvl > 0);
  if (rows.length === 0) return null;
  // On tight portrait the right-aligned absolute panel collides with the
  // stacked offers — hide it; players can still see hand levels on Round.
  if (tight) return null;
  return (
    <div className="panel" style={{
      position: 'absolute', right: 24,
      top: 'calc(var(--hud-top-h, 134px) + 46px)',
      width: 200,
      padding: '10px 14px', zIndex: 4,
    }}>
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.3em', color: '#bba8ff', marginBottom: 8,
      }}>
        ◇ hand levels ◇
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r) => (
          <div
            key={r.id}
            className="f-mono"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 10, color: '#f3f0ff',
              padding: '3px 6px', borderRadius: 4,
              background: 'rgba(15,9,37,0.5)',
            }}
          >
            <span>{r.label}</span>
            <span style={{ color: '#cc88ff' }}>
              lvl {r.lvl}
              {r.bonus && (
                <span style={{ color: 'rgba(204,136,255,0.7)', marginLeft: 4 }}>
                  +{r.lvl * r.bonus.chips}/+{r.lvl * r.bonus.mult}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
