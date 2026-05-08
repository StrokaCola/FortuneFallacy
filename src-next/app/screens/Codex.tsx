import { useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { CATALYST_META } from '../../data/catalysts';
import { MODS } from '../../core/mods';
import { VOUCHERS } from '../../data/vouchers';
import { CONSTELLATIONS } from '../../data/constellations';
import { BOSS_BLINDS } from '../../data/blinds';
import { CONSUMABLES, consumableRarity } from '../../core/consumables';
import { describeDiceSpec } from '../../data/dice';
import { STAKES, stakeIndex } from '../../data/stakes';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../../data/achievements';
import { KindFrame } from '../visual/upgradeKindFrames';
import { RARITY_COLORS } from '../visual/rarityStyles';

type Tab = 'catalysts' | 'mods' | 'vouchers' | 'consumables' | 'constellations' | 'bosses' | 'achievements';

const TABS: { id: Tab; label: string }[] = [
  { id: 'catalysts', label: 'Catalysts' },
  { id: 'mods', label: 'Mods' },
  { id: 'vouchers', label: 'Vouchers' },
  { id: 'consumables', label: 'Consumables' },
  { id: 'constellations', label: 'Constellations' },
  { id: 'bosses', label: 'Bosses' },
  { id: 'achievements', label: 'Ascensions' },
];

const selectDiscovered = (s: GameState) => s.meta.discovered;
const selectStakeProgress = (s: GameState) => s.meta.stakeProgress;
const EMPTY_ACHIEVEMENTS = { unlocked: [] as string[], unlockedAt: {} as Record<string, number> };
const selectAchievements = (s: GameState) => s.meta.achievements ?? EMPTY_ACHIEVEMENTS;

// RARITY_COLORS now lives in app/visual/rarityStyles.ts (shared with Shop).

export function Codex() {
  const [tab, setTab] = useState<Tab>('catalysts');
  const discovered = useStore(selectDiscovered);
  const stakeProgress = useStore(selectStakeProgress);
  const achievements = useStore(selectAchievements);

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'auto',
      overflow: 'auto', padding: '32px 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div className="f-mono uc" style={{ fontSize: 11, color: '#7be3ff', letterSpacing: '0.5em' }}>
            ◇ catalogue ◇
          </div>
          <div className="f-display" style={{
            fontSize: 'clamp(24px, 7vw, 40px)', color: '#f3f0ff', marginTop: 4,
            textShadow: '0 0 30px rgba(123,227,255,0.4)',
          }}>
            Codex
          </div>
          <div className="f-mono" style={{ fontSize: 11, color: '#bba8ff', marginTop: 4, opacity: 0.85 }}>
            Items you've encountered. The unseen are silhouetted.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="f-mono uc"
              style={{
                padding: '8px 16px', borderRadius: 6,
                background: tab === t.id ? 'rgba(123,227,255,0.18)' : 'rgba(28,18,69,0.6)',
                border: `1px solid ${tab === t.id ? '#7be3ffaa' : 'rgba(149,119,255,0.3)'}`,
                color: tab === t.id ? '#7be3ff' : '#dcd4ff',
                fontSize: 10, letterSpacing: '0.28em',
                cursor: 'pointer',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'achievements' ? (
          <AchievementsView unlocked={achievements.unlocked} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
            marginBottom: 24,
          }}>
            {tab === 'catalysts' && (
              <CatalystGrid discovered={discovered.catalysts} />
            )}
            {tab === 'mods' && (
              <ModGrid discovered={discovered.mods} />
            )}
            {tab === 'vouchers' && (
              <VoucherGrid discovered={discovered.vouchers} />
            )}
            {tab === 'consumables' && (
              <ConsumableGrid discovered={discovered.consumables} />
            )}
            {tab === 'constellations' && (
              <ConstellationGrid stakeProgress={stakeProgress} />
            )}
            {tab === 'bosses' && (
              <BossGrid discovered={discovered.bosses} />
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button
            className="btn btn-ghost mat-interactive"
            style={{ width: 200 }}
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

function Cell({ children, locked = false, accent = '#7be3ff' }: { children: React.ReactNode; locked?: boolean; accent?: string }) {
  return (
    <div className="panel" style={{
      padding: 12, borderRadius: 10,
      border: `1px solid ${locked ? 'rgba(149,119,255,0.18)' : `${accent}55`}`,
      background: locked ? 'rgba(15,9,37,0.55)' : 'rgba(15,9,37,0.7)',
      filter: locked ? 'grayscale(0.85)' : undefined,
      opacity: locked ? 0.55 : 1,
      minHeight: 110,
    }}>
      {children}
    </div>
  );
}

function LockedTitle() {
  return (
    <>
      <div className="f-display" style={{ fontSize: 14, color: '#9577ff', letterSpacing: '0.18em' }}>
        ???
      </div>
      <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.22em', color: '#6a6080', marginTop: 4 }}>
        undiscovered
      </div>
    </>
  );
}

function CatalystGrid({ discovered }: { discovered: string[] }) {
  return (
    <>
      {CATALYST_META.map((c) => {
        const seen = discovered.includes(c.id);
        const accent = RARITY_COLORS[c.rarity] ?? c.color;
        return (
          <Cell key={c.id} locked={!seen} accent={accent}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KindFrame kind="catalyst" rarity={seen ? c.rarity : null} size={32}>
                <span style={{ color: seen ? c.color : '#6a6080' }}>{seen ? c.icon : '◇'}</span>
              </KindFrame>
              {seen ? (
                <div style={{ flex: 1 }}>
                  <div className="f-head" style={{ fontSize: 13, color: '#f3f0ff' }}>{c.name}</div>
                  <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.24em', color: accent }}>
                    {c.rarity}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1 }}><LockedTitle /></div>
              )}
            </div>
            {seen && (
              <>
                <div style={{ fontSize: 11, color: '#dcd4ff', marginTop: 6, lineHeight: 1.4 }}>{c.desc}</div>
                {c.flavor && (
                  <div style={{ fontSize: 10, color: '#bba8ff', marginTop: 6, fontStyle: 'italic' }}>{c.flavor}</div>
                )}
              </>
            )}
          </Cell>
        );
      })}
    </>
  );
}

function ModGrid({ discovered }: { discovered: string[] }) {
  return (
    <>
      {MODS.map((m) => {
        const seen = discovered.includes(m.id);
        const accent = m.visual?.accentColor ?? '#bba8ff';
        return (
          <Cell key={m.id} locked={!seen} accent={accent}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KindFrame kind="mod" rarity={seen ? m.rarity : null} size={32}>
                <span style={{ color: seen ? accent : '#6a6080' }}>{seen ? m.icon : '⫶'}</span>
              </KindFrame>
              {seen ? (
                <div style={{ flex: 1 }}>
                  <div className="f-head" style={{ fontSize: 13, color: '#f3f0ff' }}>{m.name}</div>
                  <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.24em', color: RARITY_COLORS[m.rarity] ?? accent }}>
                    {m.rarity}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1 }}><LockedTitle /></div>
              )}
            </div>
            {seen && (
              <div style={{ fontSize: 11, color: '#dcd4ff', marginTop: 6, lineHeight: 1.4 }}>{m.desc}</div>
            )}
          </Cell>
        );
      })}
    </>
  );
}

function VoucherGrid({ discovered }: { discovered: string[] }) {
  return (
    <>
      {VOUCHERS.map((v) => {
        const seen = discovered.includes(v.id);
        const accent = RARITY_COLORS[v.rarity];
        return (
          <Cell key={v.id} locked={!seen} accent={accent}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KindFrame kind="voucher" rarity={seen ? v.rarity : null} size={32}>
                <span style={{ color: seen ? '#f5c451' : '#6a6080' }}>◆</span>
              </KindFrame>
              {seen ? (
                <div style={{ flex: 1 }}>
                  <div className="f-head" style={{ fontSize: 13, color: '#f3f0ff' }}>{v.name}</div>
                  <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.24em', color: accent }}>
                    {v.rarity}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1 }}><LockedTitle /></div>
              )}
            </div>
            {seen && (
              <div style={{ fontSize: 11, color: '#dcd4ff', marginTop: 6, lineHeight: 1.4 }}>{v.description}</div>
            )}
          </Cell>
        );
      })}
    </>
  );
}

function ConsumableGrid({ discovered }: { discovered: string[] }) {
  return (
    <>
      {CONSUMABLES.map((c) => {
        const seen = discovered.includes(c.id);
        const tint = c.type === 'galaxy' ? '#cc88ff'
          : c.type === 'spectral' ? '#ff7adf'
          : c.type === 'maneuver' ? '#7be3ff'
          : '#bba8ff';
        return (
          <Cell key={c.id} locked={!seen} accent={tint}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KindFrame kind="consumable" rarity={seen ? consumableRarity(c.type) : null} size={32}>
                <span style={{ color: seen ? tint : '#6a6080' }}>{seen ? (c.icon ?? '◇') : '◇'}</span>
              </KindFrame>
              {seen ? (
                <div style={{ flex: 1 }}>
                  <div className="f-head" style={{ fontSize: 13, color: '#f3f0ff' }}>{c.name}</div>
                  <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.24em', color: tint }}>
                    {c.type}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1 }}><LockedTitle /></div>
              )}
            </div>
            {seen && (
              <div style={{ fontSize: 11, color: '#dcd4ff', marginTop: 6, lineHeight: 1.4 }}>{c.description}</div>
            )}
          </Cell>
        );
      })}
    </>
  );
}

function ConstellationGrid({ stakeProgress }: { stakeProgress: Record<string, string> }) {
  return (
    <>
      {CONSTELLATIONS.map((c) => {
        const cleared = stakeProgress[c.id];
        const stakeIdx = cleared ? stakeIndex(cleared) : -1;
        return (
          <Cell key={c.id} accent="#7be3ff">
            <div className="f-head" style={{ fontSize: 14, color: '#f3f0ff' }}>{c.name}</div>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.18em', color: '#f5c451', marginTop: 4 }}>
              {describeDiceSpec(c.dice)}
            </div>
            <div style={{ fontSize: 11, color: '#bba8ff', marginTop: 6, fontStyle: 'italic', lineHeight: 1.3 }}>{c.flavor}</div>
            <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
              {STAKES.map((s, i) => (
                <span key={s.id} title={`${s.name}${i <= stakeIdx ? ' — cleared' : ''}`} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: i <= stakeIdx ? s.color : 'transparent',
                  border: `1px solid ${i <= stakeIdx ? s.color : 'rgba(149,119,255,0.3)'}`,
                  filter: i <= stakeIdx ? `drop-shadow(0 0 4px ${s.color})` : undefined,
                }} />
              ))}
            </div>
          </Cell>
        );
      })}
    </>
  );
}

function BossGrid({ discovered }: { discovered: string[] }) {
  return (
    <>
      {BOSS_BLINDS.map((b) => {
        const seen = discovered.includes(b.id);
        return (
          <Cell key={b.id} locked={!seen} accent={b.color}>
            {seen ? (
              <>
                <div className="f-head" style={{ fontSize: 14, color: b.color }}>{b.name}</div>
                <div style={{ fontSize: 11, color: '#dcd4ff', marginTop: 6, lineHeight: 1.4, fontStyle: 'italic' }}>
                  "{b.description}"
                </div>
              </>
            ) : (
              <LockedTitle />
            )}
          </Cell>
        );
      })}
    </>
  );
}

function AchievementsView({ unlocked }: { unlocked: string[] }) {
  const unlockedSet = new Set(unlocked);
  const totalUnlocked = unlocked.length;
  const totalCount = ACHIEVEMENTS.length;
  return (
    <div style={{ marginBottom: 24 }}>
      {/* Header summary — at-a-glance progress for the player. */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 16, padding: '8px 14px',
        borderRadius: 8,
        background: 'rgba(15,9,37,0.6)',
        border: '1px solid rgba(245,196,81,0.3)',
      }}>
        <div className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.32em', color: '#bba8ff' }}>
          ascensions cleared
        </div>
        <div className="f-display num" style={{ fontSize: 20, color: '#f5c451' }}>
          {totalUnlocked} <span style={{ fontSize: 12, color: '#bba8ff' }}>/ {totalCount}</span>
        </div>
      </div>
      {ACHIEVEMENT_CATEGORIES.map((category) => {
        const inCategory = ACHIEVEMENTS.filter((a) => a.category === category.id);
        if (inCategory.length === 0) return null;
        const earnedHere = inCategory.filter((a) => unlockedSet.has(a.id)).length;
        return (
          <div key={category.id} style={{ marginBottom: 18 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <div className="f-mono uc" style={{
                fontSize: 10, letterSpacing: '0.32em', color: '#7be3ff',
              }}>
                ◇ {category.label}
              </div>
              <div className="f-mono num" style={{ fontSize: 10, color: '#bba8ff' }}>
                {earnedHere} / {inCategory.length}
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 8,
            }}>
              {inCategory.map((a) => {
                const isUnlocked = unlockedSet.has(a.id);
                // Hidden achievements stay opaque until earned: name and
                // description are masked. Once unlocked, they reveal in
                // full so the player gets the spoilery payoff.
                const showDetails = isUnlocked || !a.hidden;
                return (
                  <div key={a.id} className="panel" style={{
                    padding: 10, borderRadius: 8,
                    border: `1px solid ${isUnlocked ? '#f5c45166' : 'rgba(149,119,255,0.18)'}`,
                    background: isUnlocked ? 'rgba(35,28,12,0.55)' : 'rgba(15,9,37,0.5)',
                    opacity: isUnlocked ? 1 : 0.66,
                    minHeight: 64,
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      gap: 8,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="f-head" style={{
                          fontSize: 13,
                          color: isUnlocked ? '#f5c451' : '#bba8ff',
                          letterSpacing: '0.04em',
                        }}>
                          {showDetails ? a.name : '???'}
                        </div>
                        <div style={{
                          fontSize: 11, color: '#dcd4ff', marginTop: 4, lineHeight: 1.35,
                          opacity: showDetails ? 0.9 : 0.5,
                        }}>
                          {showDetails ? a.description : 'A hidden ascension. Find it the hard way.'}
                        </div>
                      </div>
                      <div className="f-mono uc" style={{
                        flexShrink: 0,
                        fontSize: 9, letterSpacing: '0.18em',
                        padding: '2px 6px', borderRadius: 4,
                        color: isUnlocked ? '#f5c451' : '#7a6fa6',
                        border: `1px solid ${isUnlocked ? '#f5c45188' : 'rgba(122,111,166,0.4)'}`,
                        background: 'rgba(15,9,37,0.7)',
                        whiteSpace: 'nowrap',
                      }}>
                        {isUnlocked ? '✓' : '◇'} {a.dust}◆
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
