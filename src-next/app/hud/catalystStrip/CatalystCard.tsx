// Per-catalyst card. Lifted out of CatalystStrip.tsx so the parent
// can stay a thin orchestrator and individual-card edits (rarity
// border, edition stamp, awakening badge, scaling counters,
// floater/ring overlays) don't require scrolling through 700 lines.
//
// Behavior is preserved verbatim from the original render block.

import type React from 'react';
import { lookupCatalyst, awakeningThreshold, isAwakened } from '../../../data/catalysts';
import { editionColor } from '../../../core/upgrades/editions';
import { KindFrame } from '../../visual/upgradeKindFrames';
import { CatalystIcon } from '../../visual/CatalystIcon';
import { SellButton } from '../SellButton';
import { LunarPhaseBadge, TideBadge, CornerBadge } from './badges';
import { LegendaryFlourish, LegendaryEmbers } from '../../visual/LegendaryFlourish';
import { MythicFrame } from '../../visual/MythicFrame';
import type { FloaterRecord, RingRecord, PulseKind } from './types';
import { CATALYST_ANIM } from './useCatalystEvents';

const BADGE_BUMP_DURATION_MS = 360;

// Visual constants only used by this card. Kept here so future
// per-card tweaks don't require hopping back into the orchestrator.
const RING_DURATION_MS = CATALYST_ANIM.RING_DURATION_MS;
const FLOATER_DURATION_MS = CATALYST_ANIM.FLOATER_DURATION_MS;

export type CatalystCardProps = {
  id: string;
  index: number;
  pulseKind: PulseKind | undefined;
  edition: string | undefined;
  isLinked: boolean;
  showLastThrowWarn: boolean;
  // Stack values that drive corner-badge text per catalyst id.
  stack: number | undefined;
  bumpKey: number;
  compoundingStacks: number;
  lunarPhase: number;
  lunarBaked: number;
  handsPlayed: number;
  mirroredHandActive: boolean;
  // Per-card transient effects.
  cardFloaters: FloaterRecord[];
  cardRings: RingRecord[];
  // Run-stat tooltip data.
  catalystChips: number;
  catalystFires: number;
  // Tight viewport flips the tooltip to anchor above the card so it
  // doesn't get clipped at the top of the play area.
  tight: boolean;
  // Wide-mode (catalyst strip is a vertical left rail). Tooltips flip
  // to `tip-right` so they don't cover the next card in the rail.
  wide: boolean;
};

export function CatalystCard(props: CatalystCardProps) {
  const {
    id, index: i, pulseKind, edition, isLinked, showLastThrowWarn,
    stack, bumpKey, compoundingStacks,
    lunarPhase, lunarBaked, handsPlayed, mirroredHandActive,
    cardFloaters, cardRings,
    catalystChips, catalystFires, tight, wide,
  } = props;

  const c = lookupCatalyst(id);
  if (!c) return null;

  const animation = showLastThrowWarn
    ? 'mat-telegraph-warn 1s ease-in-out infinite'
    : pulseKind === 'chain'
    ? `mat-chain-pulse ${CATALYST_ANIM.PULSE_DURATION_MS}ms ease-out`
    : pulseKind === 'fire-legendary'
    ? `mat-pulse-fire-legendary ${CATALYST_ANIM.PULSE_DURATION_LEGENDARY_MS}ms cubic-bezier(0.2, 1.2, 0.4, 1)`
    : pulseKind === 'fire'
    ? `mat-pulse-fire ${CATALYST_ANIM.PULSE_DURATION_MS}ms cubic-bezier(0.2, 1.2, 0.4, 1)`
    : pulseKind === 'scaling'
    ? `mat-pulse-scaling ${CATALYST_ANIM.PULSE_DURATION_SCALING_MS}ms cubic-bezier(0.25, 0.9, 0.35, 1)`
    : pulseKind === 'collision'
    ? `mat-pulse-collision ${CATALYST_ANIM.PULSE_DURATION_COLLISION_MS}ms cubic-bezier(0.32, 0, 0.12, 1)`
    : undefined;

  const isLegendary = c.rarity === 'legendary';
  const isMythic = c.rarity === 'mythic';
  const eColor = edition ? editionColor(edition) : null;
  // Bespoke surface treatment per edition (added 2026-05-15):
  // every edition is now a distinct material, not a tint. The
  // surface div renders BELOW the icon/name (z-index: 1). Legendary
  // skips the per-edition surface only if it has no edition — the
  // legendary frame ornament + embers carry that case. With both,
  // the edition surface stacks UNDER the legendary frame.
  const editionSurfaceClass =
    edition === 'foil'  ? 'ff-edition-surface ff-surface-foil'  :
    edition === 'holo'  ? 'ff-edition-surface ff-surface-holo'  :
    edition === 'poly'  ? 'ff-edition-surface ff-surface-poly'  :
    edition === 'void'  ? 'ff-edition-surface ff-surface-void'  :
    null;
  const isVoid = edition === 'void';
  // Void edition wins the border slot — it's the most build-defining
  // edition and needs the strongest visual grammar. Cosmic-purple
  // double-pulse glow distinguishes it from poly's orange.
  const borderColor =
    isVoid && eColor ? eColor :
    edition === 'foil' && eColor ? eColor :
    edition === 'poly' && eColor ? eColor :
    isLegendary ? '#ff7847cc' :
    isLinked ? '#ffd84acc' :
    c.color + '80';
  const extraShadow =
    isVoid && eColor ? `0 0 22px ${eColor}cc, 0 0 44px ${eColor}66, ` :
    edition === 'foil' && eColor ? `0 0 18px ${eColor}88, ` :
    edition === 'poly' && eColor ? `0 0 14px ${eColor}88, ` :
    isLinked ? '0 0 12px rgba(255,216,74,0.55), ' :
    '';

  return (
    <div
      key={i}
      className="has-tip has-sell card-wobble"
      data-catalyst-id={id}
      style={{ position: 'relative', animationDelay: `${(i * 230) % 1700}ms` }}
    >
      <SellButton kind="catalyst" id={id} index={i} variant="badge" />
      <div
        className={[
          isLegendary ? 'legendary-aura legendary-aura-static' : '',
          isLegendary ? 'ff-legendary-lift' : '',
          // 2026-05-16 brief-iterated polish — Void edition gets a
          // wider, breathing rim glow so a Void card visibly stands
          // out in a shop offer row, matching the design brief at
          // docs/catalyst-card-system-brief.md (Edition Overlay → Void).
          isVoid ? 'ff-card-void' : '',
          // Mythic host class — drives the breathing halo + shake +
          // displacement bursts. <MythicFrame> below auto-detects tile
          // size and drops the cartouche/scanlines/datastreams.
          isMythic ? 'is-mythic' : '',
        ].filter(Boolean).join(' ') || undefined}
        style={{
          width: 64, height: 88, borderRadius: 8,
          background: `linear-gradient(180deg, ${c.color}25, rgba(15,9,37,0.85))`,
          border: `1px solid ${borderColor}`,
          boxShadow: isLegendary
            ? undefined
            : `${extraShadow}0 0 14px ${c.color}40, inset 0 0 10px ${c.color}20`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 4px',
          cursor: 'help',
          animation,
          position: 'relative',
          overflow: 'hidden',
        }}>
        {/* Edition surface — bespoke material treatment per edition.
            Sits below content via z-index. Each edition is a
            different visual phenomenon (metal sweep / prismatic
            refraction / faceted crystal / cosmic absence). */}
        {editionSurfaceClass && <div className={editionSurfaceClass} aria-hidden="true" />}
        {/* Per-legendary signature flourish — mechanic-hinting
            micro-animation. Only fires when the catalyst is
            legendary AND has a registered flourish. */}
        {isLegendary && <LegendaryFlourish catalystId={id} />}
        {/* Mythic cyberpunk-cosmic frame. Tile size (64×88) is below
            the auto-compact threshold so MythicFrame drops the
            cartouche + scanlines + datastreams; marquee, brackets,
            crown, glitch, comet, and halo still fire. */}
        {isMythic && <MythicFrame name={c.name} />}
        <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.18em', color: '#bba8ff', position: 'relative', zIndex: 2 }}>catalyst</div>
        <div style={{
          position: 'relative', zIndex: 2,
          // Poly edition keeps its chromatic-aberration outer wrapper so
          // the silhouette + glyph both pick up the offset shadow.
          filter: edition === 'poly' && eColor
            ? `drop-shadow(-1.5px 0 0 ${eColor}aa) drop-shadow(1.5px 0 0 ${c.color}aa)`
            : undefined,
        }}>
          <KindFrame
            kind="catalyst"
            // Rarity drives the hexagon stroke + glow. Legendary
            // already has the outer .legendary-aura on the tile, so
            // we suppress the silhouette's own glow there.
            rarity={isLegendary ? null : c.rarity ?? null}
            size={42}
          >
            {/* Icon stays in the catalyst's identity color so each
                catalyst is recognizable independent of rarity.
                CatalystIcon picks a hand-authored SVG when registered
                and falls back to the catalyst's emoji char otherwise. */}
            <CatalystIcon
              catalystId={id}
              fallbackChar={c.icon}
              color={c.color}
              size={26}
            />
          </KindFrame>
        </div>
        <div
          className="f-mono uc"
          style={{
            fontSize: 7, letterSpacing: '0.14em',
            color: c.color,
            // Legendary strip-card name keeps a slight gold-warmth
            // shift instead of the gradient sweep — at 7px the sweep
            // washes the glyphs into illegibility. The OfferCard's
            // 14px name is large enough for the sweep to read.
            textShadow: isLegendary ? '0 0 3px rgba(255,217,122,0.5)' : undefined,
            textAlign: 'center', lineHeight: 1.2, position: 'relative', zIndex: 2,
          }}
        >
          {c.name.split(' ').pop()}
        </div>
        {edition && eColor && (
          <div
            className="f-mono uc"
            style={{
              position: 'absolute', top: 3, left: 3, zIndex: 3,
              fontSize: edition === 'void' ? 9 : 7,
              letterSpacing: '0.14em',
              padding: '1px 3px', borderRadius: 3,
              color: eColor,
              background: 'rgba(15,9,37,0.85)',
              border: `1px solid ${eColor}88`,
              fontWeight: edition === 'void' ? 700 : undefined,
              textShadow: edition === 'void' ? `0 0 6px ${eColor}` : undefined,
            }}
            title={`${edition} edition`}
          >
            {edition === 'void' ? '★' : edition.slice(0, 3)}
          </div>
        )}
        {id === 'compounding_bias' && compoundingStacks > 0 && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
            color: c.color, fontWeight: 700,
            background: 'rgba(15,9,37,0.85)',
            padding: '1px 4px', borderRadius: 4,
            border: `1px solid ${c.color}80`,
          }}>
            +{compoundingStacks}
          </div>
        )}
        {/* 2026-05-11 scaling pack — visible per-catalyst counters.
            Wrapped in a keyed div so the badge-bump animation
            re-fires on every stack increment without affecting the
            Lunar / Tide cosmetic badges (which animate themselves). */}
        {(() => {
          const wrap = (node: React.ReactNode) => (
            <div key={`bump-${bumpKey}`} className="badge-bumpable" style={{
              animation: bumpKey > 0
                ? `badge-bump ${BADGE_BUMP_DURATION_MS}ms cubic-bezier(0.2, 1.2, 0.4, 1)`
                : undefined,
              transformOrigin: 'center',
            }}>
              {node}
            </div>
          );
          if (id === 'star_chart' && stack) return wrap(<CornerBadge color={c.color} text={`+${(stack * 0.25).toFixed(2)}×`} />);
          if (id === 'lodestone' && stack) return wrap(<CornerBadge color={c.color} text={`+${stack * 2}c`} />);
          if (id === 'comet_trail' && stack) return wrap(<CornerBadge color={c.color} text={`+${stack * 10}c`} />);
          if (id === 'memento_star' && stack) return wrap(<CornerBadge color={c.color} text={`+${(stack * 0.5).toFixed(1)}×`} />);
          if (id === 'ouroboros' && stack) return wrap(<CornerBadge color={c.color} text={`+${stack * 3}m`} />);
          if (id === 'event_horizon' && stack) return wrap(<CornerBadge color={c.color} text={`+${stack}%`} />);
          if (id === 'highwater' && stack) return wrap(<CornerBadge color={c.color} text={`+${stack}m`} />);
          if (id === 'heirloom_locket' && stack) return wrap(<CornerBadge color={c.color} text={`+${(stack * 0.15).toFixed(2)}×`} />);
          if (id === 'lunar_phases') return <LunarPhaseBadge color={c.color} phase={lunarPhase} baked={lunarBaked} />;
          if (id === 'tide') return <TideBadge color={c.color} ebb={handsPlayed % 2 === 0} />;
          return null;
        })()}
        {/* Mirrored Hand armed indicator — small star on the strip
            edge when the player is holding 2+ palindrome catalysts.
            Shown on every owned catalyst card for ambient visibility. */}
        {mirroredHandActive && i === 0 && (
          <div className="has-tip" style={{
            position: 'absolute', top: -6, left: -6, zIndex: 4,
            fontSize: 14, color: '#f5c451',
            textShadow: '0 0 8px #f5c451, 0 0 14px rgba(245,196,81,0.6)',
          }}
            title="Mirrored Hand armed — first hand of every blind retriggers."
          >
            ⟁
          </div>
        )}
        {id === 'patience_counter' && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
            color: c.color, fontWeight: 700,
            background: 'rgba(15,9,37,0.85)',
            padding: '1px 4px', borderRadius: 4,
            border: `1px solid ${c.color}80`,
          }}>
            {handsPlayed % 5}/5
          </div>
        )}
        {/* Awakening — visible once the catalyst has fired enough
            times this run. Pure cosmetic in v1; mechanical
            multipliers gated behind playtest data. */}
        {(() => {
          const threshold = awakeningThreshold(id);
          const awakened = isAwakened(id, catalystFires);
          if (threshold == null) return null;
          return awakened ? (
            <div className="awakened-badge has-tip" style={{
              position: 'absolute', bottom: 4, right: 4, zIndex: 3,
              fontSize: 11, fontWeight: 700,
              color: '#f5c451',
              textShadow: '0 0 8px #f5c451, 0 0 14px rgba(245,196,81,0.6)',
              background: 'rgba(15,9,37,0.85)',
              padding: '1px 4px', borderRadius: 4,
              border: '1px solid #f5c451aa',
            }}>★</div>
          ) : null;
        })()}
      </div>
      {/* Idle drift embers — only on legendaries. Two staggered
          sparks float upward from the bottom of the card. Live
          OUTSIDE the inner panel so they aren't clipped by the
          panel's overflow: hidden as they drift up + away. */}
      {isLegendary && <LegendaryEmbers />}
      {/* Ring bursts emanate from the card center on each fire. Live
          outside the inner card div so overflow: hidden doesn't clip
          them as they expand. */}
      {cardRings.map((r) => (
        <div
          key={`r-${r.key}`}
          className="catalyst-fire-ring"
          style={{
            position: 'absolute',
            top: 44, left: 32,
            width: 64, height: 64,
            borderRadius: '50%',
            border: `2px solid ${r.color}`,
            boxShadow: `0 0 18px ${r.color}, 0 0 36px ${r.color}88`,
            pointerEvents: 'none',
            transformOrigin: 'center',
            animation: `mat-fire-ring ${RING_DURATION_MS}ms cubic-bezier(0.15, 0.6, 0.3, 1) forwards`,
            zIndex: 5,
          }}
        />
      ))}
      {/* Delta floaters — "+24" or "+1.5 mult" rises off the card. */}
      {cardFloaters.map((f) => (
        <div
          key={`f-${f.key}`}
          className="catalyst-floater f-mono"
          style={{
            position: 'absolute',
            left: 32, top: 18,
            pointerEvents: 'none',
            fontSize: f.tone === 'mult' ? 13 : 14,
            fontWeight: 800,
            letterSpacing: '0.04em',
            color:
              f.tone === 'mult' ? '#ff7847' :
              f.tone === 'scaling' ? '#5be8a4' :
              '#7be3ff',
            textShadow:
              f.tone === 'mult'
                ? '0 0 12px rgba(255,120,71,0.95), 0 0 24px rgba(255,120,71,0.55)'
              : f.tone === 'scaling'
                ? '0 0 12px rgba(91,232,164,0.95), 0 0 24px rgba(91,232,164,0.55)'
              : '0 0 12px rgba(123,227,255,0.95), 0 0 24px rgba(123,227,255,0.55)',
            whiteSpace: 'nowrap',
            animation: `catalyst-floater-up ${FLOATER_DURATION_MS}ms cubic-bezier(0.2, 1.0, 0.4, 1) forwards`,
            zIndex: 6,
          }}
        >
          {f.text}
        </div>
      ))}
      {/* Tight portrait: tip-above so the popover doesn't get clipped at
          the top of the play area. Wide-mode landscape: tip-right so
          the popover lands in the play area instead of covering the
          next card in the vertical rail. */}
      <div className={tight ? 'tip tip-above' : wide ? 'tip tip-right' : 'tip'}>
        <span className="tip-title">{c.name}</span>
        {c.desc}
        {c.flavor && <span className="tip-flavor">{c.flavor}</span>}
        {/* Live "currently" line for the 2026-05-11 scaling pack so
            the player can see what they've accrued without doing the
            math in their head. */}
        {(() => {
          let line: string | null = null;
          if (id === 'star_chart' && stack) line = `currently +${(stack * 0.25).toFixed(2)}× mult · ${stack} straights`;
          else if (id === 'lodestone' && stack) line = `currently +${stack * 2} chips · ${stack} pairs`;
          else if (id === 'comet_trail' && stack) line = `currently +${stack * 10} chips · ${stack}-blind streak`;
          else if (id === 'memento_star' && stack) line = `currently +${(stack * 0.5).toFixed(1)}× mult · ${stack} overflows`;
          else if (id === 'ouroboros' && stack) line = `currently +${stack * 3} mult · ${stack} loops`;
          else if (id === 'event_horizon' && stack) line = `currently +${stack}% mult · ${stack} big hits absorbed`;
          else if (id === 'highwater' && stack) line = `currently +${stack} mult · ${stack} personal bests`;
          else if (id === 'heirloom_locket' && stack) line = `currently +${(stack * 0.15).toFixed(2)}× mult · ${stack} blinds`;
          else if (id === 'lunar_phases') line = `phase ${lunarPhase}/8 · baked ×${(1 + lunarBaked).toFixed(2)}`;
          if (!line) return null;
          return (
            <span style={{
              display: 'block', marginTop: 6,
              color: '#7be3ff',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
            }}>
              ◇ {line}
            </span>
          );
        })()}
        {catalystChips > 0 && (
          <span style={{
            display: 'block', marginTop: 6,
            color: '#7be3ff',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
          }}>
            ◇ contributed +{Math.round(catalystChips).toLocaleString()} chips this run
          </span>
        )}
        {(() => {
          const threshold = awakeningThreshold(id);
          if (threshold == null) return null;
          const awakened = catalystFires >= threshold;
          return (
            <span style={{
              display: 'block', marginTop: 4,
              color: awakened ? '#f5c451' : '#bba8ff',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
            }}>
              {awakened
                ? `★ Awakened — ${catalystFires} fires this run`
                : `Awakening: ${catalystFires} / ${threshold} fires`}
            </span>
          );
        })()}
      </div>
    </div>
  );
}
