// Empty-slot ghost — a faint, dashed-border placeholder card shown in
// place of a real upgrade when the player has none of the relevant
// kind owned. Surfaces *where the thing will live* so a new player
// understands the strip/tray exists and how to fill it, rather than
// staring at empty space and assuming the HUD is broken.
//
// Used by:
//   - CatalystStrip (kind='catalyst')
//   - ConsumableTray (kind='consumable')
//
// Visual treatment matches the dimensions of a real card (64×88) so
// when the player buys their first item the layout doesn't jump. The
// ghost is `pointer-events: auto` only on the tooltip child so it
// doesn't block taps on neighbouring HUD elements.

type Kind = 'catalyst' | 'consumable';

type EmptySlotProps = {
  kind: Kind;
  // Optional flavour text override. Defaults match the kind.
  hint?: string;
};

const KIND_COPY: Record<Kind, { label: string; sigil: string; tip: string }> = {
  catalyst: {
    label: 'catalyst',
    sigil: '✦',
    tip: 'Catalysts modify how your dice score. Buy them at the Bazaar between blinds; up to your slot cap can ride along on a run.',
  },
  consumable: {
    label: 'consumable',
    sigil: '◇',
    tip: 'Consumables are single-use. Galaxies level up a hand type for the rest of the run; spectrals are one-shot powerups.',
  },
};

export function EmptySlot({ kind, hint }: EmptySlotProps) {
  const { label, sigil, tip } = KIND_COPY[kind];
  return (
    <div
      className="has-tip"
      role="img"
      aria-label={`No ${label} owned yet`}
      style={{
        width: 64,
        height: 88,
        borderRadius: 8,
        border: '1px dashed rgba(187,168,255,0.35)',
        background: 'rgba(28,18,69,0.25)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 4px',
        position: 'relative',
        cursor: 'help',
        opacity: 0.7,
      }}
    >
      <div className="f-mono uc" style={{
        fontSize: 8,
        letterSpacing: '0.18em',
        color: 'rgba(187,168,255,0.6)',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 28,
        lineHeight: 1,
        color: 'rgba(149,119,255,0.55)',
        textShadow: '0 0 8px rgba(149,119,255,0.35)',
      }}>
        {sigil}
      </div>
      <div className="f-mono" style={{
        fontSize: 7,
        letterSpacing: '0.08em',
        color: 'rgba(187,168,255,0.55)',
        textAlign: 'center',
        lineHeight: 1.2,
      }}>
        none yet
      </div>
      <div className="tip">
        <span className="tip-title">No {label} owned</span>
        {hint ?? tip}
      </div>
    </div>
  );
}
