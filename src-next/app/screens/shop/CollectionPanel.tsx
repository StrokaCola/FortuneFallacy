// Player's owned-upgrades panel rendered alongside the shop offers.
// Two surfaces share the same body:
//   - CollectionPanel — desktop absolute-positioned panel at the
//     bottom of the screen.
//   - CollectionSheet — tight-portrait bottom sheet, opened from a
//     button in the action bar.
// Both render `CollectionBody`, which is the header + four typed
// `CollectionRow`s (catalysts, vouchers, consumables, mods).

import { useEffect } from 'react';
import { lookupCatalyst } from '../../../data/catalysts';
import { lookupConsumable, consumableRarity } from '../../../core/consumables';
import { lookupVoucher } from '../../../data/vouchers';
import { lookupMod } from '../../../core/mods';
import type { CatalystEdition } from '../../../state/slices/run';
import { KindFrame, type UpgradeKind } from '../../visual/upgradeKindFrames';
import { CatalystIcon } from '../../visual/CatalystIcon';
import { RARITY_COLORS, type Rarity } from '../../visual/rarityStyles';
import { SellButton } from '../../hud/SellButton';
import { EditionBadge } from './EditionBadge';
import { MythicFrame } from '../../visual/MythicFrame';

type CollectionRowProps = {
  kindLabel: string;
  items: { id: string; index: number; name: string; desc: string; icon: string; color: string; rarity?: Rarity; edition?: CatalystEdition; disabled?: boolean; disabledReason?: string }[];
  emptyHint: string;
  kind: 'catalyst' | 'voucher' | 'consumable' | 'mod';
};

function CollectionRow({ kindLabel, items, emptyHint, kind }: CollectionRowProps) {
  return (
    <div style={{ minWidth: 220, maxWidth: 280 }}>
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.28em', color: '#bba8ff', marginBottom: 6,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>◈ {kindLabel}</span>
        <span style={{ color: '#f5c451' }}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="f-mono" style={{ fontSize: 10, color: 'rgba(187,168,255,0.5)', fontStyle: 'italic' }}>
          {emptyHint}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it) => {
            const isLegendary = it.rarity === 'legendary';
            const isMythic = it.rarity === 'mythic';
            const rarityRing = it.rarity ? RARITY_COLORS[it.rarity] : it.color;
            return (
              <div
                key={`${it.id}-${it.index}`}
                className={`has-tip${isMythic ? ' is-mythic' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 6,
                  background: 'rgba(15,9,37,0.5)',
                  border: isMythic
                    // Mythic owns its border via MythicFrame's inset shadow stack.
                    ? '1px solid transparent'
                    : `1px solid ${isLegendary ? rarityRing + 'aa' : it.color + '40'}`,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isLegendary ? `0 0 12px ${rarityRing}55, inset 0 0 6px ${rarityRing}22` : undefined,
                }}
              >
                {isLegendary && <div className="ff-holo" style={{ borderRadius: 6, opacity: 0.55 }} />}
                {isMythic && <MythicFrame name={it.name} compact />}
                <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex' }}>
                  <KindFrame
                    kind={kind as UpgradeKind}
                    rarity={it.rarity ?? null}
                    accentColor={it.rarity ? undefined : it.color}
                    size={28}
                  >
                    {kind === 'catalyst' ? (
                      <CatalystIcon
                        catalystId={it.id}
                        fallbackChar={it.icon}
                        color={it.color}
                        size={18}
                      />
                    ) : (
                      <span style={{ color: it.color }}>{it.icon}</span>
                    )}
                  </KindFrame>
                </span>
                <span className="f-mono" style={{
                  fontSize: 11, color: '#f3f0ff', flex: 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  position: 'relative', zIndex: 2,
                }}>
                  {it.name}
                  {it.edition && <EditionBadge edition={it.edition} />}
                </span>
                <SellButton kind={kind} id={it.id} index={it.index} disabled={it.disabled} disabledReason={it.disabledReason} />
                <span className="tip">
                  <span className="tip-title">{it.name}</span>
                  {it.desc}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Inputs shared by every Collection surface (desktop panel + tight bottom sheet).
export type CollectionInputs = {
  catalysts: string[];
  catalystEditions: Record<string, CatalystEdition>;
  vouchers: string[];
  consumables: string[];
  ownedMods: string[];
  voucherSellBlock: (id: string) => string | null;
};

function buildCollectionRows({
  catalysts, catalystEditions, vouchers, consumables, ownedMods, voucherSellBlock,
}: CollectionInputs) {
  const catRows = catalysts.map((id, index) => {
    const c = lookupCatalyst(id);
    return {
      id, index,
      name: c?.name ?? id,
      desc: c?.desc ?? '',
      icon: c?.icon ?? '✦',
      color: c?.color ?? '#7be3ff',
      rarity: c?.rarity,
      edition: catalystEditions[id],
    };
  });
  const voucherRows = vouchers.map((id, index) => {
    const v = lookupVoucher(id);
    const block = voucherSellBlock(id);
    return {
      id, index,
      name: v?.name ?? id,
      desc: v?.description ?? '',
      icon: '◆',
      color: '#f5c451',
      rarity: v?.rarity,
      disabled: !!block,
      disabledReason: block ?? undefined,
    };
  });
  const consRows = consumables.map((id, index) => {
    const c = lookupConsumable(id);
    return {
      id, index,
      name: c?.name ?? id,
      desc: c?.description ?? '',
      icon: c?.icon ?? '◇',
      color: c?.type === 'calibration' ? '#cc88ff' : '#7be3ff',
      rarity: c ? consumableRarity(c.type) : undefined,
    };
  });
  const modRows = ownedMods.map((id, index) => {
    const m = lookupMod(id);
    return {
      id, index,
      name: m?.name ?? id,
      desc: m?.desc ?? '',
      icon: m?.icon ?? '⫶',
      color: m?.visual?.accentColor ?? '#bba8ff',
      rarity: m?.rarity,
    };
  });
  const isEmpty = catalysts.length + vouchers.length + consumables.length + ownedMods.length === 0;
  return { catRows, voucherRows, consRows, modRows, isEmpty };
}

// Shared body rendered by both the desktop CollectionPanel and the tight
// CollectionSheet. Header + the four typed rows.
function CollectionBody(props: CollectionInputs) {
  const { catRows, voucherRows, consRows, modRows, isEmpty } = buildCollectionRows(props);
  return (
    <>
      <div className="f-mono uc" style={{
        fontSize: 10, letterSpacing: '0.32em', color: '#bba8ff', marginBottom: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>◇ your collection ◇</span>
        <span className="has-tip" style={{ position: 'relative', fontSize: 9, color: '#f5c451', cursor: 'help' }}>
          ?
          <span className="tip tip-above">Sell any owned upgrade for half its buy price (rounded down). Selling a slot-granting voucher is blocked when it would strand items above the post-sell cap.</span>
        </span>
      </div>
      {isEmpty ? (
        <div style={{ fontSize: 11, color: 'rgba(187,168,255,0.6)', textAlign: 'center', padding: 8, fontStyle: 'italic' }}>
          You don't own any upgrades yet. Buy from the offers above to start a collection.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'space-around' }}>
          <CollectionRow kindLabel="catalysts" kind="catalyst" items={catRows} emptyHint="no catalysts" />
          <CollectionRow kindLabel="vouchers"  kind="voucher"  items={voucherRows} emptyHint="no vouchers" />
          <CollectionRow kindLabel="consumables" kind="consumable" items={consRows} emptyHint="no consumables" />
          <CollectionRow kindLabel="mods (inventory)" kind="mod" items={modRows} emptyHint="no mods (attached mods sit in the Forge)" />
        </div>
      )}
    </>
  );
}

// Bottom sheet for tight portrait. Slides up from the viewport bottom;
// tap backdrop or close button to dismiss. Position fixed so it tracks
// the viewport, not the scroll container — fixes the "Collection floats
// in the middle of the page" bug we hit with absolute-bottom positioning.
export function CollectionSheet(props: CollectionInputs & { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your collection"
      onClick={props.onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(7,5,26,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 60, pointerEvents: 'auto',
        animation: 'fadein 200ms ease-out both',
      }}
    >
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 100%)',
          maxHeight: '70dvh',
          padding: '14px 18px 18px',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          overflowY: 'auto',
          paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
          animation: 'sheetSlide 220ms cubic-bezier(0.2,0.8,0.2,1) both',
        }}
      >
        {/* Drag handle (cosmetic — taps still close via backdrop). */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(149,119,255,0.4)',
          margin: '0 auto 10px',
        }} />
        <button
          onClick={props.onClose}
          aria-label="Close collection"
          className="f-mono"
          style={{
            position: 'absolute', top: 10, right: 12,
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(15,9,37,0.6)',
            border: '1px solid rgba(149,119,255,0.4)',
            color: '#bba8ff', fontSize: 14, cursor: 'pointer',
          }}
        >
          ×
        </button>
        <CollectionBody {...props} />
      </div>
    </div>
  );
}

export function CollectionPanel(props: CollectionInputs) {
  // Desktop-only after the 2026-05-07 portrait pass — tight stage uses
  // CollectionSheet (bottom-sheet modal) instead. Render-gated at the call
  // site in Shop().
  return (
    <div className="panel" style={{
      position: 'absolute', left: '50%',
      bottom: 'calc(var(--hud-bottom-h, 60px) + 32px)',
      transform: 'translateX(-50%)',
      width: 'min(1100px, calc(100vw - 60px))',
      // 100dvh tracks the visible viewport on mobile browsers.
      maxHeight: 'clamp(80px, calc(100dvh - 540px), 220px)',
      padding: '12px 18px', zIndex: 4, overflowY: 'auto',
    }}>
      <CollectionBody {...props} />
    </div>
  );
}
