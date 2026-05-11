// 2026-05-11 polish (out-of-scope follow-up) — per-die scaling-mod stack
// indicator. Renders ONLY when the player has at least one die carrying
// a scaling mod with a non-zero stack. Sits as a low, narrow strip
// anchored to the bottom of the play area so it never overlaps
// CatalystStrip or the action bar.
//
// Rather than projecting Three.js dice positions to screen-space (which
// would jitter during physics rolls and add a per-frame camera read),
// we render a compact strip of `die N · +stack` chips. The dice
// themselves are clearly labeled "die 1 / die 2 / ..." via the Forge
// die-picker, so the mapping is already in player muscle memory.
//
// Per-die expansion: each chip lists EVERY scaling mod on that die so a
// die with both Tally Mark and Glutton shows two values. The chip uses
// the mod's accent color for the value, the same color as the Forge
// stack chip — visual continuity across screens.

import { useStore, type GameState } from '../../state/store';
import { lookupMod, type ModDef } from '../../core/mods';
import { Z } from './zLayers';
import { useIsTightStage } from '../hooks/useIsCompactStage';

const EMPTY_STACKS: number[][] = [];
const selectDiceMods = (s: GameState) => s.run.diceMods;
const selectDiceModStacks = (s: GameState) => s.run.diceModStacks ?? EMPTY_STACKS;
const selectActive = (s: GameState) => s.round.active;

function isScaling(def: ModDef): boolean {
  return !!(
    def.tallyChipPerStack ||
    def.cadenceMultPerStack ||
    def.veteranMultPerStack ||
    def.gluttonChipPerStack ||
    def.dormantAwakenAt != null ||
    def.ballastChipPerStack ||
    def.pyreChipPerStack
  );
}

function formatLabel(def: ModDef, stack: number): string {
  if (def.tallyChipPerStack) return `+${stack * def.tallyChipPerStack}c`;
  if (def.cadenceMultPerStack) return `+${stack * def.cadenceMultPerStack}m`;
  if (def.veteranMultPerStack) return `+${(stack * def.veteranMultPerStack).toFixed(1)}m`;
  if (def.gluttonChipPerStack) return `+${stack * def.gluttonChipPerStack}c`;
  if (def.dormantAwakenAt != null) {
    return stack >= def.dormantAwakenAt ? '★' : `${stack}/${def.dormantAwakenAt}`;
  }
  if (def.ballastChipPerStack) return `+${stack * def.ballastChipPerStack}c`;
  if (def.pyreChipPerStack) return `+${stack * def.pyreChipPerStack}c`;
  return `${stack}`;
}

export function DiceStackStrip() {
  const diceMods = useStore(selectDiceMods);
  const diceModStacks = useStore(selectDiceModStacks);
  const active = useStore(selectActive);
  const tight = useIsTightStage();

  if (!active) return null;

  // Build per-die rows. A die appears in the strip only if at least one
  // attached mod is scaling AND has stack > 0 OR the dormant tracker
  // (which we want to surface from stack 0 onward so the player sees
  // the 0/10 progress).
  type Chip = { dieIdx: number; modIcon: string; label: string; color: string; awakened: boolean };
  const chips: Chip[] = [];
  for (let i = 0; i < diceMods.length; i++) {
    const row = diceMods[i] ?? [];
    const stackRow = diceModStacks[i] ?? [];
    for (let j = 0; j < row.length; j++) {
      const def = lookupMod(row[j]!);
      if (!def || !isScaling(def)) continue;
      const stack = stackRow[j] ?? 0;
      const isDormant = def.dormantAwakenAt != null;
      // Surface dormant from stack 0 (it's a progress bar). For others,
      // only show when there's something to celebrate.
      if (stack === 0 && !isDormant) continue;
      const color = def.visual?.accentColor ?? '#88ddff';
      const awakened = isDormant && stack >= (def.dormantAwakenAt ?? 0);
      chips.push({
        dieIdx: i,
        modIcon: def.icon,
        label: formatLabel(def, stack),
        color,
        awakened,
      });
    }
  }
  if (chips.length === 0) return null;

  return (
    <div
      data-coach="dice-stack-strip"
      style={{
        position: 'absolute',
        // Sit just above the action bar (which sets --hud-bottom-h). On
        // tight viewports tuck a bit closer to leave room for the
        // ConsumableTray + AstralHint stack.
        bottom: `calc(var(--hud-bottom-h, 60px) + ${tight ? 6 : 12}px)`,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: Z.hud,
        pointerEvents: 'none',
        display: 'flex',
        gap: 6,
        padding: '4px 8px',
        maxWidth: 'min(96vw, 720px)',
        flexWrap: 'wrap',
        justifyContent: 'center',
        background: 'rgba(15,9,37,0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: '1px solid rgba(149,119,255,0.25)',
        borderRadius: 8,
      }}>
      {chips.map((c, i) => (
        <div
          key={`${c.dieIdx}-${i}`}
          className="f-mono"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, lineHeight: 1,
            padding: '3px 6px', borderRadius: 4,
            background: `${c.color}18`,
            border: `1px solid ${c.color}55`,
            color: c.color,
            letterSpacing: '0.04em',
            textShadow: c.awakened ? `0 0 8px ${c.color}` : undefined,
          }}>
          <span style={{ opacity: 0.6, fontSize: 8 }}>d{c.dieIdx + 1}</span>
          <span style={{ fontSize: 12 }}>{c.modIcon}</span>
          <span style={{ fontWeight: 700 }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}
