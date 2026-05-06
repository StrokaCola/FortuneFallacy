import { useEffect, useRef } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { selectPendingPack, selectUnlocks } from '../../state/selectors';
import { lookupConsumable } from '../../core/consumables';
import { GALAXY_BONUS, lookupPack } from '../../core/consumables/galaxies';
import { sfxPlay } from '../../audio/sfx';
import { Z } from '../hud/zLayers';
import { useFocusTrap } from '../hud/useFocusTrap';

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
  // unlocks is read for forward-compat (not used directly here — the
  // discovery `???` rendering keys off pack.unlockedAtOpen, the snapshot
  // taken when the pack was cracked).
  const unlocks = useStore(selectUnlocks);
  void unlocks;
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = !!pack;

  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'SKIP_PACK' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!pack) return null;

  const def = lookupPack(pack.kind);
  const title = def?.name ?? 'Galaxy Pack';
  const isManeuver = pack.kind === 'maneuver';
  const itemNoun = isManeuver ? 'maneuver' : 'galaxy';
  const itemNounPlural = isManeuver ? 'maneuvers' : 'galaxies';

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} pack — pick ${pack.picksLeft} ${pack.picksLeft === 1 ? itemNoun : itemNounPlural}`}
      style={{
        position: 'fixed', inset: 0, zIndex: Z.overlay,
        background: 'rgba(8, 5, 20, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px',
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
        Pick {pack.picksLeft} {pack.picksLeft === 1 ? itemNoun : itemNounPlural} to add to the run.
      </div>

      <div style={{
        display: 'flex', gap: 18, marginTop: 32, padding: '0 24px',
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {pack.galaxyIds.map((galaxyId, i) => {
          const taken = pack.pickedSoFar.includes(galaxyId);
          const def = lookupConsumable(galaxyId);
          // Discovery beat: a galaxy was "known" if it appeared in
          // meta.unlocks AT THE MOMENT this pack was cracked. openPack
          // immediately adds the rolled ids to the global unlocks list
          // (so the codex updates) — but pack.unlockedAtOpen preserves
          // the pre-crack state so the overlay can hide first-encounter
          // names behind `???` until the player clicks/picks.
          const knownAtOpen = pack.unlockedAtOpen.includes(galaxyId);
          const discovered = knownAtOpen || taken;
          const name = discovered && def ? def.name : '???';
          const icon = discovered && def ? def.icon : '?';
          const desc = discovered && def ? def.description : 'An unknown galaxy.';
          const bonus = GALAXY_BONUS[def?.comboId ?? ''];
          const comboLabel = !discovered
            ? '???'
            : def?.comboId === 'all'
              ? 'All combos'
              : def?.comboId
                ? comboName(def.comboId)
                : def?.type === 'maneuver'
                  ? 'tactical'
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
              className="panel-strong tap"
              aria-label={`${name} — ${comboLabel}`}
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
              }}>{taken ? 'taken' : itemNoun}</div>
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
                width: '100%',
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }} title={desc}>
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
        className="btn btn-ghost mat-interactive tap"
        onClick={() => dispatch({ type: 'SKIP_PACK' })}
        style={{ marginTop: 32 }}
      >
        Skip Remaining ({pack.picksLeft})
      </button>
    </div>
  );
}
