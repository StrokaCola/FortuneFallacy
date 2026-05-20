// Inline pill that renders next to an upgrade's name when it's been
// stamped with an edition. Color-coded by edition + animated:
//   - foil : a left-to-right shimmer sweep every 3.2s
//   - holo : a cyan-violet-cyan iridescent hue cycle every 4.8s
//   - poly : a red→yellow→green→blue rainbow gradient cycle every 6.4s
//   - void : a slow black-aura pulse so the "slot bypass" reads as
//            a distinct, important rarity tier
// Animations skip under .reduce-motion.
//
// Used by:
//   - OfferCard.tsx (shop offer with `o.edition` set)
//   - CollectionPanel.tsx (owned catalyst with an edition stamp)

import { editionLabel, editionColor } from '../../../core/upgrades/editions';
import type { CatalystEdition } from '../../../state/slices/run';

const EDITION_CLASS: Record<CatalystEdition, string> = {
  base: '',
  foil: 'edition-foil',
  holo: 'edition-holo',
  poly: 'edition-poly',
  void: 'edition-void',
};

export function EditionBadge({ edition }: { edition: CatalystEdition }) {
  const c = editionColor(edition);
  const title = editionLabel(edition);
  const body =
    edition === 'foil' ? '+50 pips when this catalyst fires.'
    : edition === 'holo' ? '+10 mult when this catalyst fires.'
    : edition === 'void' ? 'Does not count against your catalyst slot cap.'
    : 'Adds +50% of this catalyst\'s contribution each fire.';
  // 2026-05-19 fix — split the visual into an inner span so
  // `overflow: hidden` (needed to clip the foil shimmer ::before
  // pseudo) doesn't also clip the absolutely-positioned `.tip`
  // tooltip. The outer span owns positioning + has-tip; the inner
  // owns the animated visuals.
  return (
    <span
      className="has-tip"
      style={{
        position: 'relative',
        display: 'inline-block',
        marginLeft: 6,
        verticalAlign: 'middle',
      }}
    >
      <span
        className={`f-mono uc ${EDITION_CLASS[edition] ?? ''}`}
        style={{
          display: 'inline-block',
          padding: '1px 5px',
          fontSize: edition === 'void' ? 11 : 8,
          letterSpacing: '0.18em',
          borderRadius: 3,
          color: c,
          border: `1px solid ${c}88`,
          background: `${c}22`,
          fontWeight: edition === 'void' ? 700 : undefined,
          textShadow: edition === 'void' ? `0 0 6px ${c}` : undefined,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {edition === 'void' ? '★' : editionLabel(edition).slice(0, 4).toLowerCase()}
      </span>
      <span className="tip tip-above">
        <span className="tip-title" style={{ color: c }}>{title}</span>
        {body}
      </span>
    </span>
  );
}
