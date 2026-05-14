import { useEffect, useRef, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { PortalGate } from '../portal/PortalGate';
import * as audioSettings from '../../audio/audioSettings';
import { RunInfoPanel } from './RunInfoPanel';
import { Z } from './zLayers';
import { useFocusTrap } from './useFocusTrap';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import { CATALYST_META } from '../../data/catalysts';
import { lookupConstellation } from '../../data/constellations';

const selectPaused = (s: GameState) => s.ui.paused;
const selectRunActive = (s: GameState) =>
  s.run.goalIdx > 0 || s.round.score > 0 || s.run.catalysts.length > 0 || s.round.active;

type Sliders = { master: number; music: number; sfx: number };
type Tab = 'menu' | 'info';

function readSliders(): Sliders {
  return {
    master: audioSettings.getMaster(),
    music: audioSettings.getMusic(),
    sfx: audioSettings.getSfx(),
  };
}

// Retention nudge selectors — small compact "what you have to lose"
// summary surfaced on the Menu tab. Picks the catalyst with the
// highest chip contribution from `runStats.catalystChips`, falls back
// to the first owned catalyst when the run is fresh.
const selectAnteForPause = (s: GameState) => s.run.ante;
const selectConstellationIdForPause = (s: GameState) => s.run.constellationId;
const selectCatalystsForPause = (s: GameState) => s.run.catalysts;
const selectPeakHandForPause = (s: GameState) => s.run.runStats?.peakHand ?? 0;
const selectCatalystChipsForPause = (s: GameState) => s.run.runStats?.catalystChips ?? {};

export function PauseMenu() {
  const paused = useStore(selectPaused);
  const runActive = useStore(selectRunActive);
  const tight = useIsTightStage();
  const [sliders, setSliders] = useState<Sliders>(readSliders);
  const [tab, setTab] = useState<Tab>('menu');
  const dialogRef = useRef<HTMLDivElement>(null);
  // Run summary (used by the retention panel on the Menu tab).
  const runAnte = useStore(selectAnteForPause);
  const runConstellationId = useStore(selectConstellationIdForPause);
  const runCatalysts = useStore(selectCatalystsForPause);
  const runPeakHand = useStore(selectPeakHandForPause);
  const runCatalystChips = useStore(selectCatalystChipsForPause);

  useFocusTrap(dialogRef, paused);

  useEffect(() => {
    if (!paused) return;
    setSliders(readSliders());
    setTab('menu');
    const off = audioSettings.subscribe(() => setSliders(readSliders()));
    return () => off();
  }, [paused]);

  if (!paused) return null;

  const onResume = () => dispatch({ type: 'TOGGLE_PAUSE' });
  const onBackToTitle = () => {
    dispatch({ type: 'TOGGLE_PAUSE' });
    dispatch({ type: 'SET_SCREEN', screen: 'title' });
  };

  return (
    <div
      ref={dialogRef}
      style={{
        position: 'absolute', inset: 0, zIndex: Z.modalStrong,
        background: 'rgba(7,5,26,0.75)',
        display: 'grid', placeItems: 'center',
        animation: 'fadein 200ms ease-out',
        pointerEvents: 'auto',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Game paused"
    >
      <div
        className="panel-strong"
        style={{
          // Cap width to viewport on tight phones so the modal doesn't
          // touch the screen edges, and shrink padding/gap so the whole
          // dialog fits without overflowing the viewport bottom.
          width: tight
            ? `min(${tab === 'info' ? 460 : 380}px, calc(100vw - 24px))`
            : (tab === 'info' ? 520 : 440),
          padding: tight ? 14 : 24,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: tight ? 8 : 14,
          // 100dvh tracks the visible viewport (Chrome/Safari mobile address bar).
          maxHeight: tight ? 'calc(100dvh - 24px)' : '88dvh',
          // On phone landscape the slider rows + travel gate can still
          // overflow; let the modal scroll internally rather than the page.
          overflowY: 'auto',
        }}
      >
        <div className="f-display" style={{
          fontSize: tight ? 16 : 24,
          color: '#f5c451',
          letterSpacing: tight ? '0.3em' : '0.4em',
        }}>
          ◇ PAUSED ◇
        </div>

        {runActive && (
          <div style={{ display: 'flex', gap: 6 }}>
            <TabBtn active={tab === 'menu'} onClick={() => setTab('menu')}>Menu</TabBtn>
            <TabBtn active={tab === 'info'} onClick={() => setTab('info')}>Run Info</TabBtn>
          </div>
        )}

        {tab === 'menu' && (
          <>
            {runActive && (
              <RunRetentionPanel
                ante={runAnte}
                constellationId={runConstellationId}
                catalysts={runCatalysts}
                peakHand={runPeakHand}
                catalystChips={runCatalystChips}
                tight={tight}
              />
            )}

            <button
              className="btn btn-primary mat-interactive tap"
              style={{ width: tight ? 180 : 220 }}
              onClick={onResume}
              data-autofocus
            >
              Resume
            </button>

            <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: tight ? '2px 0' : '4px 0' }} />

            <div className="f-mono uc" style={{
              fontSize: 10, letterSpacing: '0.3em', color: '#bba8ff',
            }}>
              ◈ AUDIO MIXER
            </div>

            <SliderRow label="Master" value={sliders.master} onChange={audioSettings.setMaster} />
            <SliderRow label="Music"  value={sliders.music}  onChange={audioSettings.setMusic} />
            <SliderRow label="Sfx"    value={sliders.sfx}    onChange={audioSettings.setSfx} />

            <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '4px 0' }} />

            <div className="f-mono uc" style={{
              fontSize: 10, letterSpacing: '0.3em', color: '#bba8ff',
            }}>
              ◈ TRAVEL
            </div>

            <PortalGate size={tight ? 48 : 72} label="Travel" />

            <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: tight ? '2px 0' : '4px 0' }} />

            <button
              className="btn btn-ghost mat-interactive tap"
              style={{ width: tight ? 180 : 220 }}
              onClick={onBackToTitle}
            >
              ← Back to Title
            </button>
          </>
        )}

        {tab === 'info' && (
          <>
            <RunInfoPanel />
            <button
              className="btn btn-ghost mat-interactive tap"
              style={{ width: 180, marginTop: 6 }}
              onClick={onResume}
            >
              ↩ Back to game
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="f-mono uc tap"
      style={{
        background: active ? 'rgba(123,227,255,0.18)' : 'rgba(28,18,69,0.6)',
        border: `1px solid ${active ? '#7be3ffaa' : 'rgba(149,119,255,0.3)'}`,
        color: active ? '#7be3ff' : '#dcd4ff',
        fontSize: 10, letterSpacing: '0.28em',
        padding: '6px 14px', borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function SliderRow({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{
      width: '100%', display: 'grid',
      gridTemplateColumns: '60px 1fr 40px',
      alignItems: 'center', gap: 10,
    }}>
      <span className="f-mono uc" style={{
        fontSize: 10, letterSpacing: '0.2em', color: '#bba8ff',
      }}>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#7be3ff' }}
        aria-label={`${label} volume`}
      />
      <span className="f-mono num" style={{
        fontSize: 11, color: '#7be3ff', textAlign: 'right',
      }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

// Compact "what you have to lose" retention panel for the Menu tab.
// Shown only when a run is active. Surfaces constellation + ante +
// top catalyst (by chip contribution, falling back to first-owned) +
// peak hand. The intent is to pre-empt the close-the-tab decision a
// player might make at the pause moment by reminding them of the run
// they'd be giving up.
function pickTopCatalyst(catalystIds: string[], chips: Record<string, number>): string | null {
  if (catalystIds.length === 0) return null;
  let bestId: string | null = null;
  let bestChips = -1;
  for (const id of catalystIds) {
    const c = chips[id] ?? 0;
    if (c > bestChips) { bestChips = c; bestId = id; }
  }
  // If no contributions recorded yet, fall back to the first owned.
  return bestId ?? catalystIds[0] ?? null;
}

function formatPeak(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function RunRetentionPanel({
  ante, constellationId, catalysts, peakHand, catalystChips, tight,
}: {
  ante: number;
  constellationId: string;
  catalysts: string[];
  peakHand: number;
  catalystChips: Record<string, number>;
  tight: boolean;
}) {
  const cons = lookupConstellation(constellationId);
  const topCatId = pickTopCatalyst(catalysts, catalystChips);
  const topCat = topCatId ? CATALYST_META.find((c) => c.id === topCatId) : null;

  return (
    <div style={{
      width: tight ? 220 : 260,
      display: 'flex', flexDirection: 'column',
      gap: 6,
      padding: tight ? '10px 12px' : '12px 14px',
      background: 'rgba(28,18,69,0.55)',
      border: `1px solid ${cons.color}55`,
      borderRadius: 8,
      boxShadow: `0 0 18px ${cons.color}22`,
    }}>
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff',
      }}>
        your run
      </div>
      <div className="f-mono" style={{ fontSize: 12, color: '#f3f0ff', lineHeight: 1.6 }}>
        <span style={{ color: cons.color }}>{cons.name.split(',')[0]}</span>
        {' · '}
        <span>ante {ante}</span>
      </div>
      {topCat && (
        <div className="f-mono" style={{ fontSize: 11, color: '#dcd4ff', lineHeight: 1.5, opacity: 0.85 }}>
          carried by <span style={{ color: topCat.color }}>{topCat.name}</span>
        </div>
      )}
      {peakHand > 0 && (
        <div className="f-mono" style={{ fontSize: 11, color: '#dcd4ff', lineHeight: 1.5, opacity: 0.85 }}>
          peak hand <span className="num" style={{ color: '#f5c451' }}>{formatPeak(peakHand)}</span>
        </div>
      )}
    </div>
  );
}
