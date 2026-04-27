import { useStore } from '../../state/store';
import { selectIsBoss, selectBlindId } from '../../state/selectors';
import { BOSS_BLINDS } from '../../data/blinds';
import { activeDebuffs } from '../../core/round/debuffs';
import type { GameState } from '../../state/store';

const selectDebuffsKey = (s: GameState): string => [...activeDebuffs(s)].sort().join(',');

const DEBUFF_GLYPHS: Record<string, { glyph: string; label: string }> = {
  no_rerolls: { glyph: '∅', label: 'No rerolls' },
  auto_unlock_after_roll: { glyph: '⌀', label: 'Auto-unlock after roll' },
  no_pairs: { glyph: '⊗', label: 'Pairs forsaken' },
  half_score: { glyph: '½', label: 'Half score' },
};

export function DangerCorner() {
  const isBoss = useStore(selectIsBoss);
  const blindId = useStore(selectBlindId);
  const debuffs = useStore(selectDebuffsKey);
  const debuffList = debuffs ? debuffs.split(',') : [];

  const bossDef = isBoss ? BOSS_BLINDS.find((b) => b.id === blindId) : null;

  return (
    <div style={{
      position: 'absolute', top: 18, right: 18,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
      pointerEvents: 'auto', zIndex: 5,
    }}>
      {bossDef && (
        <div
          className="mat-obsidian has-tip"
          style={{
            position: 'relative',
            padding: '8px 12px', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 8,
            borderColor: 'rgba(226,51,74,0.6)',
            cursor: 'help',
          }}>
          <span style={{ fontSize: 22, color: '#e2334a', filter: 'drop-shadow(0 0 6px #e2334a)' }}>⛧</span>
          <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#ff8e9c' }}>
            Boss · {bossDef.name}
          </span>
          <span className="tip">{(bossDef as { description?: string }).description ?? 'Boss blind active'}</span>
        </div>
      )}
      {debuffList.length > 0 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {debuffList.map((d) => {
            const meta = DEBUFF_GLYPHS[d] ?? { glyph: '⚠', label: d };
            return (
              <div key={d} className="has-tip" style={{ position: 'relative' }}>
                <span
                  className="mat-obsidian"
                  style={{
                    display: 'inline-grid', placeItems: 'center',
                    width: 24, height: 24, borderRadius: 6,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                    color: '#ff8e9c', borderColor: 'rgba(226,51,74,0.5)',
                  }}>
                  {meta.glyph}
                </span>
                <span className="tip">{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
