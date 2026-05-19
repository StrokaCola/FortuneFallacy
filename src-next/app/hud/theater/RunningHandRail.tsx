// Wave T Scoring Theater (Batch K, 2026-05-19) — running breakdown
// rail. Lists each catalyst / mod / resonance that has fired this
// hand, with cumulative chip and mult contribution, updating beat-
// by-beat. Replaces the post-hand "Why?" modal as the primary
// attribution surface during scoring.
//
// Reset on `cast-swell` (new hand). Hidden on tight viewports (the
// rail is a desktop affordance; phones use the floaters alone).

import { useEffect, useRef, useState } from 'react';
import { bus } from '../../../events/bus';
import { lookupCatalyst } from '../../../data/catalysts';
import { lookupResonance } from '../../../data/resonances';
import { useIsTightStage } from '../../hooks/useIsCompactStage';

type RailEntry = {
  key: string;
  label: string;
  color: string;
  chips: number;
  mult: number;
  fires: number;
};

function entryColorFor(sourceType: string, sourceId: string | undefined): string {
  if (sourceType === 'catalyst' && sourceId) {
    const meta = lookupCatalyst(sourceId);
    if (meta) return meta.color;
  }
  if (sourceType === 'resonance') return '#cc88ff';
  if (sourceType === 'mod') return '#ff9d4a';
  return '#7be3ff';
}

function entryLabelFor(sourceType: string, sourceId: string | undefined): string {
  if (sourceType === 'catalyst' && sourceId) {
    return lookupCatalyst(sourceId)?.name ?? sourceId;
  }
  if (sourceType === 'resonance' && sourceId) {
    return lookupResonance(sourceId)?.name ?? sourceId;
  }
  if (sourceType === 'mod' && sourceId) {
    return sourceId.replace(/^./, (c) => c.toUpperCase());
  }
  return sourceId ?? sourceType;
}

export function RunningHandRail() {
  const tight = useIsTightStage();
  const [entries, setEntries] = useState<RailEntry[]>([]);
  const entriesRef = useRef<Map<string, RailEntry>>(new Map());

  useEffect(() => {
    const off = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'cast-swell') {
        // New hand — clear all entries.
        entriesRef.current.clear();
        setEntries([]);
        return;
      }
      if (beat.kind !== 'upgrade-chip' && beat.kind !== 'upgrade-mult') return;
      const sourceType = beat.sourceType ?? 'unknown';
      const sourceId = beat.sourceId;
      if (sourceType === 'unknown' || !sourceId) return;
      const key = `${sourceType}:${sourceId}`;
      const existing = entriesRef.current.get(key);
      const chipDelta = beat.kind === 'upgrade-chip' ? beat.chipDelta : 0;
      const multDelta = beat.kind === 'upgrade-mult' ? beat.multDelta : 0;
      const next: RailEntry = existing
        ? {
            ...existing,
            chips: existing.chips + chipDelta,
            mult: existing.mult + multDelta,
            fires: existing.fires + 1,
          }
        : {
            key,
            label: entryLabelFor(sourceType, sourceId),
            color: entryColorFor(sourceType, sourceId),
            chips: chipDelta,
            mult: multDelta,
            fires: 1,
          };
      entriesRef.current.set(key, next);
      setEntries([...entriesRef.current.values()]);
    });
    return () => off();
  }, []);

  if (tight) return null;
  if (entries.length === 0) return null;

  return (
    <div
      className="theater-running-hand-rail"
      aria-hidden
      style={{
        position: 'absolute',
        left: '50%',
        top: 'calc(var(--hud-top-h, 96px) + 60px)',
        transform: 'translateX(-50%)',
        zIndex: 4,
        pointerEvents: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 6,
        padding: '4px 8px',
        maxWidth: '80vw',
      }}
    >
      {entries.map((e) => (
        <div
          key={e.key}
          className="theater-running-rail-chip"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            background: 'rgba(7, 5, 26, 0.78)',
            border: `1px solid ${e.color}88`,
            boxShadow: `0 0 6px ${e.color}55`,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: '#f3f0ff',
            letterSpacing: '0.04em',
          }}
        >
          <span style={{ color: e.color, fontWeight: 700 }}>{e.label}</span>
          {e.chips !== 0 && (
            <span style={{ color: '#7be3ff' }}>+{e.chips}</span>
          )}
          {e.mult !== 0 && (
            <span style={{ color: '#cc88ff' }}>+{e.mult}×</span>
          )}
          {e.fires > 1 && (
            <span style={{ color: '#bba8ff', opacity: 0.7 }}>×{e.fires}</span>
          )}
        </div>
      ))}
    </div>
  );
}
