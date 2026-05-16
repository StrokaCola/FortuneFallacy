import { useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { ScreenHeader, ScreenWatermark } from '../visual/AstralPrimitives';
import { Sigil } from '../visual/Sigil';
import { useStore, type GameState } from '../../state/store';
import { CATALYST_META } from '../../data/catalysts';
import { MODS } from '../../core/mods';
import { VOUCHERS } from '../../data/vouchers';
import { CONSTELLATIONS } from '../../data/constellations';
import { BOSS_BLINDS } from '../../data/blinds';
import { CONSUMABLES, consumableRarity } from '../../core/consumables';
import { RESONANCES } from '../../data/resonances';
import { describeDiceSpec } from '../../data/dice';
import { STAKES, stakeIndex } from '../../data/stakes';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../../data/achievements';
import { KindFrame } from '../visual/upgradeKindFrames';
import { CatalystIcon } from '../visual/CatalystIcon';
import { RARITY_COLORS } from '../visual/rarityStyles';

type Tab = 'catalysts' | 'mods' | 'vouchers' | 'consumables' | 'constellations' | 'bosses' | 'resonances' | 'achievements' | 'secrets' | 'about';

const TABS: { id: Tab; label: string }[] = [
  { id: 'catalysts', label: 'Catalysts' },
  { id: 'mods', label: 'Mods' },
  { id: 'vouchers', label: 'Vouchers' },
  { id: 'consumables', label: 'Consumables' },
  { id: 'constellations', label: 'Constellations' },
  { id: 'bosses', label: 'Bosses' },
  { id: 'resonances', label: 'Resonances' },
  { id: 'achievements', label: 'Ascensions' },
  { id: 'secrets', label: 'Whispers' },
  { id: 'about', label: 'About' },
];

const selectDiscovered = (s: GameState) => s.meta.discovered;
const selectStakeProgress = (s: GameState) => s.meta.stakeProgress;
const EMPTY_ACHIEVEMENTS = { unlocked: [] as string[], unlockedAt: {} as Record<string, number> };
const selectAchievements = (s: GameState) => s.meta.achievements ?? EMPTY_ACHIEVEMENTS;
const EMPTY_EGGS: string[] = [];
const selectEasterEggs = (s: GameState) => s.meta.easterEggs ?? EMPTY_EGGS;

// RARITY_COLORS now lives in app/visual/rarityStyles.ts (shared with Shop).

export function Codex() {
  const [tab, setTab] = useState<Tab>('catalysts');
  const discovered = useStore(selectDiscovered);
  const stakeProgress = useStore(selectStakeProgress);
  const achievements = useStore(selectAchievements);
  const easterEggs = useStore(selectEasterEggs);

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'auto',
      overflow: 'auto', padding: '32px 24px',
    }}>
      <ScreenWatermark color="#cc88ff" position="bottom-right">
        <Sigil kind="priestess" size={220} color="#cc88ff" />
      </ScreenWatermark>
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <ScreenHeader title="Codex" subtitle="◇ catalogue ◇" />
          <div className="f-mono" style={{ fontSize: 11, color: '#bba8ff', marginTop: 4, opacity: 0.85 }}>
            Items you've encountered. The unseen are silhouetted.
          </div>
        </div>

        {/* Tab row: with 10 tabs the wrap into 2-3 rows on narrow
            phones eats vertical space. Use the shared .scroll-x-fade
            utility so the right-edge fade telegraphs off-screen tabs. */}
        <div className="scroll-x-fade" style={{
          display: 'flex', gap: 6,
          justifyContent: 'flex-start',
          marginBottom: 18,
        }}>
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
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'achievements' ? (
          <AchievementsView unlocked={achievements.unlocked} />
        ) : tab === 'secrets' ? (
          <SecretsView found={easterEggs} />
        ) : tab === 'about' ? (
          <AboutView />
        ) : (
          <>
            <CodexProgressHeader tab={tab} discovered={discovered} stakeProgress={stakeProgress} />
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
              {tab === 'resonances' && (
                <ResonanceGrid discovered={discovered.resonances ?? []} />
              )}
            </div>
          </>
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

// Per-tab progress strip — "X / Y discovered" with a colored bar.
// Drives the codex completion rewards: tooltip on hover lists the
// matching achievement(s) so the player sees the dust payoff for
// finishing the set. Constellations tab shows highest-stake-cleared
// counts instead of discovery (the table doesn't track discovery for
// that kind, since constellations are picked at run start).
function CodexProgressHeader({
  tab,
  discovered,
  stakeProgress,
}: {
  tab: Tab;
  discovered: GameState['meta']['discovered'];
  stakeProgress: GameState['meta']['stakeProgress'];
}) {
  let label: string;
  let count: number;
  let total: number;
  switch (tab) {
    case 'catalysts':
      label = 'catalysts'; count = discovered.catalysts.length; total = CATALYST_META.length; break;
    case 'mods':
      label = 'mods'; count = discovered.mods.length; total = MODS.length; break;
    case 'vouchers':
      label = 'vouchers'; count = discovered.vouchers.length; total = VOUCHERS.length; break;
    case 'consumables':
      label = 'consumables'; count = discovered.consumables.length; total = CONSUMABLES.length; break;
    case 'bosses':
      label = 'bosses'; count = discovered.bosses.length; total = BOSS_BLINDS.length; break;
    case 'resonances':
      label = 'resonances';
      count = (discovered.resonances ?? []).length;
      total = RESONANCES.length;
      break;
    case 'constellations':
      label = 'constellations cleared';
      count = Object.keys(stakeProgress).length;
      total = CONSTELLATIONS.length;
      break;
    default:
      return null;
  }
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const isFull = count >= total;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '8px 14px', borderRadius: 8,
      background: 'rgba(15,9,37,0.6)',
      border: `1px solid ${isFull ? '#f5c45166' : 'rgba(123,227,255,0.2)'}`,
      marginBottom: 14,
    }}>
      <div className="f-mono uc" style={{
        fontSize: 10, letterSpacing: '0.32em',
        color: isFull ? '#f5c451' : '#bba8ff',
        flexShrink: 0,
      }}>
        ◇ {label}
      </div>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: isFull ? 'linear-gradient(90deg, #f5c451, #ff7847)' : 'linear-gradient(90deg, #7be3ff, #cc88ff)',
          boxShadow: isFull ? '0 0 12px rgba(245,196,81,0.6)' : '0 0 8px rgba(123,227,255,0.45)',
          transition: 'width 400ms ease-out',
        }} />
      </div>
      <div className="f-mono num" style={{
        fontSize: 12, color: isFull ? '#f5c451' : '#f3f0ff',
        fontWeight: 700, flexShrink: 0,
      }}>
        {count} / {total}
      </div>
    </div>
  );
}

function Cell({
  children, locked = false, accent = '#7be3ff', tipTitle, tipBody,
}: {
  children: React.ReactNode;
  locked?: boolean;
  accent?: string;
  /** Optional tooltip title (typically the kind label or unlock prerequisite). */
  tipTitle?: string;
  /** Optional tooltip body — shown on hover. Wave JJ surfaces unlock
   * hints for locked codex entries so the ???-card has an answer. */
  tipBody?: string;
}) {
  const hasTip = !!(tipTitle || tipBody);
  return (
    <div
      className={`panel${hasTip ? ' has-tip' : ''}`}
      style={{
        padding: 12, borderRadius: 10,
        border: `1px solid ${locked ? 'rgba(149,119,255,0.18)' : `${accent}55`}`,
        background: locked ? 'rgba(15,9,37,0.55)' : 'rgba(15,9,37,0.7)',
        filter: locked ? 'grayscale(0.85)' : undefined,
        opacity: locked ? 0.55 : 1,
        minHeight: 110,
        position: 'relative',
        cursor: hasTip ? 'help' : undefined,
      }}>
      {children}
      {hasTip && (
        <span className="tip" style={{ maxWidth: 240, textAlign: 'left' }}>
          {tipTitle && <span className="tip-title">{tipTitle}</span>}
          {tipBody}
        </span>
      )}
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
          <Cell
            key={c.id}
            locked={!seen}
            accent={accent}
            tipTitle={seen ? undefined : 'Catalyst · undiscovered'}
            tipBody={seen ? undefined : 'Encounter this catalyst at the Bazaar in a run to reveal its name, effect, and flavor here.'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KindFrame kind="catalyst" rarity={seen ? c.rarity : null} size={32}>
                {seen ? (
                  <CatalystIcon
                    catalystId={c.id}
                    fallbackChar={c.icon}
                    color={c.color}
                    size={20}
                  />
                ) : (
                  <span style={{ color: '#6a6080' }}>◇</span>
                )}
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
        // Banish-face family badge (2026-05-13) — surface the
        // category at-a-glance so synergy-hunters can spot the
        // tribe in the Codex.
        const isBanish = !!(m.banishFaces || m.banishFaceResolver);
        return (
          <Cell
            key={m.id}
            locked={!seen}
            accent={accent}
            tipTitle={seen ? undefined : 'Mod · undiscovered'}
            tipBody={seen ? undefined : 'Encounter this mod (drops as a Bazaar offer or pack reward) to reveal its name, effect, and flavor here.'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KindFrame kind="mod" rarity={seen ? m.rarity : null} size={32}>
                <span style={{ color: seen ? accent : '#6a6080' }}>{seen ? m.icon : '⫶'}</span>
              </KindFrame>
              {seen ? (
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="f-head" style={{ fontSize: 13, color: '#f3f0ff' }}>{m.name}</div>
                    {isBanish && (
                      <span className="f-mono uc" style={{
                        fontSize: 8, letterSpacing: '0.2em',
                        padding: '1px 5px', borderRadius: 4,
                        color: '#cc88ff',
                        border: '1px solid rgba(204,136,255,0.45)',
                        background: 'rgba(15,9,37,0.7)',
                      }}>
                        ✥ banish
                      </span>
                    )}
                  </div>
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
          <Cell
            key={v.id}
            locked={!seen}
            accent={accent}
            tipTitle={seen ? undefined : 'Voucher · undiscovered'}
            tipBody={seen ? undefined : 'Buy this voucher at the Bazaar in a run to reveal its name and permanent perk here.'}
          >
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
          <Cell
            key={c.id}
            locked={!seen}
            accent={tint}
            tipTitle={seen ? undefined : 'Consumable · undiscovered'}
            tipBody={seen ? undefined : 'Open a pack containing this consumable, or buy it directly, to reveal its name and effect here.'}
          >
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

function ResonanceGrid({ discovered }: { discovered: string[] }) {
  // Locked: the resonance hasn't fired yet. We still show the pair's
  // halves (the two catalyst ids) and a "??? — fires when both are owned"
  // teaser, so players can chase the discovery. Once fired, the name +
  // flavor + effect reveal in full.
  return (
    <>
      {RESONANCES.map((r) => {
        const seen = discovered.includes(r.id);
        const accent = '#7be3ff';
        const effectStr =
          r.effect.kind === 'chips' ? `+${r.effect.value} chips`
          : r.effect.kind === 'mult' ? `+${r.effect.value} mult`
          : `+${r.effect.chips} chips, +${r.effect.mult} mult`;
        const a = CATALYST_META.find((c) => c.id === r.a);
        const b = CATALYST_META.find((c) => c.id === r.b);
        return (
          <Cell key={r.id} locked={!seen} accent={accent}>
            {seen ? (
              <>
                <div className="f-head" style={{ fontSize: 14, color: '#f3f0ff', letterSpacing: '0.04em' }}>
                  {r.name}
                </div>
                <div className="f-mono uc" style={{
                  fontSize: 9, letterSpacing: '0.24em', color: accent, marginTop: 4,
                }}>
                  ✦ resonance · {effectStr}
                </div>
                <div style={{ fontSize: 11, color: '#bba8ff', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
                  "{r.flavor}"
                </div>
                <div style={{ fontSize: 10, color: '#dcd4ff', marginTop: 6 }}>
                  {a?.name ?? r.a} + {b?.name ?? r.b}
                </div>
              </>
            ) : (
              <>
                <LockedTitle />
                <div style={{ fontSize: 11, color: '#7a6fa6', marginTop: 6 }}>
                  fires when an owned catalyst pair sings in tune
                </div>
              </>
            )}
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
  // Full state read because progressive achievements compute their
  // current/target via the predicate authored in data/achievements.ts —
  // each predicate reads arbitrary slices (meta.cosmicDustLifetime,
  // meta.discovered, run.runStats, etc.) so narrowing the selector
  // statically isn't possible. The cost is bounded by mount lifetime:
  // AchievementsView only renders when `screen === 'codex'`, which is
  // a meta-review screen the player can't be on during a Round, so the
  // per-tick re-render churn never lands during gameplay.
  const state = useStore((s) => s);
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
                // Progressive achievements (codex_25, daily_streak_7,
                // score_25k, etc.) report a numeric current/target
                // through their .progress() predicate. We only render
                // the bar when the achievement has progress data AND
                // hasn't been unlocked yet (post-unlock the bar is just
                // noise — the ✓ already says it's done).
                const progress = !isUnlocked && a.progress ? a.progress(state) : null;
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
                    {progress && progress.target > 0 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginTop: 8,
                      }}>
                        <div style={{
                          flex: 1,
                          height: 4,
                          background: 'rgba(255,255,255,0.06)',
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${Math.min(100, (progress.current / progress.target) * 100)}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #7be3ff, #cc88ff)',
                            transition: 'width 400ms ease-out',
                          }} />
                        </div>
                        <span className="f-mono num" style={{
                          fontSize: 9, color: '#bba8ff', flexShrink: 0,
                        }}>
                          {progress.current.toLocaleString()} / {progress.target.toLocaleString()}
                        </span>
                      </div>
                    )}
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

// ─── Whispers — hand-authored easter egg index ─────────────────────────
// Pre-discovery: shows the hint only (silhouette title, locked icon).
// Post-discovery: reveals the name + full mechanical description.
// The hint is always visible — that's the point. The unfound egg still
// gives the player something to chew on.
import { EASTER_EGGS } from '../../data/easterEggs';
import pkg from '../../../package.json';

function SecretsView({ found }: { found: string[] }) {
  const foundSet = new Set(found);
  const total = EASTER_EGGS.length;
  const seenCount = EASTER_EGGS.filter((e) => foundSet.has(e.id)).length;
  const pct = total > 0 ? Math.round((seenCount / total) * 100) : 0;
  return (
    <div>
      <div className="f-mono" style={{
        fontSize: 11, color: '#bba8ff', marginBottom: 10, opacity: 0.85,
        textAlign: 'center',
      }}>
        Things half-known. Some you've already done; some are still rumour.
      </div>
      {/* Discovery counter — gives the section a collectible spine
          so a player can SEE they're 2-of-5 instead of guessing how
          deep the rabbit hole goes. Gold tint matches the seen-card
          highlight so the meter and the cards belong to one set. */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        marginBottom: 18,
      }}>
        <div className="f-mono uc" style={{
          fontSize: 10, letterSpacing: '0.32em',
          color: seenCount >= total ? '#f5c451' : '#bba8ff',
          textShadow: seenCount >= total ? '0 0 10px rgba(245,196,81,0.5)' : undefined,
        }}>
          ⋆ whispers heard · {seenCount} / {total}
        </div>
        <div style={{
          width: 'min(360px, 70vw)', height: 4,
          background: 'rgba(149,119,255,0.15)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: '#f5c451',
            boxShadow: '0 0 8px rgba(245,196,81,0.6)',
            transition: 'width 600ms ease-out',
          }} />
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 10,
      }}>
        {EASTER_EGGS.map((e) => {
          const seen = foundSet.has(e.id);
          return (
            <div key={e.id} style={{
              padding: '14px 16px',
              borderRadius: 8,
              background: seen
                ? 'linear-gradient(180deg, rgba(245,196,81,0.10), rgba(28,18,69,0.85))'
                : 'rgba(28,18,69,0.6)',
              border: `1px solid ${seen ? '#f5c45188' : 'rgba(149,119,255,0.3)'}`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <div className="f-mono uc" style={{
                  fontSize: 10, letterSpacing: '0.18em',
                  color: seen ? '#f5c451' : '#7a6ab0',
                }}>
                  {seen ? e.name : '— — —'}
                </div>
                <div style={{
                  fontSize: 18,
                  color: seen ? '#f5c451' : '#3a2f5a',
                  textShadow: seen ? '0 0 8px #f5c45188' : undefined,
                }}>
                  {seen ? e.icon : '?'}
                </div>
              </div>
              <div className="f-mono" style={{
                fontSize: 10, color: '#bba8ff', fontStyle: 'italic', lineHeight: 1.5,
                marginBottom: seen ? 8 : 0,
              }}>
                "{e.hint}"
              </div>
              {seen && (
                <div className="f-mono" style={{
                  fontSize: 10, color: '#dcd4ff', lineHeight: 1.45,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(245,196,81,0.25)',
                }}>
                  {e.revealedDesc}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// About tab — studio/version/credits surface so a curious player has
// somewhere to land for "what is this and where do I follow it?"
function AboutView() {
  const version: string = (pkg as { version: string }).version;
  const labelStyle: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.28em', color: '#bba8ff',
  };
  const valueStyle: React.CSSProperties = {
    fontSize: 13, color: '#f3f0ff', marginTop: 4,
  };
  const sectionStyle: React.CSSProperties = {
    background: 'rgba(28,18,69,0.55)',
    border: '1px solid rgba(149,119,255,0.25)',
    borderRadius: 8,
    padding: '14px 16px',
  };
  return (
    <div style={{
      maxWidth: 720, margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: 14,
      paddingBottom: 24,
    }}>
      <div style={sectionStyle}>
        <div className="f-mono uc" style={labelStyle}>game</div>
        <div className="f-display" style={{ ...valueStyle, fontSize: 24 }}>FortuneFallacy</div>
        <div className="f-mono" style={{ fontSize: 11, color: '#dcd4ff', marginTop: 6, lineHeight: 1.5 }}>
          A Balatro-style dice roguelike. Roll, lock, score; build a deck of
          catalysts and mods that change how the dice answer to you.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <div style={sectionStyle}>
          <div className="f-mono uc" style={labelStyle}>version</div>
          <div className="f-mono" style={valueStyle}>v{version}</div>
        </div>
        <div style={sectionStyle}>
          <div className="f-mono uc" style={labelStyle}>license</div>
          <div className="f-mono" style={valueStyle}>MIT</div>
        </div>
        <div style={sectionStyle}>
          <div className="f-mono uc" style={labelStyle}>status</div>
          <div className="f-mono" style={valueStyle}>Pre-alpha</div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div className="f-mono uc" style={labelStyle}>built with</div>
        <div className="f-mono" style={{ fontSize: 11, color: '#dcd4ff', marginTop: 8, lineHeight: 1.7 }}>
          React · TypeScript · Vite · Three.js · Rapier · PixiJS · Howler · Tone.js · Zustand
        </div>
      </div>

      <div style={sectionStyle}>
        <div className="f-mono uc" style={labelStyle}>privacy</div>
        <div className="f-mono" style={{ fontSize: 11, color: '#dcd4ff', marginTop: 8, lineHeight: 1.6 }}>
          Your save is stored in this browser's localStorage. When you complete
          a run, your name + score are submitted to a public leaderboard
          (no other tracking, no analytics). You can clear local data via
          your browser's site settings.
        </div>
      </div>

      <div style={{ ...sectionStyle, borderColor: 'rgba(245,196,81,0.35)' }}>
        <div className="f-mono uc" style={{ ...labelStyle, color: '#f5c451' }}>thanks</div>
        <div className="f-mono" style={{ fontSize: 11, color: '#dcd4ff', marginTop: 8, lineHeight: 1.6 }}>
          To everyone who playtested, broke things, and told us. The dice are
          better because of you.
        </div>
      </div>
    </div>
  );
}
