// BossDreadFlourish — per-boss unique flourish rendered during
// the dread phase of BossReveal, layered above the existing
// darken-vignette + sigil silhouette.
//
// Each boss id maps to one of five flourish KINDS:
//
//   - orbital-collapse  (Pluto, Sedna)  — concentric rings shrink inward
//   - starfall          (Ceres)         — stars drop from top edges
//   - frost             (Triton, Charon)— ice streaks from corners
//   - chromatic         (Callisto, Phobos) — chromatic bands hiccup across
//   - scatter           (Eris)          — discord ×'s burst outward
//
// Color is driven by the boss accent so each instance picks up its
// identity without per-boss colour hardcoding. Returns null for
// unknown boss ids (defensive — older saves / new bosses).

type Props = {
  bossId: string;
  color: string;
};

type FlourishKind = 'orbital-collapse' | 'starfall' | 'frost' | 'chromatic' | 'scatter';

const BOSS_FLOURISH: Record<string, FlourishKind> = {
  pluto: 'orbital-collapse',
  sedna: 'orbital-collapse',
  ceres: 'starfall',
  triton: 'frost',
  charon: 'frost',
  callisto: 'chromatic',
  phobos: 'chromatic',
  eris: 'scatter',
};

export function BossDreadFlourish({ bossId, color }: Props) {
  const kind = BOSS_FLOURISH[bossId];
  if (!kind) return null;
  const style = { color };
  switch (kind) {
    case 'orbital-collapse':
      return (
        <div className="ff-boss-flourish-orbital-collapse" style={style} aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
      );
    case 'starfall':
      return (
        <div className="ff-boss-flourish-starfall" style={style} aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
      );
    case 'frost':
      return (
        <div className="ff-boss-flourish-frost" style={style} aria-hidden="true">
          <div /><div /><div /><div />
        </div>
      );
    case 'chromatic':
      return (
        <div className="ff-boss-flourish-chromatic" style={style} aria-hidden="true">
          <div /><div /><div />
        </div>
      );
    case 'scatter':
      return (
        <div className="ff-boss-flourish-scatter" style={style} aria-hidden="true">
          <span>×</span><span>×</span><span>×</span><span>×</span>
          <span>×</span><span>×</span><span>×</span><span>×</span>
        </div>
      );
  }
}
