// Shop screen — the Night Market between blinds. Renders the
// player's three offers, the player's owned collection, hand-level
// status, and the action bar (Reroll / Collection / Next Trial).
//
// This file is intentionally a thin orchestrator. The heavy lifting
// lives in `shop/`:
//
//   offerMeta.ts          — (kind, id) → name/icon/color/desc/rarity
//   EditionBadge.tsx      — foil/holo/poly/void stamp pill
//   OfferCard.tsx         — per-offer card render (rarity ring,
//                           legendary holo, resonance hint, price CTA)
//   HandLevelsPanel.tsx   — desktop-only side panel showing leveled hands
//   CollectionPanel.tsx   — CollectionPanel (desktop inline) and
//                           CollectionSheet (tight bottom-sheet)

import { useEffect, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { TopBar } from '../hud/TopBar';
import { PauseButton } from '../hud/PauseButton';
import { ActionBar } from '../hud/ActionBar';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import {
  selectShards, selectShopOffers, selectShopRerollCost, selectAnte, selectCatalysts, selectMaxCatalystSlots, selectMaxSlots, selectVouchers,
  selectTarget, selectHandsLeft, selectRerollsLeft, selectOwnedMods,
  selectComboLevels, selectEffectiveCatalystSlotsUsed,
} from '../../state/selectors';
import { sfxPlay } from '../../audio/sfx';
import type { CatalystEdition } from '../../state/slices/run';
import { OfferCard } from './shop/OfferCard';
import { HandLevelsPanel } from './shop/HandLevelsPanel';
import { CollectionSheet } from './shop/CollectionPanel';

// Stable empty-object fallback so the selector returns a consistent ref
// across renders (avoids useSyncExternalStore tear-loops).
const EMPTY_CATALYST_EDITIONS: Record<string, never> = {};
const selectCatalystEditions = (s: GameState): Record<string, CatalystEdition> =>
  s.run.catalystEditions ?? EMPTY_CATALYST_EDITIONS;
const selectDiceMods = (s: GameState) => s.run.diceMods;
const selectConsumables = (s: GameState) => s.run.consumables;

const ACCENT = '#7be3ff';

export function Shop() {
  const tight = useIsTightStage();
  const [collectionOpen, setCollectionOpen] = useState(false);
  // Wave Z — reroll spin counter. Increments on each successful reroll;
  // the glyph's key changes so the spin keyframe replays cleanly even
  // when React re-renders mid-animation (state-driven, not DOM-mutated).
  const [rerollSpin, setRerollSpin] = useState(0);
  const shards   = useStore(selectShards);
  const offers   = useStore(selectShopOffers);
  const rerollCost = useStore(selectShopRerollCost);
  const ante     = useStore(selectAnte);
  const catalysts = useStore(selectCatalysts);
  const catalystEditions = useStore(selectCatalystEditions);
  const maxCatalysts = useStore(selectMaxCatalystSlots);
  const usedCatalystSlots = useStore(selectEffectiveCatalystSlotsUsed);
  const vouchers = useStore(selectVouchers);
  const consumables = useStore(selectConsumables);
  const ownedMods = useStore(selectOwnedMods);
  const diceMods = useStore(selectDiceMods);
  const target   = useStore(selectTarget);
  const hands    = useStore(selectHandsLeft);
  const rerolls  = useStore(selectRerollsLeft);
  const comboLevels = useStore(selectComboLevels);

  // Voucher invariants used to disable selling cap-granting vouchers when
  // doing so would strand items above the post-sell cap. The fake-state
  // values are "if you didn't have this voucher, your cap would be N-1";
  // computed from a single memoised tuple so each Shop interaction
  // doesn't trigger 3× full-tree re-evaluation across separate stores.
  const [maxCatalystCap, maxConsumableCap, maxModCap] = useStore(selectMaxSlots);
  const fakeStateNoBench = maxCatalystCap - 1;
  const fakeStateNoCapacity = maxConsumableCap - 1;
  const fakeStateNoForgedLinks = maxModCap - 1;

  useEffect(() => {
    if (offers.length === 0) dispatch({ type: 'OPEN_SHOP' });
  }, [offers.length]);

  const voucherSellBlock = (id: string): string | null => {
    if (id === 'bench' && usedCatalystSlots > fakeStateNoBench) return 'Sell a catalyst first — your collection would exceed the slot cap.';
    if (id === 'capacity' && consumables.length > fakeStateNoCapacity) return 'Use a consumable first — your tray would exceed the slot cap.';
    if (id === 'forged_links' && diceMods.some((slots) => slots.length > fakeStateNoForgedLinks)) return 'Detach a mod in the Forge first — at least one die exceeds the post-sell mod cap.';
    return null;
  };

  // Key includes the full offer set so a reroll forces React to remount
  // each card (re-firing the spawn animation). Computed once per render
  // and passed into every OfferCard.
  const offerVersion = offers.map((x) => x.id).join('|');

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'auto',
      // 2026-05-18 desktop-no-scroll: offers are absolutely positioned
      // on desktop so root never needs to scroll. Tight (phone) keeps
      // overflow:auto so the inline-flow layout can still scroll.
      overflowY: tight ? 'auto' : 'hidden', overflowX: 'hidden',
      // On tight portrait the hero/offers/action bar all flow inline below
      // the TopBar instead of being absolute. Top padding clears the TopBar;
      // bottom padding clears the safe-area inset.
      ...(tight ? {
        paddingTop: 'calc(var(--hud-top-h, 134px) + 12px)',
        // Extra bottom padding clears the pinned action bar (~64px tall
        // with its 8px outer margin) so the last offer card scrolls
        // above it instead of being permanently obscured.
        paddingBottom: 'calc(var(--hud-bottom-h, 0px) + 88px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      } : null),
    }}>
      <TopBar
        ante={ante}
        blind="Night Market"
        shards={shards}
        hands={hands}
        rerolls={rerolls}
        target={target}
        catalystSlots={{ used: usedCatalystSlots, max: maxCatalysts }}
        voucherCount={vouchers.length}
        vouchers={vouchers}
        catalysts={catalysts}
        accent={ACCENT}
      />
      <PauseButton />

      <div style={tight ? {
        // In-flow on tight portrait: the parent flex column places it.
        textAlign: 'center', zIndex: 4,
        width: 'calc(100% - 32px)',
      } : {
        position: 'absolute', left: '50%',
        top: 'calc(var(--hud-top-h, 134px) + 46px)',
        transform: 'translateX(-50%)',
        textAlign: 'center', zIndex: 4,
      }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ exchange ◇
        </div>
        <div className="f-display" style={{
          // clamp shrinks to 22px on a ~370px-wide phone (6vw), grows back to 36px on desktop.
          fontSize: 'clamp(20px, 6vw, 36px)',
          color: '#f3f0ff', marginTop: tight ? 4 : 8,
          whiteSpace: 'nowrap',
        }}>
          The Night Market
        </div>
      </div>

      <div data-coach="shop-offers" style={tight ? {
        // In-flow on tight: parent flex column positions us.
        display: 'flex', flexDirection: 'column', gap: 12, zIndex: 4,
        width: 'min(360px, calc(100vw - 24px))', alignItems: 'stretch',
      } : {
        position: 'absolute', left: '50%',
        top: 'calc(var(--hud-top-h, 134px) + 156px)',
        transform: 'translateX(-50%)',
        display: 'flex', gap: 18, zIndex: 4,
      }}>
        {offers.length === 0 && (
          <div className="f-mono panel" style={{ color: '#bba8ff', padding: '24px 36px' }}>— sold out —</div>
        )}
        {offers.map((o, i) => (
          <OfferCard
            key={`${offerVersion}-${i}`}
            offer={o}
            index={i}
            shards={shards}
            catalysts={catalysts}
            catalystsFull={usedCatalystSlots >= maxCatalysts}
            offerVersion={offerVersion}
            tight={tight}
          />
        ))}
      </div>

      <HandLevelsPanel comboLevels={comboLevels} />

      {/* Wave T+1 (2026-05-19) UI pass — Collection no longer renders
          inline anywhere; always reached via the Collection button in
          the action bar (CollectionSheet). Inline panel was overtaking
          the shop screen at desktop sizes and burying offer cards. */}

      <ActionBar tight={tight} gap={tight ? 8 : 12} minChildWidth={100} style={tight ? {
        // Tight: pin the action bar to the bottom of the viewport so
        // Reroll / Collection / Next are always one tap away, instead
        // of forcing the player to scroll past 3 tall offer cards to
        // find them. Background fades into the cosmos so the row reads
        // as anchored chrome, not an offer card.
        position: 'fixed', left: 12, right: 12, bottom: 12,
        zIndex: 8, alignItems: 'stretch',
        padding: '8px 10px',
        background: 'linear-gradient(180deg, rgba(7,5,26,0.6), rgba(7,5,26,0.92))',
        borderRadius: 12,
        backdropFilter: 'blur(6px)',
      } : {
        position: 'absolute', left: '50%', bottom: 28,
        transform: 'translateX(-50%)',
        zIndex: 5,
      }}>
        <button
          data-coach="shop-reroll"
          className="btn mat-interactive has-tip ff-reroll-btn"
          // Wave Z — increment a spin counter on each successful reroll so
          // the ↻ glyph re-mounts (via the key on its span) and the spin
          // keyframe replays from 0 deg even on rapid clicks.
          onClick={() => {
            if (shards >= rerollCost) {
              dispatch({ type: 'REROLL_SHOP' });
              sfxPlay('cardFlip');
              setRerollSpin((n) => n + 1);
            }
          }}
          disabled={shards < rerollCost}
          style={{
            opacity: shards >= rerollCost ? 1 : 0.5,
            cursor: shards >= rerollCost ? 'pointer' : 'not-allowed',
          }}
        >
          <span key={`spin-${rerollSpin}`} className={`ff-reroll-glyph${rerollSpin > 0 ? ' ff-reroll-glyph-spinning' : ''}`} aria-hidden="true">↻</span> Reroll <span className="f-mono num" style={{ color: '#f5c451' }}>◆ {rerollCost}</span>
          <span className="tip tip-above">Replace all current offers with a new set. Cost rises by 1 each reroll this visit.</span>
        </button>
        {/* Wave T+1 (2026-05-19) — Collection button now lives in the
            action bar on EVERY viewport (was tight-only). Opens the
            CollectionSheet bottom-sheet on click. Replaces the
            previous always-visible inline panel on desktop which
            buried the shop offers under a tall list of owned items. */}
        <button
          className="btn mat-interactive has-tip"
          onClick={() => setCollectionOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={collectionOpen}
        >
          ☰ Collection{' '}
          <span className="f-mono num" style={{ color: '#bba8ff' }}>
            {catalysts.length + vouchers.length + consumables.length + ownedMods.length}
          </span>
          <span className="tip tip-above">View and sell owned catalysts, mods, vouchers, and consumables.</span>
        </button>
        <button
          data-coach="next-trial-btn"
          className="btn btn-primary mat-interactive has-tip"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}
        >
          Next Trial →
          <span className="tip tip-above">Leave the Night Market and return to the Tribunal of Stars.</span>
        </button>
      </ActionBar>

      {collectionOpen && (
        <CollectionSheet
          catalysts={catalysts}
          catalystEditions={catalystEditions}
          vouchers={vouchers}
          consumables={consumables}
          ownedMods={ownedMods}
          voucherSellBlock={voucherSellBlock}
          onClose={() => setCollectionOpen(false)}
        />
      )}
    </div>
  );
}
