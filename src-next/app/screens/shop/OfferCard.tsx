// Per-offer shop card. Click → BUY_OFFER. Hover → tooltip.
//
// Lifted out of `Shop.tsx` so the orchestrator can stay focused on
// layout. Behavior preserved verbatim: rarity glow ring, legendary
// holo sweep, edition badge, resonance hint, price + buy/low CTA,
// tooltip (with edition bonus + sell refund), card-wobble + chipPop
// entry animation, tight-portrait full-width vs desktop 180×250.

import { useRef } from 'react';
import { dispatch } from '../../../actions/dispatch';
import { sfxPlay } from '../../../audio/sfx';
import { sellRefund } from '../../../core/shop/sellRefund';
import { editionLabel, editionColor } from '../../../core/upgrades/editions';
import { pairsCompletedBy } from '../../../data/resonances';
import { lookupCatalyst, CATALYST_META } from '../../../data/catalysts';
import { KindFrame, type UpgradeKind } from '../../visual/upgradeKindFrames';
import { CatalystIcon } from '../../visual/CatalystIcon';
import { RARITY_COLORS, type Rarity } from '../../visual/rarityStyles';
import type { CatalystEdition } from '../../../state/slices/run';
import { offerMeta, editionBonusDescription } from './offerMeta';
import { EditionBadge } from './EditionBadge';
import { LegendaryFlourish, LegendaryEmbers } from '../../visual/LegendaryFlourish';
import { RevealAnimation } from './RevealAnimation';
import { store } from '../../../state/store';
import { bus } from '../../../events/bus';

const ACCENT = '#7be3ff';

// Soft rarity halo intensity sitting BEHIND the card. Stronger for
// higher rarities; legendary uses its own pulsing aura instead so
// the layers don't double-glow.
const RARITY_RING_STRENGTH: Record<Rarity, number> = {
  common: 0.18, uncommon: 0.32, rare: 0.55, legendary: 0,
};

export type ShopOffer = {
  kind: string;
  id: string;
  price: number;
  edition?: CatalystEdition;
};

export type OfferCardProps = {
  offer: ShopOffer;
  index: number;
  shards: number;
  catalysts: string[];
  catalystsFull: boolean;
  offerVersion: string;
  tight: boolean;
};

export function OfferCard({ offer: o, index: i, shards, catalysts, catalystsFull, offerVersion, tight }: OfferCardProps) {
  const m = offerMeta(o.kind, o.id);
  const c = m.color;
  const slotBlocked = o.kind === 'catalyst' && catalystsFull;
  const affordable = shards >= o.price && !slotBlocked;
  const refundIfBought = sellRefund(o.kind, o.id);
  const isLegendary = m.rarity === 'legendary';
  const ringColor = m.rarity ? RARITY_COLORS[m.rarity] : c;

  // Aliveness pass (2026-05-18). First-encounter discovery moment.
  // Snapshot the discovered set at mount via useRef so the reveal
  // only fires once per offer, even if the discovery dispatch
  // updates meta.discovered before the next render. Catalyst kind
  // only — mods/vouchers/consumables have their own codex paths
  // (DiscoveryBridge covers them on shop open).
  const revealRef = useRef<{ catalyst: boolean; edition: 'foil' | 'holo' | 'poly' | 'void' | null } | null>(null);
  if (revealRef.current === null) {
    if (o.kind === 'catalyst') {
      const meta = store.getState().meta;
      const known = new Set(meta.discovered.catalysts ?? []);
      const knownEditions = new Set(meta.discovered.editions ?? []);
      const isNewCatalyst = !known.has(o.id);
      const ed = o.edition ?? null;
      const isNewEdition = ed != null && !knownEditions.has(ed);
      revealRef.current = {
        catalyst: isNewCatalyst,
        edition: isNewEdition ? ed : null,
      };
      // Defer the dispatch a frame so the parent's mount cycle
      // completes before any listener re-renders the shop. Without
      // the rAF the bridge synchronously updates meta.discovered
      // during render, which React warns about under StrictMode.
      if (isNewCatalyst || isNewEdition) {
        const fire = () => {
          if (isNewCatalyst) {
            const total = (CATALYST_META.length) | 0;
            bus.emit('onCatalystDiscovered', { catalystId: o.id, total });
          }
          if (isNewEdition && ed) {
            bus.emit('onEditionDiscovered', { edition: ed, catalystId: o.id });
          }
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fire);
        else fire();
      }
    } else {
      revealRef.current = { catalyst: false, edition: null };
    }
  }
  const showReveal = revealRef.current.catalyst || revealRef.current.edition != null;
  const cardBorder = isLegendary
    ? `1.5px solid ${ringColor}cc`
    : m.rarity === 'rare'
      ? `1px solid ${ringColor}aa`
      : `1px solid ${c}55`;
  const ringIntensity = m.rarity ? RARITY_RING_STRENGTH[m.rarity] : 0;

  return (
    <div
      // Key in the parent .map uses `${offerVersion}-${i}` so a reroll
      // forces React to remount each card and the spawn animation
      // re-fires. Without it, cards just swap content and feel static.
      key={`${offerVersion}-${i}`}
      // Skip the wobble idle animation on tight portrait — reading a
      // vertically stacked column is harder when each card is drifting.
      // `has-tip` is on this outer wrapper (not the inner panel-strong)
      // so the tooltip can escape the panel's overflow:hidden, which
      // clips the legendary holo shimmer. Hover and the long-press
      // controller both bubble through children to find this ancestor.
      className={`has-tip${tight ? '' : ' card-wobble'}`}
      style={{
        position: 'relative',
        animation: tight
          ? `chipPop 320ms cubic-bezier(0.2,0.8,0.2,1) ${i * 70}ms both`
          : `chipPop 320ms cubic-bezier(0.2,0.8,0.2,1) ${i * 70}ms both, card-wobble 3.4s ease-in-out ${i * 70 + 320}ms infinite`,
        width: tight ? '100%' : 'auto',
      }}
    >
      {ringIntensity > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: -10, borderRadius: 18, pointerEvents: 'none',
            background: `radial-gradient(circle at center, ${ringColor}${Math.round(ringIntensity * 255).toString(16).padStart(2, '0')} 0%, transparent 65%)`,
            filter: 'blur(8px)',
            zIndex: 0,
          }}
        />
      )}
      <div
        className={[
          'panel-strong',
          'ff-offer-card',
          affordable ? 'ff-offer-card-affordable' : '',
          isLegendary ? 'legendary-aura' : '',
          isLegendary ? 'ff-legendary-lift' : '',
        ].filter(Boolean).join(' ')}
        onPointerEnter={() => sfxPlay('cardFlip')}
        onClick={() => affordable && dispatch({ type: 'BUY_OFFER', offerIdx: i })}
        style={{
          // Tight portrait: full-width card; height auto so descriptions wrap.
          width: tight ? '100%' : 180,
          height: tight ? 'auto' : 250,
          minHeight: tight ? 200 : undefined,
          padding: 14,
          border: cardBorder,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          cursor: affordable ? 'pointer' : 'not-allowed',
          opacity: affordable ? 1 : 0.6,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Bespoke edition surface — same per-edition material
            language as the in-strip CatalystCard. Foil/holo/poly/void
            each render a distinct visual phenomenon below the card
            content. */}
        {o.kind === 'catalyst' && o.edition && (
          <div
            className={`ff-edition-surface ${
              o.edition === 'foil' ? 'ff-surface-foil' :
              o.edition === 'holo' ? 'ff-surface-holo' :
              o.edition === 'poly' ? 'ff-surface-poly' :
              o.edition === 'void' ? 'ff-surface-void' : ''
            }`}
            aria-hidden="true"
          />
        )}
        {/* Per-legendary signature flourish + idle embers. Catalyst
            kind only; mods/vouchers/packs don't have legendary tier. */}
        {isLegendary && o.kind === 'catalyst' && (
          <>
            <LegendaryFlourish catalystId={o.id} />
            <LegendaryEmbers />
          </>
        )}
        {/* Aliveness first-encounter reveal — only renders on the
            first time the player sees this catalyst (or this edition).
            Self-destructs after ~1.2s (or ~2s for rare editions). */}
        {showReveal && (
          <RevealAnimation name={m.name} edition={revealRef.current.edition ?? undefined} />
        )}

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%' }}>
          <div className="f-mono uc rarity-tag" style={{
            color: ringColor, marginBottom: 6,
            border: `1px solid ${ringColor}66`,
            background: isLegendary ? `${ringColor}14` : 'transparent',
          }}>
            {m.kindLabel}{m.rarity ? ` · ${m.rarity}` : ''}
          </div>
          <div style={{ marginTop: 8 }}>
            <KindFrame
              kind={o.kind as UpgradeKind}
              rarity={m.rarity ?? null}
              accentColor={m.rarity ? undefined : c}
              size={84}
            >
              {/* Icon keeps the offer's own color (catalyst tint, mod
                  accent, etc.) so identity stays visible inside the
                  rarity-tinted silhouette. Catalyst offers route
                  through CatalystIcon so a hand-authored SVG can
                  replace the emoji char when registered. Other
                  upgrade kinds keep the inline char. */}
              {o.kind === 'catalyst' ? (
                <CatalystIcon
                  catalystId={o.id}
                  fallbackChar={m.icon}
                  color={c}
                  size={isLegendary ? 56 : 52}
                />
              ) : (
                <span style={{
                  color: c,
                  filter: `drop-shadow(0 0 ${isLegendary ? 14 : 10}px ${c}${isLegendary ? 'cc' : '80'})`,
                }}>{m.icon}</span>
              )}
            </KindFrame>
          </div>
          <div className={`f-head${isLegendary ? ' ff-legendary-name' : ''}`} style={{
            fontSize: 14, color: isLegendary ? '#ffd97a' : '#f3f0ff', marginTop: 12, textAlign: 'center',
            // Lighter glow for legendaries — the nameplate sweep already
            // carries the celebratory motion. A heavy text-shadow on top
            // smears the glyphs as the bright bar passes, costing
            // legibility on the smallest viewports.
            textShadow: isLegendary ? `0 0 4px ${ringColor}66` : undefined,
          }}>
            {m.name}
            {o.kind === 'catalyst' && o.edition && <EditionBadge edition={o.edition} />}
          </div>
          {/* Resonance hint — pulses gold when this offer would
              complete a pair with an already-owned catalyst. Subtle on
              purpose: no number, just "you have a buddy for this" so
              synergy stays a discovery for the player. */}
          {o.kind === 'catalyst' && (() => {
            const completed = pairsCompletedBy(o.id, catalysts);
            if (completed.length === 0) return null;
            return (
              <div className="f-mono uc has-tip" style={{
                position: 'relative',
                marginTop: 4,
                fontSize: 9, letterSpacing: '0.24em',
                color: '#ffd84a',
                textShadow: '0 0 8px rgba(255,216,74,0.65)',
                animation: 'shopSynergyPulse 1.6s ease-in-out infinite',
              }}>
                ✦ resonance
                <span className="tip">
                  <span className="tip-title">Resonance Available</span>
                  Buying this completes {completed.length === 1 ? 'a pair' : `${completed.length} pairs`} with what you already own.
                  {completed.map((p) => (
                    <span key={p.id} style={{
                      display: 'block',
                      marginTop: 4,
                      color: '#ffd84a',
                    }}>
                      ▸ {p.name}
                    </span>
                  ))}
                </span>
              </div>
            );
          })()}
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
              fontSize: 9, color: affordable ? (isLegendary ? ringColor : ACCENT) : '#e2334a', letterSpacing: '0.2em',
            }}>
              {affordable ? 'buy' : slotBlocked ? 'full' : 'low'}
            </span>
          </div>
        </div>
      </div>
      <span className="tip">
        <span className="tip-title">{m.name}</span>
        {m.desc}
        {m.flavor && <span className="tip-flavor">{m.flavor}</span>}
        {o.edition && (o.kind === 'catalyst' || o.kind === 'mod') && (
          <span style={{
            display: 'block', marginTop: 6,
            color: editionColor(o.edition),
          }}>
            {editionLabel(o.edition)}: {editionBonusDescription(o.kind, o.edition)}
          </span>
        )}
        {/* Synergy preview — names owned catalysts that share this
            offer's archetype tribe so the player can read the build
            implication at a glance. Skipped silently for first-buy
            (no owned matches) or non-catalyst offers. */}
        {(() => {
          if (o.kind !== 'catalyst') return null;
          const offerArchetype = lookupCatalyst(o.id)?.archetype;
          if (!offerArchetype) return null;
          const matches = catalysts
            .filter((id) => id !== o.id)
            .map((id) => CATALYST_META.find((c) => c.id === id))
            .filter((meta) => meta?.archetype === offerArchetype)
            .map((meta) => meta!.name);
          if (matches.length === 0) return null;
          const list = matches.length <= 2 ? matches.join(' + ') : `${matches.slice(0, 2).join(' + ')} +${matches.length - 2} more`;
          return (
            <span style={{
              display: 'block', marginTop: 6, color: '#5be8a4',
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            }}>
              ◇ synergy with your build · {list}
            </span>
          );
        })()}
        <span style={{ display: 'block', marginTop: 6, color: '#f5c451' }}>
          Buy ◆ {o.price} · sell back ◆ {refundIfBought}
        </span>
      </span>
    </div>
  );
}
