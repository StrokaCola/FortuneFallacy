import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { selectPendingPack, selectUnlocks } from '../../state/selectors';
import { lookupConsumable } from '../../core/consumables';
import { GALAXY_BONUS, lookupPack } from '../../core/consumables/galaxies';
import { sfxPlay } from '../../audio/sfx';

const accent = '#cc88ff';

// Helper: pretty combo names for the level-bonus tooltip line. Mirrors the
// table in galaxies.ts; kept inline so the overlay has zero cross-imports
// beyond the data layer.
function comboName(comboId: string): string {
  switch (comboId) {
    case 'chance': return 'Chance';
    case 'one_pair': return 'One Pair';
    case 'two_pair': return 'Two Pair';
    case 'three_kind': return 'Three of a Kind';
    case 'sm_straight': return 'Small Straight';
    case 'full_house': return 'Full House';
    case 'lg_straight': return 'Large Straight';
    case 'four_kind': return 'Four of a Kind';
    case 'five_kind': return 'Five of a Kind';
    default: return comboId;
  }
}

export function PackOverlay() {
  const pack = useStore(selectPendingPack);
  const unlocks = useStore(selectUnlocks);
  if (!pack) return null;

  const def = lookupPack(pack.kind);
  const title = def?.name ?? 'Galaxy Pack';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(8, 5, 20, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div className="f-mono uc" style={{ fontSize: 11, color: accent, letterSpacing: '0.4em' }}>
        ◇ booster ◇
      </div>
      <div className="f-display" style={{ fontSize: 36, color: '#f3f0ff', marginTop: 8 }}>
        {title}
      </div>
      <div style={{
        fontFamily: '"Exo 2", sans-serif',
        fontSize: 13, color: '#bba8ff', marginTop: 4,
      }}>
        Pick {pack.picksLeft} {pack.picksLeft === 1 ? 'galaxy' : 'galaxies'} to add to the run.
      </div>

      <div style={{
        display: 'flex', gap: 18, marginTop: 32, padding: '0 24px',
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {pack.galaxyIds.map((galaxyId, i) => {
          const taken = pack.pickedSoFar.includes(galaxyId);
          const def = lookupConsumable(galaxyId);
          const discovered = unlocks.includes(galaxyId);
          // Discovery-gate: undiscovered galaxies render as a question card.
          // Once flipped (i.e. the pack opened), they're already in unlocks
          // because openPack adds them, so on first encounter the player
          // gets the "what is this?" beat for one frame before the reveal.
          // To preserve that beat we only reveal galaxies that were ALREADY
          // unlocked before this pack opened — but tracking that adds state.
          // Simpler: always reveal here; rely on the codex meta-progression
          // panel for the discovery hook. Mark this as a Phase 3 polish.
          const name = discovered && def ? def.name : '???';
          const icon = discovered && def ? def.icon : '?';
          const desc = discovered && def ? def.description : 'An unknown galaxy.';
          const bonus = GALAXY_BONUS[def?.comboId ?? ''];
          const comboLabel = def?.comboId === 'all'
            ? 'All combos'
            : def?.comboId
              ? comboName(def.comboId)
              : '???';
          return (
            <button
              key={`${galaxyId}-${i}`}
              disabled={taken}
              onClick={() => {
                if (taken) return;
                sfxPlay('cardFlip');
                dispatch({ type: 'PICK_FROM_PACK', galaxyIdx: i });
              }}
              className="panel-strong"
              style={{
                width: 200, height: 280, padding: 16,
                border: `1px solid ${accent}66`,
                background: taken ? 'rgba(15,9,37,0.4)' : 'rgba(15,9,37,0.85)',
                cursor: taken ? 'default' : 'pointer',
                opacity: taken ? 0.35 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                animation: !taken ? `float-y ${3 + i * 0.4}s ease-in-out infinite` : undefined,
              }}
            >
              <div className="f-mono uc" style={{
                fontSize: 9, letterSpacing: '0.28em', color: accent, marginBottom: 6,
                padding: '2px 6px', border: `1px solid ${accent}55`, borderRadius: 4,
              }}>{taken ? 'taken' : 'galaxy'}</div>
              <div style={{
                width: 96, height: 96, borderRadius: 12, marginTop: 10,
                background: `radial-gradient(circle, ${accent}30, rgba(15,9,37,0.9))`,
                border: `1px solid ${accent}80`,
                display: 'grid', placeItems: 'center',
                fontSize: 48, color: accent,
                filter: `drop-shadow(0 0 12px ${accent}80)`,
              }}>{icon}</div>
              <div className="f-head" style={{ fontSize: 16, color: '#f3f0ff', marginTop: 14 }}>{name}</div>
              <div className="f-mono uc" style={{ fontSize: 9, color: accent, marginTop: 4, letterSpacing: '0.24em' }}>
                {comboLabel}
              </div>
              <div style={{
                fontFamily: '"Exo 2", sans-serif',
                fontSize: 11, color: '#bba8ff', marginTop: 8, textAlign: 'center', lineHeight: 1.4,
              }}>
                {desc}
              </div>
              {discovered && bonus && def?.comboId !== 'all' && (
                <div className="f-mono num" style={{ fontSize: 11, color: '#f5c451', marginTop: 'auto' }}>
                  +{bonus.chips} chips · +{bonus.mult} mult
                </div>
              )}
              {discovered && def?.comboId === 'all' && (
                <div className="f-mono num" style={{ fontSize: 11, color: '#f5c451', marginTop: 'auto' }}>
                  +1 lvl × all
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        className="btn mat-interactive"
        onClick={() => dispatch({ type: 'SKIP_PACK' })}
        style={{ marginTop: 32 }}
      >
        Skip Remaining ({pack.picksLeft})
      </button>
    </div>
  );
}
