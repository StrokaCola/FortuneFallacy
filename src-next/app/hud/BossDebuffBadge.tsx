// Boss debuff badge — small panel pinned below the TopBar that
// surfaces the active boss blind's debuff so the player can see what
// they're playing against AFTER the reveal cinematic dismisses.
// Mirrors VoidstormBadge's layout exactly; voidstorms never spawn on
// boss blinds (see core/round/voidstorms.ts:88) so the two badges
// share a slot without ever colliding.

import { useStore, type GameState } from '../../state/store';
import { BOSS_BLINDS } from '../../data/blinds';
import { BossIcon } from '../visual/BossIcon';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import { Z } from './zLayers';

const selectActive = (s: GameState) => s.round.active;
const selectIsBoss = (s: GameState) => s.round.isBoss;
const selectBlindId = (s: GameState) => s.round.blindId;

export function BossDebuffBadge() {
  const active = useStore(selectActive);
  const isBoss = useStore(selectIsBoss);
  const blindId = useStore(selectBlindId);
  const tight = useIsTightStage();
  if (!active || !isBoss || !blindId) return null;
  const def = BOSS_BLINDS.find((b) => b.id === blindId);
  if (!def) return null;
  const accent = def.color;
  return (
    <div className="has-tip" style={{
      position: 'absolute',
      top: 'calc(var(--hud-top-h, 134px) + 8px)',
      right: tight ? 10 : 18,
      padding: tight ? '4px 8px' : '6px 12px',
      borderRadius: 8,
      background: 'rgba(7,5,26,0.78)',
      border: `1px solid ${accent}88`,
      boxShadow: `0 0 14px ${accent}55`,
      pointerEvents: 'auto',
      zIndex: Z.hud,
      display: 'flex', alignItems: 'center', gap: tight ? 0 : 8,
      cursor: 'help',
    }}>
      <span style={{
        display: 'inline-flex',
        filter: `drop-shadow(0 0 6px ${accent}aa)`,
      }}>
        <BossIcon boss={def} size={tight ? 16 : 14} />
      </span>
      {!tight && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span className="f-mono uc" style={{
            fontSize: 8, letterSpacing: '0.32em', color: '#ff8e9c',
          }}>
            boss · debuff
          </span>
          <span className="f-mono" style={{ fontSize: 11, color: '#f3f0ff' }}>
            {def.name}
          </span>
        </div>
      )}
      <span className={tight ? 'tip tip-above' : 'tip'}>
        <span className="tip-title">{def.name} · Boss Debuff</span>
        {def.description}
      </span>
    </div>
  );
}
