// CatalystStrip — the per-run owned-catalyst tray rendered as a row
// (mobile / portrait) or a left rail (wide-mode landscape).
//
// This file is intentionally a thin orchestrator. The heavy lifting
// lives in `catalystStrip/`:
//
//   types.ts             — FloaterRecord / RingRecord / PulseKind
//   badges.tsx           — LunarPhaseBadge, TideBadge, CornerBadge
//   useCatalystEvents.ts — bus listener that drives pulse / floater /
//                          ring animation state
//   CatalystCard.tsx     — per-card render
//
// What stays here: state derivation that requires multiple selectors
// joined together (linkedIds across active resonances, badge-bump
// diffing across stack snapshots), and the layout container that
// switches between row / rail.

import { useEffect, useRef, useState } from 'react';
import { useStore, type GameState } from '../../state/store';
import { useIsWideMode, useIsTightStage } from '../hooks/useIsCompactStage';
import { activeResonances } from '../../data/resonances';
import { Z } from './zLayers';
import { useInspectable } from '../../devtools/inspector/elementRegistry';
import { CatalystCard } from './catalystStrip/CatalystCard';
import { useCatalystEvents } from './catalystStrip/useCatalystEvents';

// Stable fallback so the selector doesn't return a fresh object on every
// snapshot read (which tear-loops useSyncExternalStore).
const EMPTY_EDITIONS: Record<string, never> = {};
const EMPTY_CONTRIB: Record<string, number> = {};
const EMPTY_FIRES: Record<string, number> = {};
const EMPTY_STACKS: Record<string, number> = {};

const selectCatalysts = (s: GameState) => s.run.catalysts;
const selectCatalystEditions = (s: GameState) => s.run.catalystEditions ?? EMPTY_EDITIONS;
const selectCompoundingStacks = (s: GameState) => s.run.compoundingStacks;
const selectHandsPlayed = (s: GameState) => s.run.handsPlayed;
const selectHandsLeft = (s: GameState) => s.round.handsLeft;
const selectActive = (s: GameState) => s.round.active;
const selectCatalystChips = (s: GameState) => s.run.runStats?.catalystChips ?? EMPTY_CONTRIB;
const selectCatalystFires = (s: GameState) => s.run.runStats?.catalystFires ?? EMPTY_FIRES;
const selectCatalystStacks = (s: GameState) => s.run.catalystStacks ?? EMPTY_STACKS;
const selectLunarPhase = (s: GameState) => s.run.lunarPhase ?? 0;
const selectLunarBaked = (s: GameState) => s.run.lunarBakedMult ?? 0;
const selectMirroredHand = (s: GameState) => s.run.mirroredHandActive;

export function CatalystStrip() {
  const catalysts = useStore(selectCatalysts);
  const catalystEditions = useStore(selectCatalystEditions);
  const compoundingStacks = useStore(selectCompoundingStacks);
  const handsPlayed = useStore(selectHandsPlayed);
  const wide = useIsWideMode();
  const tight = useIsTightStage();
  const handsLeft = useStore(selectHandsLeft);
  const roundActive = useStore(selectActive);
  const catalystChips = useStore(selectCatalystChips);
  const catalystFires = useStore(selectCatalystFires);
  const catalystStacks = useStore(selectCatalystStacks);
  const lunarPhase = useStore(selectLunarPhase);
  const lunarBaked = useStore(selectLunarBaked);
  const mirroredHandActive = useStore(selectMirroredHand);

  // Bus-driven animation state lives in the dedicated hook so this
  // file can stay focused on layout + per-card prop assembly.
  const { pulsing, floaters, rings } = useCatalystEvents(catalysts, tight);

  // Badge bump on stack increment. Diff the previous catalystStacks
  // snapshot against the current one; for each id whose stack went UP,
  // bump badgeBumpKey so React re-mounts the .badge-bumped element and
  // the CSS animation re-fires. We don't run this for first-mount values
  // (prevStacksRef defaults to {} so a first-load Lodestone with 3
  // stacks would otherwise spuriously bump on render).
  const [badgeBumpKey, setBadgeBumpKey] = useState<Record<string, number>>({});
  const prevStacksRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const prev = prevStacksRef.current;
    const next: Record<string, number> = {};
    for (const [id, val] of Object.entries(catalystStacks)) {
      next[id] = val;
      const prior = prev[id];
      if (prior != null && val > prior) {
        setBadgeBumpKey((s) => ({ ...s, [id]: (s[id] ?? 0) + 1 }));
      }
    }
    prevStacksRef.current = next;
  }, [catalystStacks]);

  const inspectRef = useInspectable<HTMLDivElement>('hud.catalystStrip', { label: 'CatalystStrip', zLayer: 'hud' });

  if (catalysts.length === 0) return null;

  // Set of catalyst ids that are currently half of an active resonance
  // pair. Used to draw a "linked" gold accent on the card so players
  // see synergies at a glance, not just on fire.
  const linkedIds = new Set<string>();
  for (const r of activeResonances(catalysts)) {
    linkedIds.add(r.a);
    linkedIds.add(r.b);
  }

  return (
    <div
      ref={inspectRef}
      data-coach="catalyst-strip"
      style={{
        position: 'absolute',
        // Stack from the bottom edge of TopBar (with breathing room) so
        // catalysts never disappear under TopBar when it wraps onto two
        // rows on narrow viewports.
        top: 'calc(var(--hud-top-h, 134px) + 8px)',
        left: 18,
        // Wide-mode (desktop landscape, ≥1280×760): turn the row into a
        // left rail so catalysts use the otherwise-empty side margin and
        // 6+ cards don't run off the play area horizontally.
        display: 'flex',
        flexDirection: wide ? 'column' : 'row',
        gap: 8, zIndex: Z.hud,
      }}
    >
      {catalysts.map((id, i) => (
        <CatalystCard
          key={i}
          id={id}
          index={i}
          pulseKind={pulsing[id]}
          edition={catalystEditions[id]}
          isLinked={linkedIds.has(id)}
          showLastThrowWarn={id === 'last_throw' && roundActive && handsLeft === 1}
          stack={catalystStacks[id]}
          bumpKey={badgeBumpKey[id] ?? 0}
          compoundingStacks={compoundingStacks}
          lunarPhase={lunarPhase}
          lunarBaked={lunarBaked}
          handsPlayed={handsPlayed}
          mirroredHandActive={mirroredHandActive}
          cardFloaters={floaters.filter((f) => f.catalystId === id)}
          cardRings={rings.filter((r) => r.catalystId === id)}
          catalystChips={catalystChips[id] ?? 0}
          catalystFires={catalystFires[id] ?? 0}
          tight={tight}
        />
      ))}
    </div>
  );
}
