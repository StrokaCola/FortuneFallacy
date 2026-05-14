// "What's next?" quest-log panel for the Postmortem screen.
//
// Surfaces 1-3 dynamic nudges based on current run + meta state:
//
//   1. Codex distance — current discovered catalyst count vs. the
//      nearest unlocked Codex milestone (25 / 40 / 56). Skipped if the
//      player has already cleared all three.
//   2. Untried constellation — the first constellation the player has
//      unlocked but never recorded a stake clear on. Skipped if every
//      unlocked constellation has been won.
//   3. Peak hand — the player's current peak vs. the nearest unmet
//      score milestone (5k / 25k / 100k / 500k / 1M). Skipped if the
//      player has already topped 1M.
//
// Designed to be reassuringly low-stakes: small chips, italicised
// copy, no exclamations. The Postmortem already shows what the run
// *was*; this panel quietly points at what it could *become*.

import { useStore, type GameState } from '../../../state/store';
import { CONSTELLATIONS } from '../../../data/constellations';

type Nudge = {
  icon: string;
  label: string;
  detail: string;
};

const CODEX_MILESTONES: { id: string; target: number }[] = [
  { id: 'codex_25', target: 25 },
  { id: 'codex_40', target: 40 },
  { id: 'codex_56', target: 56 },
];

const PEAK_MILESTONES: { target: number; label: string }[] = [
  { target: 5_000,     label: 'Five Thousand' },
  { target: 25_000,    label: 'Twenty-Five Thousand' },
  { target: 100_000,   label: 'Sixfigure' },
  { target: 500_000,   label: 'Half Million' },
  { target: 1_000_000, label: 'Apex' },
];

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function pickCodexNudge(state: GameState): Nudge | null {
  const unlocked = new Set(state.meta.achievements?.unlocked ?? []);
  const discovered = state.meta.discovered?.catalysts?.length ?? 0;
  for (const m of CODEX_MILESTONES) {
    if (unlocked.has(m.id)) continue;
    if (discovered >= m.target) continue;
    const remaining = m.target - discovered;
    return {
      icon: '◇',
      label: 'Codex progress',
      detail: `${remaining} more catalyst${remaining === 1 ? '' : 's'} to unlock the ${m.target}-mark.`,
    };
  }
  return null;
}

function pickConstellationNudge(state: GameState): Nudge | null {
  const unlocks = new Set(state.meta.unlocks ?? []);
  const stakeProgress = state.meta.stakeProgress ?? {};
  // Iterate in catalog order so the suggestion is deterministic
  // run-to-run (player gets the same "try this next" line until they
  // actually try it).
  for (const c of CONSTELLATIONS) {
    if (c.id === state.run.constellationId) continue;
    if (!unlocks.has(c.id)) continue;
    if (stakeProgress[c.id]) continue;
    return {
      icon: '✦',
      label: 'Untried sky',
      detail: `You haven't won on ${c.name} yet.`,
    };
  }
  return null;
}

function pickPeakNudge(state: GameState): Nudge | null {
  const peak = state.run.runStats?.peakHand ?? 0;
  for (const m of PEAK_MILESTONES) {
    if (peak >= m.target) continue;
    return {
      icon: '↟',
      label: 'Peak hand',
      detail: `${formatNum(peak)} so far. ${formatNum(m.target)} unlocks "${m.label}".`,
    };
  }
  return null;
}

export function buildQuestLog(state: GameState): Nudge[] {
  const nudges: Nudge[] = [];
  const codex = pickCodexNudge(state);
  if (codex) nudges.push(codex);
  const cons = pickConstellationNudge(state);
  if (cons) nudges.push(cons);
  const peak = pickPeakNudge(state);
  if (peak) nudges.push(peak);
  // Always-on fallback when every milestone is met.
  if (nudges.length === 0) {
    nudges.push({
      icon: '◯',
      label: 'The loop holds',
      detail: 'Every milestone met. Pick a constellation and run again.',
    });
  }
  return nudges.slice(0, 3);
}

// Selector pulls the whole state — buildQuestLog reads several
// independent slices (meta.achievements, meta.unlocks, meta.stakeProgress,
// run.constellationId, run.runStats.peakHand, meta.discovered.catalysts).
// `(s) => s` returns the underlying state reference which is stable
// until any store mutation — so this only re-renders RunQuestLog on
// actual state changes, not unbounded loops. Suboptimal (re-renders
// on unrelated mutations too) but correct.
const selectQuestLogState = (s: GameState) => s;

export function RunQuestLog() {
  const state = useStore(selectQuestLogState);
  const nudges = buildQuestLog(state);
  return (
    <div style={{
      width: '100%',
      maxWidth: 480,
      margin: '8px auto 0',
      padding: '14px 18px',
      background: 'rgba(28,18,69,0.55)',
      border: '1px solid rgba(149,119,255,0.25)',
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      animation: 'fadein 600ms ease-out 1200ms both',
    }}>
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff',
        textAlign: 'center',
      }}>
        ◇ what next ◇
      </div>
      {nudges.map((n, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'baseline', gap: 10,
          fontFamily: '"Exo 2", sans-serif',
        }}>
          <span style={{ color: '#7be3ff', fontSize: 14, lineHeight: 1 }}>{n.icon}</span>
          <div style={{ flex: 1 }}>
            <div className="f-mono uc" style={{
              fontSize: 9, letterSpacing: '0.24em', color: '#bba8ff', marginBottom: 2,
            }}>
              {n.label}
            </div>
            <div style={{ fontSize: 12, color: '#dcd4ff', lineHeight: 1.5, fontStyle: 'italic' }}>
              {n.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
