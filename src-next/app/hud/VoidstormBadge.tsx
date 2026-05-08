// Voidstorm badge — small panel pinned below the TopBar that surfaces
// the active per-blind modifier (boon or curse) so players know about
// the tilt before they commit a hand. See core/round/voidstorms.ts.

import { useStore, type GameState } from '../../state/store';
import { lookupVoidstorm } from '../../core/round/voidstorms';

const selectVoidstormId = (s: GameState) => s.round.voidstormId;
const selectActive = (s: GameState) => s.round.active;

export function VoidstormBadge() {
  const id = useStore(selectVoidstormId);
  const active = useStore(selectActive);
  if (!active || !id) return null;
  const def = lookupVoidstorm(id);
  if (!def) return null;
  const isBoon = def.tone === 'boon';
  const accent = isBoon ? '#7be3ff' : '#ff4d6d';
  const glyph = isBoon ? '✦' : '✺';
  return (
    <div className="has-tip" style={{
      position: 'absolute',
      top: 'calc(var(--hud-top-h, 134px) + 8px)',
      right: 18,
      padding: '6px 12px',
      borderRadius: 8,
      background: 'rgba(7,5,26,0.78)',
      border: `1px solid ${accent}88`,
      boxShadow: `0 0 14px ${accent}55`,
      pointerEvents: 'auto',
      zIndex: 4,
      display: 'flex', alignItems: 'center', gap: 8,
      cursor: 'help',
    }}>
      <span style={{
        fontSize: 14,
        color: accent,
        textShadow: `0 0 8px ${accent}`,
      }}>{glyph}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span className="f-mono uc" style={{
          fontSize: 8, letterSpacing: '0.32em',
          color: isBoon ? '#7be3ff' : '#ff7847',
        }}>
          voidstorm · {def.tone}
        </span>
        <span className="f-mono" style={{ fontSize: 11, color: '#f3f0ff' }}>
          {def.name}
        </span>
      </div>
      <span className="tip">
        <span className="tip-title">{def.name} · Voidstorm {def.tone === 'boon' ? 'Boon' : 'Curse'}</span>
        {def.flavor}
      </span>
    </div>
  );
}
