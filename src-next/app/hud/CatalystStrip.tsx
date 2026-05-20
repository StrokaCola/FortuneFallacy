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
import { EmptySlot } from './EmptySlot';

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
  const { pulsing, floaters, rings } = useCatalystEvents(catalysts, tight, catalystEditions);

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

  // Empty state: render a single ghost slot so a brand-new player
  // sees *where* catalysts will live + an inviting tooltip explaining
  // how to fill it. Only renders while the round is active — outside
  // of round (Hub, Shop, Forge) the strip is hidden entirely since
  // those screens are about acquiring catalysts, not playing with them.
  if (catalysts.length === 0) {
    if (!roundActive) return null;
    return (
      <div
        ref={inspectRef}
        data-coach="catalyst-strip"
        style={{
          position: 'absolute',
          // Tight gets a 16px breathing buffer below TopBar so the
          // strip doesn't crowd the bar (mirrors the ConsumableTray
          // bump on tight). Non-tight keeps the original 8px gap.
          top: `calc(var(--hud-top-h, 134px) + ${tight ? '24px' : '8px'})`,
          left: 18,
          display: 'flex',
          flexDirection: wide ? 'column' : 'row',
          gap: 8,
          zIndex: Z.hud,
          pointerEvents: 'auto',
        }}
      >
        <EmptySlot kind="catalyst" />
      </div>
    );
  }

  // Set of catalyst ids that are currently half of an active resonance
  // pair. Used to draw a "linked" gold accent on the card so players
  // see synergies at a glance, not just on fire.
  const linkedIds = new Set<string>();
  for (const r of activeResonances(catalysts)) {
    linkedIds.add(r.a);
    linkedIds.add(r.b);
  }

  // Apply the scroll-fade utility only when the row actually overflows
  // (5+ catalysts on a non-wide viewport). Pinning the class always
  // would render the fade even on a single-card strip, which reads as
  // visual debris when there's nothing offscreen to discover.
  const useScrollFade = !wide && catalysts.length >= 5;
  return (
    <div
      ref={inspectRef}
      data-coach="catalyst-strip"
      className={useScrollFade ? 'scroll-x-fade' : undefined}
      style={{
        position: 'absolute',
        // Stack from the bottom edge of TopBar (with breathing room) so
        // catalysts never disappear under TopBar when it wraps onto two
        // rows on narrow viewports. Tight bumps the gap to 24px so the
        // strip + mirrored consumable tray don't crowd TopBar.
        top: `calc(var(--hud-top-h, 134px) + ${tight ? '24px' : '8px'})`,
        left: 18,
        // Wide-mode (desktop landscape, ≥1280×760): turn the row into a
        // left rail so catalysts use the otherwise-empty side margin and
        // 6+ cards don't run off the play area horizontally.
        display: 'flex',
        flexDirection: wide ? 'column' : 'row',
        gap: 8, zIndex: Z.hud,
        // Round's root container ships pointer-events:none so dice +
        // canvas hits pass through to the Three.js layer; HUD strips
        // re-enable explicitly so per-card hover + sell-button + the
        // .has-tip tooltip surface all receive events. The empty-slot
        // branch above does the same; this matches it for the
        // populated case so tooltips fire on real mouse hover.
        pointerEvents: 'auto',
        ...(wide ? {} : {
          // Wave T+1 (2026-05-19) responsive UI pass — reserve a slot
          // for the ConsumableTray on the right edge of tight portrait
          // viewports so a 5-catalyst row doesn't collide with the
          // consumable card. 18px padding + ~80px consumable area on
          // tight; medium portraits get more breathing room.
          maxWidth: tight
            ? 'calc(100vw - 36px - 80px)'
            : 'calc(100vw - 36px)',
        }),
      }}
    >
      {/* Wide-mode rail header — names the rail as a "vessel" rather
          than an anonymous list of cards. Hidden on tight portrait
          where the catalyst row is already horizontal + space-
          constrained. */}
      {wide && (
        <div className="ff-rail-header" style={{ alignSelf: 'flex-start' }}>
          <span className="ff-rail-header-sigil">✦</span>
          catalysts
        </div>
      )}
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
          wide={wide}
        />
      ))}
    </div>
  );
}
