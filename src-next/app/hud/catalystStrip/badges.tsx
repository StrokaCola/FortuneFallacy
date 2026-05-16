// Per-catalyst corner badges. Three small components extracted from
// the CatalystStrip render so the parent file can stay readable.
//
// - LunarPhaseBadge: 8-segment lunar dial that ticks forward each
//   blind. Highlights the current phase + shows the baked multiplier.
// - TideBadge: EBB/FLOW two-tab indicator that flips on hand parity.
// - cornerBadge: shared rectangle for the 2026-05-11 scaling-pack
//   counters (Lodestone, Comet Trail, Memento Star, etc.).

const PHASE_GLYPHS = ['○', '◔', '◑', '◕', '●', '◕', '◑', '◔'];

export function LunarPhaseBadge({ color, phase, baked }: { color: string; phase: number; baked: number }) {
  return (
    <div style={{
      position: 'absolute', top: 4, right: 4,
      background: 'rgba(15,9,37,0.85)',
      padding: '2px 5px', borderRadius: 4,
      border: `1px solid ${color}80`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      lineHeight: 1,
      whiteSpace: 'nowrap',
    }}>
      <div style={{ display: 'flex', gap: 1, fontSize: 7, color }}>
        {PHASE_GLYPHS.map((g, i) => (
          <span key={i} style={{
            color: i === phase ? '#f5c451' : color,
            opacity: i === phase ? 1 : 0.45,
            textShadow: i === phase ? '0 0 4px rgba(245,196,81,0.85)' : undefined,
            transition: 'color 200ms, opacity 200ms',
          }}>
            {g}
          </span>
        ))}
      </div>
      {baked > 0 && (
        <div className="f-mono" style={{
          fontSize: 8, fontWeight: 700,
          color: '#f5c451',
          marginTop: 1, letterSpacing: '0.04em',
        }}>
          ×{(1 + baked).toFixed(2)}
        </div>
      )}
    </div>
  );
}

// Tide — split into two tabs (EBB / FLOW). Active tab gets the catalyst's
// color + a subtle horizontal wave sweep; inactive is dim. The badge
// width is tight so the strip card doesn't expand on narrow viewports.
export function TideBadge({ color, ebb }: { color: string; ebb: boolean }) {
  return (
    <div style={{
      position: 'absolute', top: 4, right: 4,
      background: 'rgba(15,9,37,0.85)',
      padding: '1px 2px', borderRadius: 4,
      border: `1px solid ${color}80`,
      display: 'flex', gap: 2,
      lineHeight: 1,
    }}>
      <div className="f-mono" style={{
        fontSize: 7, fontWeight: 700, letterSpacing: '0.08em',
        padding: '1px 4px',
        borderRadius: 2,
        color: ebb ? color : '#3a2f5a',
        background: ebb ? `${color}25` : 'transparent',
        textShadow: ebb ? `0 0 6px ${color}aa` : undefined,
        transition: 'all 200ms',
      }}>
        EBB
      </div>
      <div className="f-mono" style={{
        fontSize: 7, fontWeight: 700, letterSpacing: '0.08em',
        padding: '1px 4px',
        borderRadius: 2,
        color: !ebb ? color : '#3a2f5a',
        background: !ebb ? `${color}25` : 'transparent',
        textShadow: !ebb ? `0 0 6px ${color}aa` : undefined,
        transition: 'all 200ms',
      }}>
        FLOW
      </div>
    </div>
  );
}

// Shared corner-badge for scaling-pack counters. Same shape as
// compounding_bias' inline badge — color comes from the catalyst's
// own identity hue. Renamed from the legacy `renderBadge` helper to
// match React's component-as-function convention even though it
// returns JSX directly (no internal state).
//
// 2026-05-16 polish — bumped from 9→12px and added a colored glow so
// the accrued stack reads as a satisfying "look what I've built"
// signal rather than a corner footnote. Strip cards are 64×88, so we
// can't push the counter past ~12px without crowding the icon, but
// the glow + weight gives the number presence at any zoom.
export function CornerBadge({ color, text }: { color: string; text: string }) {
  return (
    <div style={{
      position: 'absolute', top: 3, right: 3,
      fontSize: 12, fontFamily: '"JetBrains Mono", monospace',
      color, fontWeight: 800,
      background: 'rgba(15,9,37,0.92)',
      padding: '2px 5px', borderRadius: 5,
      border: `1px solid ${color}cc`,
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
      boxShadow: `0 0 8px ${color}66, 0 0 16px ${color}33`,
      textShadow: `0 0 6px ${color}aa`,
      lineHeight: 1,
    }}>
      {text}
    </div>
  );
}
