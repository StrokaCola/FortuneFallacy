import { useStore, type GameState } from '../../state/store';
import { lookupCatalyst } from '../../data/catalysts';
import { lookupVoucher } from '../../data/vouchers';
import { lookupMod } from '../../core/mods';
import { lookupConsumable } from '../../core/consumables';
import { lookupConstellation } from '../../data/constellations';
import { editionColor, editionLabel } from '../../core/upgrades/editions';
import { BLIND_DEFS, BOSS_BLINDS } from '../../data/blinds';

// Read-only deep view of the active run. Pulls everything off the store and
// renders it in compact rows so the player can audit their build mid-run.

const sel = {
  ante: (s: GameState) => s.run.ante,
  goalIdx: (s: GameState) => s.run.goalIdx,
  shards: (s: GameState) => s.run.shards,
  handsPlayed: (s: GameState) => s.run.handsPlayed,
  catalysts: (s: GameState) => s.run.catalysts,
  catalystEditions: (s: GameState) => s.run.catalystEditions,
  vouchers: (s: GameState) => s.run.vouchers,
  consumables: (s: GameState) => s.run.consumables,
  diceMods: (s: GameState) => s.run.diceMods,
  diceModEditions: (s: GameState) => s.run.diceModEditions,
  comboLevels: (s: GameState) => s.run.comboLevels,
  constellationId: (s: GameState) => s.run.constellationId,
  blindId: (s: GameState) => s.round.blindId,
  isBoss: (s: GameState) => s.round.isBoss,
  target: (s: GameState) => s.round.target,
  score: (s: GameState) => s.round.score,
  catalystShardSpend: (s: GameState) => s.run.catalystShardSpend,
};

const labelStyle = { fontSize: 9, letterSpacing: '0.28em', color: '#bba8ff' } as const;
const headStyle = { fontSize: 11, letterSpacing: '0.32em', color: '#7be3ff' } as const;
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 } as const;

const COMBO_DISPLAY: Record<string, string> = {
  chance: 'Chance',
  one_pair: 'One Pair',
  two_pair: 'Two Pair',
  three_kind: 'Three of a Kind',
  sm_straight: 'Small Straight',
  full_house: 'Full House',
  lg_straight: 'Large Straight',
  four_kind: 'Four of a Kind',
  five_kind: 'Five of a Kind',
};

export function RunInfoPanel() {
  const ante = useStore(sel.ante);
  const goalIdx = useStore(sel.goalIdx);
  const shards = useStore(sel.shards);
  const handsPlayed = useStore(sel.handsPlayed);
  const catalysts = useStore(sel.catalysts);
  const catalystEditions = useStore(sel.catalystEditions);
  const vouchers = useStore(sel.vouchers);
  const consumables = useStore(sel.consumables);
  const diceMods = useStore(sel.diceMods);
  const diceModEditions = useStore(sel.diceModEditions);
  const comboLevels = useStore(sel.comboLevels);
  const constellationId = useStore(sel.constellationId);
  const blindId = useStore(sel.blindId);
  const isBoss = useStore(sel.isBoss);
  const target = useStore(sel.target);
  const score = useStore(sel.score);
  const catalystShardSpend = useStore(sel.catalystShardSpend);

  const constellation = lookupConstellation(constellationId);
  const blindIdx = goalIdx % 3;
  const blindName = BLIND_DEFS[blindIdx]?.name ?? '—';
  const bossDef = isBoss ? BOSS_BLINDS.find((b) => b.id === blindId) : null;

  const totalDiceModSlots = diceMods.reduce((n, ms) => n + ms.length, 0);

  return (
    <div style={{
      width: '100%', display: 'flex', flexDirection: 'column', gap: 14,
      maxHeight: 480, overflowY: 'auto', paddingRight: 4,
      // Bottom fade-mask hints there's more content when the list scrolls.
      maskImage: 'linear-gradient(to bottom, black calc(100% - 24px), transparent)',
      WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 24px), transparent)',
    }}>
      {/* Header — constellation + ante + blind + economy. Each
          stat block gains the .ff-panel-framed gold corner trim so
          the pause menu reads as a "cosmic ID card" — separate
          inscribed plaques rather than dark rectangles. */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="mat-obsidian ff-panel-framed" style={{ padding: 10, borderRadius: 8 }}>
          <div className="f-mono uc" style={labelStyle}>constellation</div>
          <div className="f-display" style={{ fontSize: 16, color: '#f3f0ff', marginTop: 4 }}>{constellation.name}</div>
          <div className="f-mono" style={{ fontSize: 10, color: '#bba8ff', marginTop: 2, lineHeight: 1.3 }}>
            {constellation.flavor ?? '—'}
          </div>
        </div>
        <div className="mat-obsidian ff-panel-framed" style={{ padding: 10, borderRadius: 8 }}>
          <div className="f-mono uc" style={labelStyle}>progress</div>
          <div style={{ ...rowStyle, marginTop: 4 }}>
            <span className="f-mono" style={{ fontSize: 11, color: '#dcd4ff' }}>ante</span>
            <span className="f-mono num ff-number-plate" style={{ fontSize: 14, color: '#f5c451' }}>{ante}</span>
          </div>
          <div style={rowStyle}>
            <span className="f-mono" style={{ fontSize: 11, color: '#dcd4ff' }}>blind</span>
            <span className="f-mono" style={{ fontSize: 11, color: isBoss ? '#ff8e9c' : '#7be3ff' }}>
              {bossDef ? bossDef.name : blindName}
            </span>
          </div>
          <div style={rowStyle}>
            <span className="f-mono" style={{ fontSize: 11, color: '#dcd4ff' }}>score</span>
            <span className="f-mono num" style={{ fontSize: 12, color: '#7be3ff' }}>
              {score.toLocaleString()} / {target.toLocaleString()}
            </span>
          </div>
        </div>
      </section>

      {/* Economy row */}
      <section className="mat-obsidian ff-panel-framed" style={{ padding: 10, borderRadius: 8 }}>
        <div className="f-mono uc" style={labelStyle}>treasury</div>
        <div style={{ ...rowStyle, marginTop: 4 }}>
          <span className="f-mono" style={{ fontSize: 11, color: '#dcd4ff' }}>shards on hand</span>
          <span className="f-mono num ff-number-plate" style={{ fontSize: 14, color: '#f5c451' }}>◆ {shards}</span>
        </div>
        <div style={rowStyle}>
          <span className="f-mono" style={{ fontSize: 11, color: '#dcd4ff' }}>spent on catalysts</span>
          <span className="f-mono num" style={{ fontSize: 12, color: '#bba8ff' }}>◆ {catalystShardSpend}</span>
        </div>
        <div style={rowStyle}>
          <span className="f-mono" style={{ fontSize: 11, color: '#dcd4ff' }}>hands played</span>
          <span className="f-mono num" style={{ fontSize: 12, color: '#bba8ff' }}>{handsPlayed}</span>
        </div>
      </section>

      {/* Catalysts */}
      <section>
        <div className="f-mono uc" style={headStyle}>◈ catalysts ({catalysts.length})</div>
        {catalysts.length === 0 ? (
          <div className="f-mono" style={{ fontSize: 11, color: '#6a6080', marginTop: 6, fontStyle: 'italic' }}>
            none acquired
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {catalysts.map((id, i) => {
              const c = lookupCatalyst(id);
              if (!c) return null;
              const ed = catalystEditions[id];
              const eC = ed ? editionColor(ed) : null;
              return (
                <div key={`${id}-${i}`} className="panel-row" style={{
                  display: 'flex', flexDirection: 'column', gap: 2,
                  padding: '6px 8px',
                  // Override the panel-row default border with the
                  // catalyst's accent so each row colour-codes by id.
                  borderColor: `${c.color}55`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, color: c.color, width: 22, textAlign: 'center' }}>{c.icon}</span>
                    <span className="f-head" style={{ fontSize: 12, color: '#f3f0ff', flex: 1 }}>
                      {c.name}
                    </span>
                    {ed && eC && (
                      <span className="f-mono uc" style={{
                        fontSize: 8, padding: '1px 5px', borderRadius: 3,
                        color: eC, border: `1px solid ${eC}88`, background: `${eC}22`,
                      }}>
                        {editionLabel(ed).slice(0, 4).toLowerCase()}
                      </span>
                    )}
                    <span className="f-mono uc" style={{ fontSize: 8, color: '#9577ff' }}>
                      {c.rarity}
                    </span>
                  </div>
                  {c.desc && (
                    <div style={{ fontSize: 10, color: '#bba8ff', lineHeight: 1.4, paddingLeft: 30 }}>
                      {c.desc}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Vouchers */}
      <section>
        <div className="f-mono uc" style={headStyle}>◈ vouchers ({vouchers.length})</div>
        {vouchers.length === 0 ? (
          <div className="f-mono" style={{ fontSize: 11, color: '#6a6080', marginTop: 6, fontStyle: 'italic' }}>
            none claimed
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {vouchers.map((id, i) => {
              const v = lookupVoucher(id);
              return (
                <span key={`${id}-${i}`} className="f-mono uc" style={{
                  fontSize: 9, padding: '4px 8px', borderRadius: 4,
                  color: '#f5c451', border: '1px solid #f5c45166', background: 'rgba(245,196,81,0.1)',
                }}>
                  {v?.name ?? id}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* Consumables */}
      <section>
        <div className="f-mono uc" style={headStyle}>◈ consumables ({consumables.length})</div>
        {consumables.length === 0 ? (
          <div className="f-mono" style={{ fontSize: 11, color: '#6a6080', marginTop: 6, fontStyle: 'italic' }}>
            tray empty
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {consumables.map((id, i) => {
              const c = lookupConsumable(id);
              return (
                <span key={`${id}-${i}`} className="f-mono uc has-tip" style={{
                  fontSize: 9, padding: '4px 8px', borderRadius: 4,
                  color: '#7be3ff', border: '1px solid #7be3ff66', background: 'rgba(123,227,255,0.08)',
                  position: 'relative', cursor: 'help',
                }}>
                  {c?.icon ?? '◇'} {c?.name ?? id}
                  {c?.description && (
                    <span className="tip tip-above" style={{ textTransform: 'none', textAlign: 'left', maxWidth: 240 }}>
                      <span className="tip-title">{c.name}</span>
                      {c.description}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* Dice + mods */}
      <section>
        <div className="f-mono uc" style={headStyle}>◈ dice mods ({totalDiceModSlots})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {diceMods.map((mods, i) => {
            const eds = diceModEditions[i] ?? [];
            return (
              <div key={i} className="panel-row" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px',
                // Slightly dimmer than panel-row's default — dice mod
                // rows are dense and shouldn't compete with the
                // catalyst roster above.
                background: 'rgba(15,9,37,0.5)',
                borderColor: 'rgba(149,119,255,0.18)',
              }}>
                <span className="f-mono uc" style={{ fontSize: 9, color: '#9577ff', width: 32 }}>
                  d{i + 1}
                </span>
                {mods.length === 0 ? (
                  <span className="f-mono" style={{ fontSize: 10, color: '#6a6080', fontStyle: 'italic' }}>—</span>
                ) : (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {mods.map((mid, j) => {
                      const m = lookupMod(mid);
                      const ed = eds[j];
                      const eC = ed ? editionColor(ed) : null;
                      const accent = m?.visual?.accentColor ?? '#bba8ff';
                      return (
                        <span key={j} className="f-mono uc has-tip" style={{
                          fontSize: 9, padding: '2px 6px', borderRadius: 3,
                          color: accent, border: `1px solid ${accent}66`, background: `${accent}14`,
                          position: 'relative', cursor: 'help',
                        }}>
                          {m?.icon ?? '⫶'} {m?.name ?? mid}
                          {eC && <span style={{ marginLeft: 4, color: eC }}>·{editionLabel(ed!).slice(0, 2).toLowerCase()}</span>}
                          {m?.desc && (
                            <span className="tip tip-above" style={{ textTransform: 'none', textAlign: 'left', maxWidth: 240 }}>
                              <span className="tip-title">{m.name}</span>
                              {m.desc}
                              {ed && <span style={{ display: 'block', marginTop: 4, color: eC ?? '#bba8ff', fontSize: 9 }}>edition: {editionLabel(ed)}</span>}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Hand levels */}
      <section>
        <div className="f-mono uc" style={headStyle}>◈ hand levels</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
          {Object.entries(comboLevels).map(([k, lvl]) => (
            <div key={k} style={{
              ...rowStyle,
              padding: '3px 8px', borderRadius: 4,
              background: lvl > 0 ? 'rgba(123,227,255,0.08)' : 'rgba(15,9,37,0.4)',
              border: `1px solid ${lvl > 0 ? '#7be3ff44' : 'rgba(149,119,255,0.12)'}`,
            }}>
              <span className="f-mono" style={{ fontSize: 10, color: lvl > 0 ? '#dcd4ff' : '#6a6080' }}>
                {COMBO_DISPLAY[k] ?? k}
              </span>
              <span className="f-mono num" style={{ fontSize: 11, color: lvl > 0 ? '#7be3ff' : '#6a6080' }}>
                lv{lvl}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
