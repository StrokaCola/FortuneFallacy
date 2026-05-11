// Unified post-run summary screen, replacing the old skeletal Win/Fail
// screens. Surfaces what made the run feel good (or what fell short) in a
// scannable 4-panel layout, then closes with a "One More Run" carrot
// designed to keep the player one click away from another attempt.
//
//   ┌─────────────────────────────────────────────┐
//   │  VICTORY / NOT ENOUGH (mode-tinted hero)    │
//   │  constellation · ante · run line            │
//   ├─────────────────────────────────────────────┤
//   │  Final score · Target · Shards left         │  Panel 1 (always)
//   │  Peak hand · combo · dust earned this run   │  Panel 2 (if data)
//   │  Top 5 catalysts by chip contribution       │  Panel 3 (if owned)
//   │  Build identity (dominant archetype)        │  Panel 4 (if 3+ owned)
//   ├─────────────────────────────────────────────┤
//   │  ★ One More Run hook (single line)          │
//   │  [Run Again] [Title] [Travel]               │
//   └─────────────────────────────────────────────┘
//
// Both Win and Fail routes render this with a `mode` prop. The mode
// flips the hero color and label; everything below is identical so the
// player always sees their stats — wins celebrate, busts learn from.

import { useEffect } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { lookupConstellation } from '../../data/constellations';
import { lookupCatalyst, CATALYST_META, SCALING_CATALYST_IDS, RETRIGGER_CATALYST_IDS } from '../../data/catalysts';
import { lookupEasterEgg } from '../../data/easterEggs';
import { COMBOS } from '../../core/scoring/combos';
import { triggerShake } from '../visual/screenShake';
import { PortalGate } from '../portal/PortalGate';
import { computeOneMoreRunHook, HOOK_TONE_COLOR } from './postmortem/oneMoreRunHook';

const selectRun = (s: GameState) => s.run;
const selectMeta = (s: GameState) => s.meta;
const selectScore = (s: GameState) => s.round.score;
const selectTarget = (s: GameState) => s.round.target;

const TOP_CATALYSTS = 5;
const ARCHETYPE_LABELS: Record<string, string> = {
  combo: 'COMBO TRIBE',
  face: 'FACE HUNTER',
  economy: 'ECONOMIST',
  scaling: 'INFINITE SCALER',
  mods: 'MOD MAESTRO',
  timing: 'METRONOME',
  utility: 'OPPORTUNIST',
};

export function RunPostmortem({ mode }: { mode: 'win' | 'fail' }) {
  const run = useStore(selectRun);
  const meta = useStore(selectMeta);
  const score = useStore(selectScore);
  const target = useStore(selectTarget);

  const constellation = lookupConstellation(run.constellationId);
  const stats = run.runStats ?? { peakHand: 0, peakCombo: null, catalystChips: {}, dustEarned: 0, catalystFires: {} };
  const hook = computeOneMoreRunHook(meta, run);
  const hookColor = HOOK_TONE_COLOR[hook.tone];

  // Bust gets a chunky shake; win is celebratory and doesn't need it.
  useEffect(() => {
    if (mode === 'fail') triggerShake('big');
  }, [mode]);

  // Enter/Space = Run Again. Wins go to constellation_select; busts do
  // the same. The button row shows the same shape so muscle memory works
  // across both modes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dispatch({ type: 'SET_SCREEN', screen: 'constellation_select' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const heroColor = mode === 'win' ? '#f5c451' : '#ff4d6d';
  const heroLabel = mode === 'win' ? 'VICTORY' : 'NOT ENOUGH';
  const heroSub = mode === 'win'
    ? `all four antes cleared${meta.playerName ? ` · ${meta.playerName}` : ''}`
    : `run ended${meta.playerName ? ` · ${meta.playerName}` : ''} · ante ${run.ante}`;
  const heroShadow = mode === 'win'
    ? '0 0 30px rgba(245,196,81,0.8)'
    : '0 0 36px #ff4d6d, 0 0 80px rgba(255,77,109,0.45)';

  const topCatalysts = Object.entries(stats.catalystChips)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, TOP_CATALYSTS);
  const totalContribution = topCatalysts.reduce((s, [, v]) => s + v, 0);

  // 2026-05-11 polish — three end-of-run callouts for the scaling pack.
  //
  // Scaling lattice: per-catalyst final stack with the effective bonus
  // displayed in the catalyst's own units. Only listed if the player
  // actually owned the catalyst this run (i.e., a stack exists for it).
  const scalingStacks = (run.catalystStacks ?? {}) as Record<string, number>;
  const scalingRows = Object.entries(scalingStacks)
    .filter(([id, n]) => n > 0 && run.catalysts.includes(id))
    .map(([id, n]) => ({ id, stacks: n, label: formatScalingBonus(id, n) }))
    .sort((a, b) => b.stacks - a.stacks);
  // Retrigger echoes: filter catalystFires to retrigger ids the player
  // actually owned. Sum + breakdown.
  const retriggerFires = Object.entries(stats.catalystFires ?? {})
    .filter(([id, n]) => n > 0 && RETRIGGER_CATALYST_IDS.has(id) && run.catalysts.includes(id))
    .sort(([, a], [, b]) => b - a);
  const retriggerTotal = retriggerFires.reduce((s, [, v]) => s + v, 0);
  // Whispers heard this run: meta.easterEggs holds the persistent set;
  // we can't distinguish "found in this run" without extra plumbing.
  // Per plan we list ALL discovered eggs — players who found one this
  // run see the same banner as those who found nothing new (the banner
  // is content-aware: a run with zero owned won't show the panel).
  const whispersThisRun = (meta.easterEggs ?? [])
    .map((id) => lookupEasterEgg(id))
    .filter((e): e is NonNullable<typeof e> => e != null);

  const buildIdentity = computeBuildIdentity(run.catalysts);
  const peakComboName = stats.peakCombo
    ? COMBOS.find((c) => c.id === stats.peakCombo)?.name ?? stats.peakCombo
    : null;

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      pointerEvents: 'auto',
      background: mode === 'win' ? 'rgba(7,5,26,0.85)' : 'rgba(3,2,12,0.92)',
      animation: mode === 'fail' ? 'fadein 800ms ease-out both' : undefined,
      overflowY: 'auto', overflowX: 'hidden', padding: 16,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', maxWidth: 540 }}>

        {mode === 'win' && <ShatterConstellation />}

        <div className="f-display" style={{
          fontSize: 'clamp(36px, 8vw, 56px)',
          color: heroColor,
          letterSpacing: '0.2em',
          textShadow: heroShadow,
          opacity: 0,
          animation: 'fadein 1200ms ease-out 100ms both',
        }}>
          {heroLabel}
        </div>
        <div className="f-mono uc" style={{
          fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em',
          opacity: 0, animation: 'fadein 800ms ease-out 600ms both',
        }}>
          {heroSub}
        </div>
        <div className="f-mono uc" style={{
          fontSize: 9, color: '#f5c451', letterSpacing: '0.3em',
          opacity: 0, animation: 'fadein 800ms ease-out 700ms both',
        }}>
          ✦ {constellation.name}
        </div>

        {/* Panel 1 — final score / target / shards. */}
        <div className="mat-obsidian" style={{
          padding: '14px 26px', borderRadius: 12, marginTop: 10,
          display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center',
          opacity: 0, animation: 'fadein 800ms ease-out 800ms both',
        }}>
          <Stat color={heroColor} label="final score" value={score.toLocaleString()} />
          {mode === 'fail' && (
            <Stat color="#7be3ff" label="target" value={target.toLocaleString()} />
          )}
          <Stat color="#f5c451" label="shards" value={`◆ ${run.shards}`} />
          <Stat color="#cc88ff" label="dust earned" value={`+${stats.dustEarned}`} />
        </div>

        {/* Panel 2 — peak hand callout. Shown when stats actually have a
            peak; first-roll busts and legacy saves can fall through. */}
        {stats.peakHand > 0 && (
          <div className="mat-obsidian" style={{
            padding: '12px 22px', borderRadius: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            opacity: 0, animation: 'fadein 800ms ease-out 900ms both',
          }}>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff' }}>
              peak hand
            </div>
            <div className="f-display num" style={{ fontSize: 30, color: '#7be3ff' }}>
              {stats.peakHand.toLocaleString()}
            </div>
            {peakComboName && (
              <div className="f-mono" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.08em' }}>
                {peakComboName} · {run.handsPlayed} hands played
              </div>
            )}
          </div>
        )}

        {/* Panel 3 — top catalyst contributors. */}
        {topCatalysts.length > 0 && (
          <div className="mat-obsidian" style={{
            padding: '14px 22px', borderRadius: 10,
            width: '100%', maxWidth: 460,
            opacity: 0, animation: 'fadein 800ms ease-out 1000ms both',
          }}>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff', marginBottom: 8, textAlign: 'center' }}>
              top catalysts
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {topCatalysts.map(([id, chips]) => {
                const c = lookupCatalyst(id);
                if (!c) return null;
                const pct = totalContribution > 0 ? Math.round((chips / totalContribution) * 100) : 0;
                return (
                  <div key={id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      fontSize: 16, color: c.color,
                      filter: `drop-shadow(0 0 4px ${c.color})`,
                      width: 22, textAlign: 'center', flexShrink: 0,
                    }}>{c.icon}</span>
                    <span className="f-mono" style={{
                      fontSize: 11, color: '#f3f0ff', flex: 1, textAlign: 'left',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{c.name}</span>
                    {/* Bar visualizes the share — anchors how much a single
                        catalyst carried the build. */}
                    <span style={{
                      flex: 1, height: 4, background: 'rgba(255,255,255,0.06)',
                      borderRadius: 2, overflow: 'hidden', maxWidth: 120,
                    }}>
                      <span style={{
                        display: 'block',
                        width: `${pct}%`, height: '100%',
                        background: c.color,
                        boxShadow: `0 0 6px ${c.color}`,
                      }} />
                    </span>
                    <span className="f-mono num" style={{
                      fontSize: 11, color: c.color, width: 64, textAlign: 'right', flexShrink: 0,
                    }}>+{chips.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel 3.5 — Scaling Lattice. The accrued permanent stacks for
            every scaling catalyst the player held this run, rendered as
            "Star Chart  +1.25× mult · 5 stacks" rows. Cyan accent because
            scaling-catalyst fires use the cyan/emerald palette during
            the run. */}
        {scalingRows.length > 0 && (
          <div className="mat-obsidian" style={{
            padding: '14px 22px', borderRadius: 10,
            width: '100%', maxWidth: 460,
            opacity: 0, animation: 'fadein 800ms ease-out 1050ms both',
          }}>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#7be3ff', marginBottom: 8, textAlign: 'center' }}>
              compounded over the run
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {scalingRows.map(({ id, stacks, label }) => {
                const c = lookupCatalyst(id);
                if (!c) return null;
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 14, color: c.color,
                      filter: `drop-shadow(0 0 4px ${c.color})`,
                      width: 22, textAlign: 'center', flexShrink: 0,
                    }}>{c.icon}</span>
                    <span className="f-mono" style={{
                      fontSize: 11, color: '#f3f0ff', flex: 1, textAlign: 'left',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{c.name}</span>
                    <span className="f-mono" style={{
                      fontSize: 10, color: '#bba8ff', letterSpacing: '0.06em',
                    }}>{stacks} stacks</span>
                    <span className="f-mono num" style={{
                      fontSize: 11, color: '#5be8a4', width: 92, textAlign: 'right', flexShrink: 0,
                      textShadow: '0 0 8px rgba(91,232,164,0.4)',
                    }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel 3.6 — Retrigger Echoes. Total retrigger fires summed
            across every retrigger catalyst the player held, with a
            per-id breakdown. Lavender accent matches the retrigger
            family's identity colors (Encore, Refrain, etc). */}
        {retriggerFires.length > 0 && (
          <div className="mat-obsidian" style={{
            padding: '14px 22px', borderRadius: 10,
            width: '100%', maxWidth: 460,
            opacity: 0, animation: 'fadein 800ms ease-out 1100ms both',
          }}>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff', marginBottom: 8, textAlign: 'center' }}>
              echoes that landed · {retriggerTotal}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {retriggerFires.map(([id, n]) => {
                const c = lookupCatalyst(id);
                if (!c) return null;
                return (
                  <div key={id} className="f-mono" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 10, color: c.color,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `${c.color}15`,
                    border: `1px solid ${c.color}55`,
                  }}>
                    <span style={{ fontSize: 11, filter: `drop-shadow(0 0 4px ${c.color})` }}>{c.icon}</span>
                    <span>{c.name}</span>
                    <span style={{ color: '#f3f0ff', fontWeight: 700 }}>×{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Whispers banner — shows every easter egg the player has ever
            discovered across runs. Matches the Codex Whispers tab styling
            so the visual identity carries across screens. Gold tint. */}
        {whispersThisRun.length > 0 && (
          <div style={{
            width: '100%', maxWidth: 460,
            padding: '10px 18px', borderRadius: 8,
            background: 'linear-gradient(180deg, rgba(245,196,81,0.10), rgba(28,18,69,0.85))',
            border: '1px solid rgba(245,196,81,0.45)',
            boxShadow: '0 0 18px rgba(245,196,81,0.18)',
            opacity: 0, animation: 'fadein 800ms ease-out 1150ms both',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <div className="f-mono uc" style={{
              fontSize: 9, letterSpacing: '0.4em',
              color: '#f5c451',
              textShadow: '0 0 12px rgba(245,196,81,0.5)',
            }}>
              ⋆ whispers heard · {whispersThisRun.length} / 5
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {whispersThisRun.map((e) => (
                <span key={e.id} className="f-mono" style={{
                  fontSize: 10, color: '#f5c451', letterSpacing: '0.08em',
                  opacity: 0.92,
                }}>
                  <span style={{ marginRight: 4 }}>{e.icon}</span>{e.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Panel 4 — build identity (only when there are 3+ catalysts so
            the verdict actually means something). */}
        {buildIdentity && (
          <div className="f-mono uc" style={{
            fontSize: 10, letterSpacing: '0.4em',
            color: buildIdentity.color,
            textShadow: `0 0 14px ${buildIdentity.color}88`,
            opacity: 0, animation: 'fadein 800ms ease-out 1100ms both',
          }}>
            ◆ {buildIdentity.label} ◆
          </div>
        )}

        {/* One More Run hook — the single dangling carrot for the next run. */}
        <div className="f-mono uc" style={{
          fontSize: 11, letterSpacing: '0.28em',
          color: hookColor,
          textShadow: `0 0 14px ${hookColor}55`,
          marginTop: 8,
          opacity: 0, animation: 'fadein 800ms ease-out 1200ms both',
        }}>
          {hook.label}
        </div>

        {/* Action row — kept identical between modes so the button
            position is muscle-memory across runs. */}
        <div style={{
          marginTop: 6,
          display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center',
          animation: 'fadein 600ms ease-out 1400ms both',
        }}>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'constellation_select' })}
            className="btn btn-primary mat-interactive tap"
            data-autofocus
          >
            {mode === 'win' ? '✦ Run Again' : '↻ Try Again'}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
            className="btn btn-ghost mat-interactive tap"
          >
            ← Title
          </button>
        </div>
        {mode === 'win' && <PortalGate size={72} label="Travel" />}
      </div>
    </div>
  );
}

function Stat({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 76 }}>
      <div className="f-mono num" style={{ fontSize: 22, color }}>{value}</div>
      <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: '#bba8ff' }}>
        {label}
      </div>
    </div>
  );
}

function ShatterConstellation() {
  return (
    <svg viewBox="0 0 200 200" width="180" height="180" style={{ marginBottom: -12 }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const x = 100 + Math.cos(a) * 70;
        const y = 100 + Math.sin(a) * 70;
        return (
          <g key={i}>
            <line x1="100" y1="100" x2={x} y2={y}
              stroke="#f5c451" strokeWidth="0.5" opacity="0.5"
              strokeDasharray="2 3"
              style={{ animation: `titleConstDraw 1.4s ease-out ${i * 60}ms both` }} />
            <circle cx={x} cy={y} r="2.5" fill="#f5c451"
              style={{ filter: 'drop-shadow(0 0 6px #f5c451)', animation: `fadein 600ms ease-out ${800 + i * 60}ms both` }} />
          </g>
        );
      })}
      <circle cx="100" cy="100" r="6" fill="#fff"
        style={{ filter: 'drop-shadow(0 0 18px #7be3ff)' }} />
    </svg>
  );
}

// Pick the dominant archetype across owned catalysts. Returns null when
// fewer than 3 catalysts are owned (the verdict isn't statistically
// meaningful below that threshold).
function computeBuildIdentity(catalysts: string[]): { label: string; color: string } | null {
  if (catalysts.length < 3) return null;
  const counts: Record<string, number> = {};
  for (const id of catalysts) {
    const meta = CATALYST_META.find((c) => c.id === id);
    if (!meta?.archetype) continue;
    counts[meta.archetype] = (counts[meta.archetype] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  if (!top || top[1] < 2) return null;
  const [archetype] = top;
  // Color matches the dominant archetype's modal catalyst color so the
  // banner reads as that identity's tribe.
  const sample = catalysts
    .map((id) => CATALYST_META.find((c) => c.id === id))
    .find((m) => m?.archetype === archetype);
  return {
    label: ARCHETYPE_LABELS[archetype] ?? archetype.toUpperCase(),
    color: sample?.color ?? '#bba8ff',
  };
}

// 2026-05-11 polish — per-scaling-catalyst stack → human-readable bonus.
// Mirrors the badge labels used in CatalystStrip so the player sees the
// same units everywhere. If we add a new scaling catalyst, add a case
// here and to SCALING_CATALYST_IDS in data/catalysts.ts.
function formatScalingBonus(id: string, stacks: number): string {
  switch (id) {
    case 'star_chart':       return `+${(stacks * 0.25).toFixed(2)}× mult`;
    case 'lodestone':        return `+${stacks * 2} chips`;
    case 'comet_trail':      return `+${stacks * 10} chips`;
    case 'memento_star':     return `+${(stacks * 0.5).toFixed(1)}× mult`;
    case 'ouroboros':        return `+${stacks * 3} mult`;
    case 'event_horizon':    return `+${stacks}% mult`;
    case 'highwater':        return `+${stacks} mult`;
    case 'heirloom_locket':  return `+${(stacks * 0.15).toFixed(2)}× mult`;
    case 'compounding_bias': return `+${(stacks * 0.10).toFixed(2)}× mult`;
    case 'momentum':         return `×${Math.pow(1.4, stacks).toFixed(2)} mult`;
    default:                 return `${stacks} stacks`;
  }
}
void SCALING_CATALYST_IDS; // imported for type narrowing; actual gating uses run.catalysts
