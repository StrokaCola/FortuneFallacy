// Skip Bounty Overlay (Pillar G) — modal that mounts when the player
// skips a non-boss trial. Presents 3 rolled options; clicking one
// dispatches RESOLVE_SKIP_BOUNTY and clears the pending bounty state.
//
// Visual: card-style picker that follows the PackOverlay aesthetic —
// dim backdrop, panel-strong frame, three picks aligned horizontally
// (wraps to vertical on tight viewports).

import { useEffect, useRef } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { lookupConsumable } from '../../core/consumables';
import { CATALYST_META } from '../../data/catalysts';
import { selectMaxCatalystSlots, selectEffectiveCatalystSlotsUsed } from '../../state/selectors';
import { Z } from '../hud/zLayers';
import { useFocusTrap } from '../hud/useFocusTrap';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import { useModalExit } from '../hooks/useModalExit';

const selectPendingSkipBounty = (s: GameState) => s.shop.pendingSkipBounty;

const accent = '#7be3ff';

export function SkipBountyOverlay() {
  const bounty = useStore(selectPendingSkipBounty);
  const maxCatalysts = useStore(selectMaxCatalystSlots);
  const usedCatalysts = useStore(selectEffectiveCatalystSlotsUsed);
  const catalystsFull = usedCatalysts >= maxCatalysts;
  const tight = useIsTightStage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = !!bounty;

  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (!isOpen || !bounty) return;
    const onKey = (e: KeyboardEvent) => {
      // Default-pick the first option on Escape so the player isn't
      // stranded by an accidental keystroke — Esc on PackOverlay
      // skips the pick entirely, but the bounty is a forced choice
      // (player already committed by clicking Skip). Defaulting to
      // option 0 (shards) is the safest fallback.
      if (e.key === 'Escape') dispatch({ type: 'RESOLVE_SKIP_BOUNTY', optionIdx: 0 });
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const idx = Number(e.key) - 1;
        const opt = bounty.options[idx];
        if (opt && !(opt.kind === 'catalyst' && catalystsFull)) {
          dispatch({ type: 'RESOLVE_SKIP_BOUNTY', optionIdx: idx });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, bounty, catalystsFull]);

  // Stay mounted long enough to fade out cleanly when the player
  // resolves the bounty.
  const { rendered, exiting } = useModalExit(isOpen, 140);
  if (!rendered || !bounty) return null;

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label="Choose your skip bounty"
      ref={dialogRef}
      className={exiting ? 'modal-exit-anim' : undefined}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(7,5,26,0.78)',
        pointerEvents: exiting ? 'none' : 'auto',
        // Forced-choice modal — stack above banners (Z.bannerArrival = 40)
        // so a celebration toast can't pop on top of it. Matches
        // PackOverlay's Z.overlay (100).
        zIndex: Z.overlay,
        display: 'grid', placeItems: 'center',
        animation: exiting
          ? 'modalFadeOut var(--modal-out, 140ms) ease-in forwards'
          : 'fadein var(--modal-in, 220ms) var(--ease-modal, ease-out)',
        padding: tight ? 16 : 32,
      }}
    >
      <div className="panel-strong" style={{
        width: 'min(640px, calc(100vw - 32px))',
        padding: tight ? 16 : 24,
        borderRadius: 14,
        border: `1px solid ${accent}66`,
        boxShadow: `0 0 48px ${accent}33, 0 24px 60px rgba(0,0,0,0.55)`,
        background: 'linear-gradient(180deg, rgba(123,227,255,0.06), rgba(15,9,37,0.95))',
      }}>
        <div style={{ textAlign: 'center', marginBottom: tight ? 12 : 18 }}>
          <div className="f-mono uc" style={{
            fontSize: 10, letterSpacing: '0.5em', color: accent,
          }}>
            ◇ skip bounty ◇
          </div>
          <div className="f-display" style={{
            fontSize: tight ? 18 : 22, color: '#f3f0ff', marginTop: 4,
          }}>
            Take your toll.
          </div>
          <div className="f-mono" style={{
            fontSize: 11, color: '#bba8ff', marginTop: 4, opacity: 0.85,
          }}>
            You chose to walk past this trial. The path leaves you something in return.
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: tight ? '1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {bounty.options.map((opt, idx) => {
            const disabled = opt.kind === 'catalyst' && catalystsFull;
            return (
              <BountyCard
                key={idx}
                optionIdx={idx}
                option={opt}
                disabled={disabled}
                onPick={() => {
                  if (disabled) return;
                  dispatch({ type: 'RESOLVE_SKIP_BOUNTY', optionIdx: idx });
                }}
                tight={tight}
              />
            );
          })}
        </div>
        <div className="f-mono" style={{
          textAlign: 'center', fontSize: 9, color: '#7a6fa6', marginTop: 12,
          letterSpacing: '0.18em',
        }}>
          press 1 · 2 · 3 to pick
        </div>
      </div>
    </div>
  );
}

type Opt = NonNullable<GameState['shop']['pendingSkipBounty']>['options'][number];

function BountyCard({
  optionIdx, option, onPick, tight, disabled,
}: {
  optionIdx: number;
  option: Opt;
  onPick: () => void;
  tight: boolean;
  disabled: boolean;
}) {
  const { title, body, glyph, color } = describeOption(option);
  return (
    <button
      className="btn-ghost mat-interactive"
      onClick={onPick}
      disabled={disabled}
      aria-disabled={disabled}
      style={{
        padding: tight ? 14 : 18,
        borderRadius: 10,
        background: 'rgba(15,9,37,0.7)',
        border: `1px solid ${color}66`,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        boxShadow: `0 0 14px ${color}22, 0 6px 14px rgba(0,0,0,0.35)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        minHeight: tight ? 100 : 140,
      }}
    >
      <div style={{
        fontSize: tight ? 26 : 34,
        color,
        textShadow: `0 0 14px ${color}aa`,
      }}>
        {glyph}
      </div>
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.3em', color,
      }}>
        option {optionIdx + 1}
      </div>
      <div className="f-display" style={{
        fontSize: tight ? 13 : 15, color: '#f3f0ff',
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: '"Exo 2", sans-serif',
        fontSize: 11, color: '#dcd4ff', opacity: 0.85,
        lineHeight: 1.35,
      }}>
        {body}
      </div>
      {disabled && (
        <div className="f-mono uc" style={{
          fontSize: 9, letterSpacing: '0.2em',
          color: '#e2334a', marginTop: 4,
        }}>
          slots full
        </div>
      )}
    </button>
  );
}

function describeOption(opt: Opt): { title: string; body: string; glyph: string; color: string } {
  switch (opt.kind) {
    case 'shards':
      return {
        title: 'Shards',
        body: `${opt.label}. Straight to the wallet.`,
        glyph: '◆',
        color: '#f5c451',
      };
    case 'consumable': {
      const def = lookupConsumable(opt.consumableId);
      return {
        title: def?.name ?? 'Consumable',
        body: def?.description ?? opt.label,
        glyph: def?.icon ?? '◇',
        color: '#7be3ff',
      };
    }
    case 'catalyst': {
      const meta = CATALYST_META.find((c) => c.id === opt.catalystId);
      return {
        title: meta?.name ?? 'Catalyst',
        body: meta?.desc ?? opt.label,
        glyph: meta?.icon ?? '✦',
        color: meta?.color ?? '#cc88ff',
      };
    }
    case 'pack':
      return {
        title: 'Celestial Pack',
        body: 'A handful of galaxies, opened when you next visit the bazaar.',
        glyph: '✺',
        color: '#cc88ff',
      };
  }
}
