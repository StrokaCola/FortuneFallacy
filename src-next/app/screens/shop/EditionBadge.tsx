// Inline pill that renders next to an upgrade's name when it's been
// stamped with an edition. Color-coded by edition; tooltip text
// explains the mechanical bonus.
//
// Used by:
//   - OfferCard.tsx (shop offer with `o.edition` set)
//   - CollectionPanel.tsx (owned catalyst with an edition stamp)

import { editionLabel, editionColor } from '../../../core/upgrades/editions';
import type { CatalystEdition } from '../../../state/slices/run';

export function EditionBadge({ edition }: { edition: CatalystEdition }) {
  const c = editionColor(edition);
  const tip =
    edition === 'foil' ? 'Foil — +50 chips when this catalyst fires.'
    : edition === 'holo' ? 'Holographic — +10 mult when this catalyst fires.'
    : edition === 'void' ? 'Void — does not count against your catalyst slot cap.'
    : 'Polychrome — adds +50% of this catalyst\'s contribution each fire.';
  return (
    <span
      className="f-mono uc has-tip"
      style={{
        position: 'relative',
        marginLeft: 6,
        padding: '1px 5px',
        fontSize: edition === 'void' ? 11 : 8,
        letterSpacing: '0.18em',
        borderRadius: 3,
        color: c,
        border: `1px solid ${c}88`,
        background: `${c}22`,
        fontWeight: edition === 'void' ? 700 : undefined,
        textShadow: edition === 'void' ? `0 0 6px ${c}` : undefined,
      }}
    >
      {edition === 'void' ? '★' : editionLabel(edition).slice(0, 4).toLowerCase()}
      <span className="tip">{tip}</span>
    </span>
  );
}
