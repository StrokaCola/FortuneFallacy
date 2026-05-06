import { useEffect } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { TopBar } from '../hud/TopBar';
import { PauseButton } from '../hud/PauseButton';
import { SellButton } from '../hud/SellButton';
import {
  selectShards, selectShopOffers, selectShopRerollCost, selectAnte, selectCatalysts, selectMaxCatalystSlots, selectVouchers,
  selectScore, selectTarget, selectHandsLeft, selectRerollsLeft, selectOwnedMods,
  selectComboLevels,
} from '../../state/selectors';
import { lookupCatalyst } from '../../data/catalysts';
import { lookupConsumable } from '../../core/consumables';
import { lookupVoucher } from '../../data/vouchers';
import { lookupMod } from '../../core/mods';
import { maxCatalystSlots, maxConsumableSlots, maxModSlots } from '../../core/vouchers';
import { sellRefund } from '../../core/shop/sellRefund';
import { sfxPlay } from '../../audio/sfx';
// PackOverlay is mounted at the App level so it shows whether the player
// is in the shop or not (skip-blind pack rewards open the picker mid-screen).
import { GALAXY_BONUS, lookupPack } from '../../core/consumables/galaxies';
import { editionLabel, editionColor } from '../../core/upgrades/editions';
import type { CatalystEdition } from '../../state/slices/run';

const selectCatalystEditions = (s: GameState) => s.run.catalystEditions ?? {};

// Tiny inline pill that renders next to a catalyst's name when it's been
// stamped with an edition. Color-coded; tooltip text explains the bonus.
function EditionBadge({ edition }: { edition: CatalystEdition }) {
  const c = editionColor(edition);
  const tip =
    edition === 'foil' ? 'Foil — +50 chips when this catalyst fires.'
    : edition === 'holo' ? 'Holographic — +10 mult when this catalyst fires.'
    : 'Polychrome — adds +50% of this catalyst\'s contribution each fire.';
  return (
    <span
      className="f-mono uc has-tip"
      style={{
        position: 'relative',
        marginLeft: 6,
        padding: '1px 5px',
        fontSize: 8,
        letterSpacing: '0.18em',
        borderRadius: 3,
        color: c,
        border: `1px solid ${c}88`,
        background: `${c}22`,
      }}
    >
      {editionLabel(edition).slice(0, 4).toLowerCase()}
      <span className="tip">{tip}</span>
    </span>
  );
}

type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
type Meta = { name: string; icon: string; color: string; desc: string; kindLabel: string; flavor?: string; rarity?: Rarity };

function offerMeta(kind: string, id: string): Meta {
  if (kind === 'catalyst') {
    const c = lookupCatalyst(id);
    return { name: c?.name ?? id, icon: c?.icon ?? '✦', color: c?.color ?? '#7be3ff', desc: c?.desc ?? '', kindLabel: 'catalyst', flavor: c?.flavor, rarity: c?.rarity };
  }
  if (kind === 'consumable') {
    const c = lookupConsumable(id);
    return {
      name: c?.name ?? id,
      icon: c?.icon ?? '◇',
      color: c?.type === 'calibration' ? '#cc88ff' : '#7be3ff',
      desc: c?.description ?? '',
      kindLabel: c?.type ?? 'calibration',
    };
  }
  if (kind === 'voucher') {
    const v = lookupVoucher(id);
    return { name: v?.name ?? id, icon: '◆', color: '#f5c451', desc: v?.description ?? '', kindLabel: 'voucher' };
  }
  if (kind === 'mod') {
    const m = lookupMod(id);
    return {
      name: m?.name ?? id,
      icon: m?.icon ?? '⫶',
      color: m?.visual?.accentColor ?? '#bba8ff',
      desc: m?.desc ?? '',
      kindLabel: 'mod',
      rarity: m?.rarity,
    };
  }
  if (kind === 'pack') {
    const p = lookupPack(id);
    const tier = id === 'galactic' ? '✸' : id === 'stellar' ? '✹' : '✦';
    return {
      name: p?.name ?? id,
      icon: tier,
      color: '#cc88ff',
      desc: p ? `Show ${p.showCount}, pick ${p.pickCount}.` : 'Galaxy booster pack.',
      kindLabel: 'booster',
      flavor: 'Levels up the hand types you choose.',
    };
  }
  return { name: id, icon: '◇', color: '#7be3ff', desc: '', kindLabel: kind };
}

// Per-rarity ring color + label. Legendary uses ember/orange paired with the
// holographic foil sweep — see styles/index.css `.ff-holo` and `.legendary-aura`.
const RARITY_COLORS: Record<Rarity, string> = {
  common:    '#7be3ff',
  uncommon:  '#cc88ff',
  rare:      '#f5c451',
  legendary: '#ff7847',
};

const selectDiceMods = (s: GameState) => s.run.diceMods;
const selectConsumables = (s: GameState) => s.run.consumables;

const accent = '#7be3ff';

export function Shop() {
  const shards   = useStore(selectShards);
  const offers   = useStore(selectShopOffers);
  const rerollCost = useStore(selectShopRerollCost);
  const ante     = useStore(selectAnte);
  const catalysts = useStore(selectCatalysts);
  const catalystEditions = useStore(selectCatalystEditions);
  const maxCatalysts = useStore(selectMaxCatalystSlots);
  const vouchers = useStore(selectVouchers);
  const consumables = useStore(selectConsumables);
  const ownedMods = useStore(selectOwnedMods);
  const diceMods = useStore(selectDiceMods);
  const score    = useStore(selectScore);
  const target   = useStore(selectTarget);
  const hands    = useStore(selectHandsLeft);
  const rerolls  = useStore(selectRerollsLeft);
  const comboLevels = useStore(selectComboLevels);

  // Voucher invariants used to disable selling cap-granting vouchers when
  // doing so would strand items above the post-sell cap.
  const fakeStateNoBench = useStore((s) => maxCatalystSlots(s) - 1);
  const fakeStateNoCapacity = useStore((s) => maxConsumableSlots(s) - 1);
  const fakeStateNoForgedLinks = useStore((s) => maxModSlots(s) - 1);

  useEffect(() => {
    if (offers.length === 0) dispatch({ type: 'OPEN_SHOP' });
  }, [offers.length]);

  const voucherSellBlock = (id: string): string | null => {
    if (id === 'bench' && catalysts.length > fakeStateNoBench) return 'Sell a catalyst first — your collection would exceed the slot cap.';
    if (id === 'capacity' && consumables.length > fakeStateNoCapacity) return 'Use a consumable first — your tray would exceed the slot cap.';
    if (id === 'forged_links' && diceMods.some((slots) => slots.length > fakeStateNoForgedLinks)) return 'Detach a mod in the Forge first — at least one die exceeds the post-sell mod cap.';
    return null;
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
      <TopBar
        ante={ante}
        blind="Bazaar"
        shards={shards}
        hands={hands}
        rerolls={rerolls}
        target={target}
        score={score}
        catalystSlots={{ used: catalysts.length, max: maxCatalysts }}
        voucherCount={vouchers.length}
        vouchers={vouchers}
        accent={accent}
      />
      <PauseButton />

      <div style={{
        position: 'absolute', left: '50%', top: 180, transform: 'translateX(-50%)',
        textAlign: 'center', zIndex: 4,
      }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ exchange ◇
        </div>
        <div className="f-display" style={{ fontSize: 36, color: '#f3f0ff', marginTop: 8 }}>
          The Celestial Bazaar
        </div>
      </div>

      <div style={{
        position: 'absolute', left: '50%', top: 290, transform: 'translateX(-50%)',
        display: 'flex', gap: 18, zIndex: 4,
      }}>
        {offers.length === 0 && (
          <div className="f-mono panel" style={{ color: '#bba8ff', padding: '24px 36px' }}>— sold out —</div>
        )}
        {offers.map((o, i) => {
          const m = offerMeta(o.kind, o.id);
          const c = m.color;
          const affordable = shards >= o.price;
          const refundIfBought = sellRefund(o.kind, o.id);
          const isLegendary = m.rarity === 'legendary';
          const ringColor = m.rarity ? RARITY_COLORS[m.rarity] : c;
          const cardBorder = isLegendary
            ? `1.5px solid ${ringColor}cc`
            : m.rarity === 'rare'
              ? `1px solid ${ringColor}aa`
              : `1px solid ${c}55`;
          return (
            <div
              key={`${o.id}-${i}`}
              className={`panel-strong has-tip${isLegendary ? ' legendary-aura' : ''}`}
              onMouseEnter={() => sfxPlay('cardFlip')}
              onClick={() => affordable && dispatch({ type: 'BUY_OFFER', offerIdx: i })}
              style={{
                width: 180, height: 250, padding: 14,
                border: cardBorder,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: affordable ? 'pointer' : 'not-allowed',
                opacity: affordable ? 1 : 0.6,
                animation: `float-y ${3 + i * 0.4}s ease-in-out infinite`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Holographic foil sweep — legendary only. Sits above the
                  panel-strong gradient but below the content via z-index. */}
              {isLegendary && (
                <>
                  <div className="ff-holo" />
                  <div className="ff-holo-shimmer" />
                </>
              )}

              <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%' }}>
                <div className="f-mono uc rarity-tag" style={{
                  color: ringColor, marginBottom: 6,
                  border: `1px solid ${ringColor}66`,
                  background: isLegendary ? `${ringColor}14` : 'transparent',
                }}>
                  {m.kindLabel}{m.rarity ? ` · ${m.rarity}` : ''}
                </div>
                <div style={{
                  width: 84, height: 84, borderRadius: 12, marginTop: 8,
                  background: `radial-gradient(circle at 30% 25%, ${c}40, rgba(15,9,37,0.9) 75%)`,
                  border: `1px solid ${c}80`,
                  display: 'grid', placeItems: 'center',
                  fontSize: 40, color: c,
                  filter: `drop-shadow(0 0 ${isLegendary ? 14 : 10}px ${c}${isLegendary ? 'cc' : '80'})`,
                  position: 'relative',
                }}>{m.icon}</div>
                <div className="f-head" style={{
                  fontSize: 14, color: '#f3f0ff', marginTop: 12, textAlign: 'center',
                  textShadow: isLegendary ? `0 0 8px ${ringColor}80` : undefined,
                }}>
                  {m.name}
                  {o.kind === 'catalyst' && o.edition && <EditionBadge edition={o.edition} />}
                </div>
                <div style={{
                  fontFamily: '"Exo 2", sans-serif',
                  fontSize: 11, color: '#bba8ff', marginTop: 6, textAlign: 'center', lineHeight: 1.4, flex: 1,
                }}>
                  {m.desc}
                </div>
                <div style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(149,119,255,0.2)',
                }}>
                  <span className="f-mono num" style={{ color: '#f5c451', fontSize: 14 }}>◆ {o.price}</span>
                  <span className="f-mono uc" style={{
                    fontSize: 9, color: affordable ? (isLegendary ? ringColor : accent) : '#e2334a', letterSpacing: '0.2em',
                  }}>
                    {affordable ? 'buy' : 'low'}
                  </span>
                </div>
              </div>
              <span className="tip">
                <span className="tip-title">{m.name}</span>
                {m.desc}
                {m.flavor && <span className="tip-flavor">{m.flavor}</span>}
                <span style={{ display: 'block', marginTop: 6, color: '#f5c451' }}>
                  Buy ◆ {o.price} · sell back ◆ {refundIfBought}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <HandLevelsPanel comboLevels={comboLevels} />

      <CollectionPanel
        catalysts={catalysts}
        catalystEditions={catalystEditions}
        vouchers={vouchers}
        consumables={consumables}
        ownedMods={ownedMods}
        voucherSellBlock={voucherSellBlock}
      />

      <div style={{
        position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)',
        display: 'flex', gap: 12, zIndex: 5, alignItems: 'center',
      }}>
        <button
          className="btn mat-interactive has-tip"
          onClick={() => {
            if (shards >= rerollCost) {
              dispatch({ type: 'REROLL_SHOP' });
              sfxPlay('cardFlip');
            }
          }}
          disabled={shards < rerollCost}
          style={{
            opacity: shards >= rerollCost ? 1 : 0.5,
            cursor: shards >= rerollCost ? 'pointer' : 'not-allowed',
          }}
        >
          ↻ Reroll <span className="f-mono num" style={{ color: '#f5c451' }}>◆ {rerollCost}</span>
          <span className="tip tip-above">Replace all current offers with a new set. Cost rises by 1 each reroll this visit.</span>
        </button>
        <button
          className="btn btn-primary mat-interactive has-tip"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}
        >
          Next Trial →
          <span className="tip tip-above">Leave the Bazaar and return to the Tribunal of Stars.</span>
        </button>
      </div>
    </div>
  );
}

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
            const rarityRing = it.rarity ? RARITY_COLORS[it.rarity] : it.color;
            return (
              <div
                key={`${it.id}-${it.index}`}
                className="has-tip"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 6,
                  background: 'rgba(15,9,37,0.5)',
                  border: `1px solid ${isLegendary ? rarityRing + 'aa' : it.color + '40'}`,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isLegendary ? `0 0 12px ${rarityRing}55, inset 0 0 6px ${rarityRing}22` : undefined,
                }}
              >
                {isLegendary && <div className="ff-holo" style={{ borderRadius: 6, opacity: 0.55 }} />}
                <span style={{
                  width: 26, height: 26, borderRadius: 4,
                  background: `${it.color}25`, border: `1px solid ${it.color}80`,
                  display: 'grid', placeItems: 'center', color: it.color, fontSize: 14,
                  position: 'relative', zIndex: 2,
                }}>{it.icon}</span>
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

function CollectionPanel({
  catalysts, catalystEditions, vouchers, consumables, ownedMods, voucherSellBlock,
}: {
  catalysts: string[];
  catalystEditions: Record<string, CatalystEdition>;
  vouchers: string[];
  consumables: string[];
  ownedMods: string[];
  voucherSellBlock: (id: string) => string | null;
}) {
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

  return (
    <div className="panel" style={{
      position: 'absolute', left: '50%', bottom: 92, transform: 'translateX(-50%)',
      width: 'min(1100px, calc(100vw - 60px))', maxHeight: 'min(220px, calc(100vh - 600px))',
      padding: '12px 18px', zIndex: 4, overflowY: 'auto',
    }}>
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
    </div>
  );
}

// Compact, fixed-position panel showing the player's leveled hand types.
// Only renders rows where the level is > 0 — keeps the panel out of the
// way at the start of a run, then grows as galaxies are picked.
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

function HandLevelsPanel({ comboLevels }: { comboLevels: Record<string, number> }) {
  const rows = HAND_LEVEL_ROWS
    .map((r) => ({ ...r, lvl: comboLevels[r.id] ?? 0, bonus: GALAXY_BONUS[r.id] }))
    .filter((r) => r.lvl > 0);
  if (rows.length === 0) return null;
  return (
    <div className="panel" style={{
      position: 'absolute', right: 24, top: 180, width: 200,
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
