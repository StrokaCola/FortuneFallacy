# Boss Art Pass — Design Spec

**Date:** 2026-04-30
**Branch:** `feat/boss-art-pass` (forks from `main` post-D-2 merge)
**Status:** Design approved, ready for plan

## Goal

Replace placeholder boss sigils + Unicode icons with hand-drawn astronomic-mechanical SVG art for all 7 bosses (Pluto, Ceres, Triton, Phobos, Callisto, Eris, Sedna). Each sigil hybrid-encodes its astronomical body's signature with its debuff effect. Add CSS-driven reveal + idle motion.

## Decisions Locked

| Question | Choice |
|---|---|
| Scope | Sigils + icon swap + animation (option C) |
| Sigil style | Astronomic / mechanical (orbits, ellipses, satellite dots) |
| Mapping principle | Hybrid: real astronomical signature + debuff overlay |
| Icon approach | Simplified glyph per boss (separate `iconGlyph` SVG, not scaled sigil) |
| Motion | Reveal (~700ms scale + draw-on) + idle (continuous orbit/breathe/satellite) |

## Architecture

```
src-next/
├── data/blinds.ts                  ← reshape BossBlind.icon + BossBlind.sigil
├── app/components/
│   ├── BossSigil.tsx (new)         ← 96px sigil w/ idle + optional reveal
│   └── BossIcon.tsx (new)          ← 16px inline glyph (replaces Unicode)
└── styles/index.css                ← 6 @keyframes + class hooks
```

No state slice changes. No event bus changes (`onBossRevealed` already fires). Pure data + presentation.

## Data Shape Change

**Before** (`src-next/data/blinds.ts`):
```ts
export type BossBlind = {
  id: string;
  name: string;
  icon: string;           // Unicode glyph
  color: string;
  description: string;
  debuffs: string[];
  sigil: { viewBox: string; paths: string[] };
};
```

**After:**
```ts
export type SigilGroupClass =
  | 'orbit-main'    // primary orbit ellipse — drives idleRotate
  | 'orbit-aux'     // secondary orbit (dashed) — drives idleRotate (opposing)
  | 'body-core'     // central planet body — drives idleBreathe
  | 'satellite'     // small orbiting dot — drives satOrbit
  | 'mark';         // static decorations (X, dashes, anchors)

export type SigilGroup = {
  class: SigilGroupClass;
  paths: string[];
  strokeWidth?: number;   // default 1.5
  fill?: 'none' | 'current'; // default 'none'
  opacity?: number;       // default 1
};

export type BossBlind = {
  id: string;
  name: string;
  iconGlyph: { viewBox: string; paths: string[] };  // ← replaces icon: string
  color: string;
  description: string;
  debuffs: string[];
  sigil: { viewBox: string; groups: SigilGroup[] };  // ← replaces paths: string[]
};
```

### Per-boss data (7 entries fully redrawn)

Each entry's `sigil.groups` and `iconGlyph.paths` follow the approved mockups in `.superpowers/brainstorm/.../sigil-roster.html` and `icon-swap.html`. Group classes assigned so CSS animations target correct elements:

| Boss | Sigil contents | Icon glyph |
|---|---|---|
| Pluto | binary system: 2 bodies + chain marks (mark) on Charon, "1" stamped on primary | small binary pair |
| Ceres | dwarf body + dashed orbit ring + 4 belt dots (cardinal) | central body + 4 dots |
| Triton | retrograde arrow path + planet body + arrowhead (mark) | curved arrow |
| Phobos | decaying spiral (3 nested arcs) + body + broken-latch mark | tight spiral |
| Callisto | large circle + 5 craters + muted-line mark | crater-pocked disc |
| Eris | eccentric ellipse (split solid/dashed) + body + satellite + X mark | tilted ellipse + dot |
| Sedna | extreme elongated ellipse + body + satellite + heavy bar (mark) | elongated ellipse |

## Components

### `BossSigil.tsx`

```ts
type Props = {
  boss: BossBlind;
  size?: number;                                       // default 96
  animate?: 'none' | 'idle' | 'reveal' | 'both';      // default 'idle'
};
```

- Renders `<svg viewBox={boss.sigil.viewBox}>` with one `<g class={`boss-sigil__${group.class}`}>` per group.
- Stroke color via inline `style={{ '--boss-color': boss.color }}`; CSS uses `stroke: var(--boss-color)`.
- Conditionally adds `boss-sigil--reveal` class on first paint when animate ∈ {reveal, both}; auto-removes after 800ms via setTimeout (so re-mounts in StrictMode don't replay).
- Adds `boss-sigil--idle-on` class when animate ∈ {idle, both}.

### `BossIcon.tsx`

```ts
type Props = { boss: BossBlind; size?: number };  // default 16
```

- Renders `<svg viewBox={boss.iconGlyph.viewBox}>` with single `<g>` containing all paths.
- Stroke = `boss.color`; stroke-width 1.5 (constant ratio at small sizes).
- No animation. Static glyph for inline use.

## CSS Animations

Added to `src-next/styles/index.css`:

```css
/* Reveal — one-shot when .boss-sigil--reveal applied */
@keyframes sigilReveal {
  0%   { transform: scale(0.4) rotate(-12deg); opacity: 0; }
  60%  { transform: scale(1.1) rotate(2deg);   opacity: 1; }
  100% { transform: scale(1) rotate(0);         opacity: 1; }
}
@keyframes drawStroke { from { stroke-dashoffset: 240; } to { stroke-dashoffset: 0; } }
@keyframes drawDots   { 0%, 50% { opacity: 0; transform: scale(0); } 100% { opacity: 1; transform: scale(1); } }

/* Idle — continuous when .boss-sigil--idle-on applied */
@keyframes idleRotate  { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes idleBreathe { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }
@keyframes satOrbit    { from { transform: rotate(0); } to { transform: rotate(-360deg); } }

.boss-sigil__orbit-main,
.boss-sigil__orbit-aux { transform-origin: 50% 50%; }
.boss-sigil--idle-on .boss-sigil__orbit-main { animation: idleRotate 24s linear infinite; }
.boss-sigil--idle-on .boss-sigil__orbit-aux  { animation: idleRotate 36s linear infinite reverse; }
.boss-sigil--idle-on .boss-sigil__body-core  { animation: idleBreathe 4s ease-in-out infinite; transform-origin: 50px 50px; transform-box: view-box; }
.boss-sigil--idle-on .boss-sigil__satellite  { animation: satOrbit 12s linear infinite; transform-origin: 50% 50%; }

.boss-sigil--reveal { animation: sigilReveal 700ms cubic-bezier(.2,.8,.2,1) forwards; transform-origin: 50% 50%; }
.boss-sigil--reveal .boss-sigil__orbit-main { stroke-dasharray: 240; animation: drawStroke 600ms cubic-bezier(.4,0,.2,1) 100ms forwards; }
.boss-sigil--reveal .boss-sigil__satellite,
.boss-sigil--reveal .boss-sigil__mark { animation: drawDots 700ms ease-out 300ms backwards; transform-origin: center; transform-box: fill-box; }

@media (prefers-reduced-motion: reduce) {
  .boss-sigil--idle-on *,
  .boss-sigil--reveal,
  .boss-sigil--reveal * { animation: none !important; }
}
```

## Consumer Sweep

Find all references to `boss.icon` (Unicode string) and the existing sigil renderer. Replace per usage context:

| Context | Component | animate prop |
|---|---|---|
| Boss reveal screen / banner | `<BossSigil>` | `both` |
| Round HUD inline boss tag | `<BossIcon>` | n/a |
| Shop boss preview | `<BossSigil>` | `idle` |
| Fail/win screen results | `<BossSigil>` | `idle` |
| Any other consumer found via grep | `<BossSigil>` or `<BossIcon>` | per-context |

A grep for `boss.icon` and `BOSS_BLINDS.find` plus following the JSX consumers covers the audit. TS will compile-error on `string` → object change at every call site.

## Reveal Trigger

Reveal is parent-owned, not lifecycle-owned. The boss-reveal screen component holds local `useState` `[hasRevealed, setHasRevealed]` initialized to `false`. On first paint, schedules `setHasRevealed(true)` after 800ms. Pass `animate={hasRevealed ? 'idle' : 'both'}` to `<BossSigil>`. StrictMode double-mounts re-run the effect, but `useState` lazy-init samples once per mount lifecycle; a fresh remount intentionally replays reveal (which only happens on screen re-entry, not within a single round).

Concretely:

```tsx
function BossRevealBanner({ boss }: { boss: BossBlind }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 800); return () => clearTimeout(t); }, []);
  return <BossSigil boss={boss} animate={revealed ? 'idle' : 'both'} />;
}
```

No new state slice fields. No event subscription added.

## A11y

`prefers-reduced-motion: reduce` disables all 6 keyframes via the `@media` block. Static sigil + static reveal still render.

## Testing

| Test file | Coverage |
|---|---|
| `src-next/data/blinds.test.ts` (new) | All 7 BOSS_BLINDS have `iconGlyph` + `sigil.groups`; every sigil has ≥1 `body-core` + ≥1 orbit-class group |
| `src-next/app/components/BossSigil.test.tsx` (new) | renders one `<g>` per group with class hook; applies `--reveal` and `--idle-on` per `animate` prop; `animate='none'` strips both |
| `src-next/app/components/BossIcon.test.tsx` (new) | renders `iconGlyph.paths`, applies boss color via stroke |
| Snapshot — Eris sigil | Detect accidental SVG geometry changes |

CSS animation timing not unit-tested (visual smoke instead).

## Risks + Mitigations

1. **Type breakage on data shape change.** Unicode `icon: string` → object. Compile-error at every consumer. **Mitigation:** TS catches all sites. PR sweep updates them.
2. **Idle perf on multiple sigils.** 7 sigils animating in shop preview = 21 transforms. **Mitigation:** only currently visible sigil uses `animate='idle'`; off-screen mounts use `animate='none'`.
3. **Reveal flash on remount (StrictMode).** **Mitigation:** parent owns reveal state via local `useState`; only re-replays when boss-reveal screen itself remounts (intentional). See Reveal Trigger section.
4. **Bundle size.** ~3-5KB additional in blinds.ts. **Mitigation:** acceptable; one-time cost, no runtime impact.

## Scope

**In:** 7 sigils + 7 icon glyphs redrawn; data shape change; `BossSigil`/`BossIcon` components; 6 CSS @keyframes; consumer sweep; `prefers-reduced-motion`; tests above.

**Out (defer to D-3 / juice):** Tense idle ramping with `handsLeft`; boss-screen background flourishes; audio cue on reveal; sound-reactive sigil; new boss additions.

## Branch / PR

- Branch: `feat/boss-art-pass` from `main`
- Single PR, commits split by phase:
  1. data shape change + 7 entries redrawn
  2. `BossIcon` component + tests
  3. `BossSigil` static rendering + tests (no animation yet)
  4. CSS keyframes + idle motion
  5. Reveal trigger + event-store wiring
  6. Consumer sweep
- Estimated 5-6 commits.
