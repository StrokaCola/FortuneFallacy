# Alive Feel Sweep — Design Spec

**Topic:** Polish pass to make FortuneFallacy2 feel alive — fill SFX gaps, add orbital score popup motion, animate Forge codex chips on hover, add unified press juice to all primary buttons.

**Status:** Brainstorm complete. Ready for writing-plans.

**Final spec destination:** This file.

---

## Context

FortuneFallacy2's Star Forge mod-visuals just shipped (Phases 1-7 on `main`). Next polish initiative: the broader "alive feel" sweep — make the game feel reactive across SFX, score animation, mod-codex interaction, and global button feedback.

User direction: "wider, less deep" — shallow pass on multiple subsystems rather than deep on one. Picked option D from initial scope-decision: SFX wiring as feel-hero, plus 3 supporting micro-interactions (orbital score popup, mod FX teaser, button juice).

Mid-brainstorm correction: SFX is much more wired than initially assumed. `audioBridge.ts` + `scoring.ts` already wire ~13 sounds to game events (roll, score-beats, combos, big-score, win, bust, boss-reveal, lock-toggle, offer-bought). Actual SFX gaps are narrower than scoped.

---

## Goal

Ship four small-but-felt improvements:

1. **SFX gap-fill** — wire `onModFired` events (Phase 5/6 added these without SFX listener), Forge mod attach/detach, and global UI button hover/press. ~8 new SFX ids.
2. **Score popup orbital motion** — replace linear fly-to-counter with loop-around path (token shoots up, loops once around score counter, docks).
3. **Mod FX teaser** — Forge codex chips animate locally on hover (icon glow pulse + accent border ripple). Pure CSS.
4. **Button juice** — global `.btn-primary` press effect: scale-down on press + accent-color shockwave on release. Hits Roll, Play Hand, Done, Begin Ascension automatically.

---

## Non-Goals

- Ambient music shifts based on tension (deferred — `screenMusic.ts` already handles screen-level tracks).
- Per-screen unique SFX themes (one global SFX language).
- Replacing existing SFX wiring — only filling gaps.
- Per-button custom juice (single global rule; per-button overrides only if global feels wrong).
- Sourcing extensive sample libraries — kenney.nl Interface Sounds Pack (CC0) only, ~4 picks.
- Reskinning round-clear / boss-reveal / win / fail ceremonies (out of scope; focus is feel-loop, not state-transitions).
- Reduced-motion: all new animations respect `prefers-reduced-motion` via existing `.reduce-motion` html class — but no new dedicated reduced-motion artwork.

---

## Architecture

### SFX gap-fill

**New SFX ids:** `modPulse`, `modLoaded`, `modPipCharge`, `modBackstop`, `modAttach`, `modDetach`, `uiClick`, `uiHover`. Added to `SfxId` union in `src-next/audio/sfx/index.ts`. Each gets a corresponding voice in `voices.ts` (Tone.js synth) or sample loader (Howler).

**Synth vs sample split (hybrid):**
- Tone.js synth (musical, themed): `modPulse`, `modLoaded`, `modPipCharge`, `modBackstop`. Each is a small chord/arpeggio that matches the mod's visual accent (gold = warm major, ice = cool minor, etc.).
- Howler sample (impact): `modAttach`, `modDetach`, `uiClick`, `uiHover`. Sourced from kenney.nl Interface Sounds Pack (CC0). Files placed under `public/sfx/`.

**`onModFired` listener.** Extend `audioBridge.ts` with one new `bus.on('onModFired', ...)` that resolves the mod's `visual.triggerFx`, switches on it, and plays the correct mod-* sound.

**Forge interaction SFX.** Call `sfxPlay('modAttach')` / `sfxPlay('modDetach')` directly in `Forge.tsx` chip-click and detach-button handlers. No event bus needed for these (purely UI events).

**Global UI button SFX.** Single document-level event delegation listener for `mousedown` (plays `uiClick`) and `mouseenter` (plays `uiHover`) on `.btn-primary` elements. Installed once at app root.

### Score popup orbital motion

**New module:** `src-next/app/hud/orbitalFly.ts`
- Exports `animateOrbital(el: HTMLElement, opts: { startX, startY, endX, endY, durationMs, loops? }): { dispose: () => void }`
- 3-stage path:
  1. **Arc-up (0-40%)** — bezier from start to a point ~80px above counter.
  2. **Orbit (40-75%)** — circular arc around counter at radius ~30px (1 loop).
  3. **Dock (75-100%)** — spiral inward to counter with scale 1→0.5 + opacity 1→0.
- Returns dispose handle (cancels rAF).

**`Particles.tsx` integration.** When emitting a fly-to-counter particle, replace the existing linear-translate CSS class assignment with `animateOrbital(el, {...})` call.

**`ScoreFloat.tsx` integration.** Add `data-score-counter` attribute to the counter element so `orbitalFly` can resolve its position via `document.querySelector`.

**Reduced-motion fallback.** When `.reduce-motion` html class set, `animateOrbital` collapses to direct fade-in then fade-out at counter (no path animation).

**Existing `flyToCounter` keyframe.** Stays in `styles/index.css` as legacy fallback. Particles.tsx no longer uses it but other consumers might.

### Mod FX teaser (codex chip hover)

**Pure CSS.** Add `@keyframes mod-chip-pulse` + `:hover` rules to `src-next/styles/index.css`.

**Effect on hover:**
- Icon: drop-shadow accent intensity oscillates 1→1.6→1 over 1200ms (loops while hovered).
- Icon: rotate +5deg + scale 1.1× on hover (CSS transition).
- Outer ring: `:hover::after` overlays an accent-tinted ring that expands + fades briefly on hover-enter.

**Per-mod color.** Existing `--mod-c` CSS variable on each chip already provides the accent. Keyframe references it directly.

**No JS, no event listeners** beyond Section 1's global `mouseenter` SFX hook.

### Button juice

**Press (CSS only).**
```css
.btn-primary { transition: transform 180ms ease-out; }
.btn-primary:active { transform: scale(0.96); transition: transform 60ms ease-out; }
```

**Release shockwave (JS).** New module `src-next/app/hud/buttonJuice.ts`:
- Exports `installButtonJuice(): () => void` — installs ONE document-level `mousedown` event delegation listener for `.btn-primary` clicks.
- On `mouseup`, spawns a transient `<div class="btn-shockwave">` absolutely positioned at the button's center.
- Shockwave uses existing `ringExpand` keyframe (`styles/index.css:127`, scale 0.4→4 + opacity 1→0, 400ms).
- Auto-removed via `animationend` listener.
- Shockwave color = button's computed `border-color`, fallback `#7be3ff`.

**App-root wiring.** Call `installButtonJuice()` once from `App.tsx` (alongside `startAudioBridge`).

**Selector scope.** `.btn-primary` only. Add `.no-juice` opt-out class for any specific button that feels wrong.

**Reduced-motion.** When `.reduce-motion` html class present → both press scale + shockwave skipped. Buttons remain functional, no visual feedback.

---

## Implementation Phasing

7 sub-tasks, ordered by dependency:

1. **Sample assets** — pick 4 from kenney.nl Interface Sounds Pack (CC0): one each for `uiClick`, `uiHover`, `modAttach`, `modDetach`. Place under `public/sfx/`. Howler-load via existing voices infrastructure.
2. **New SFX voices + ids** — extend `SfxId` union, add 8 voices to `voices.ts` + sfxPlay switch in `sfx/index.ts`.
3. **`onModFired` SFX listener** — one new `bus.on(...)` in `audioBridge.ts` that switches on `def.visual.triggerFx` to play mod-* sound.
4. **Forge SFX hooks** — call `sfxPlay('modAttach')` / `sfxPlay('modDetach')` in `Forge.tsx` handlers.
5. **`buttonJuice.ts` + global delegate** — new module + `installButtonJuice()` call from App.tsx. Wires both press/shockwave AND `uiClick`/`uiHover` SFX. CSS keyframes added to `index.css`.
6. **Codex chip hover** — pure CSS in `index.css`. Hover animation + ring overlay.
7. **`orbitalFly.ts` + Particles.tsx integration** — new JS animator, replaces linear translate. ScoreFloat.tsx gets `data-score-counter` attribute.

Each is an independent commit. Tasks 1-2 are foundation. Tasks 3-7 are independent — any order after 2.

**Visual changes (5+6+7) ship last** so SFX changes (3+4) land cleanly first without visual diff entanglement.

---

## Critical Files

- `src-next/audio/sfx/index.ts` — extend `SfxId` union + sfxPlay switch.
- `src-next/audio/sfx/voices.ts` — add 4 new synth voices.
- `src-next/audio/audioBridge.ts` — add `onModFired` listener.
- `src-next/app/screens/Forge.tsx` — sfxPlay attach/detach.
- `src-next/app/hud/orbitalFly.ts` — NEW.
- `src-next/app/hud/Particles.tsx` — replace linear keyframe call with `animateOrbital`.
- `src-next/app/hud/ScoreFloat.tsx` — add `data-score-counter` attribute.
- `src-next/app/hud/buttonJuice.ts` — NEW.
- `src-next/styles/index.css` — add keyframes for `mod-chip-pulse`, `.btn-primary:active`, `.btn-shockwave`.
- `src-next/main.tsx` or `src-next/app/App.tsx` — `installButtonJuice()` wired at app root.
- `public/sfx/` — 4 sample files (NEW directory if absent).

---

## Verification

### Automated tests
- `voices.test.ts` — verify 4 new voices exist + don't throw on play.
- `audioBridge.test.ts` (NEW or extend) — emit `onModFired`, assert `sfxPlay` called with mod-* id matching `triggerFx` value.
- `Forge.test.tsx` (NEW or extend) — render, click attach → assert `sfxPlay('modAttach')`.
- `buttonJuice.test.ts` (NEW) — install delegate, simulate `.btn-primary` click → assert shockwave element added + removed after `animationend`. Also assert `sfxPlay('uiClick')` called.
- `orbitalFly.test.ts` (NEW) — given start/end coords + duration, verify interpolated position at t=0.2/0.5/0.9 matches arc/orbit/dock stages.

### Manual end-to-end
- Start dev server. Reach gameplay round. Click Roll → existing dice clack continues, button shockwave plays, click sound layered. Press Play Hand → button shockwave + click sound. Score sequence → existing per-tick chimes plus score-tokens now loop around counter. Mod attached + fires during score → mod-specific sound (different from generic chip-tick) plus Phase 5/6 visual FX. Hover Forge codex chips → icon glow pulse + hover swish sound. Click chip to attach → mod-attach sound + chip-pulse confirms. Boss → existing sting (untouched). Toggle reduced-motion in OS → all animations collapse, sounds still play normally.

### Acceptance criteria
- All existing 287 tests still pass.
- 10-15 new tests pass.
- Production build clean.
- No console errors during a full round playthrough.
- Reduced-motion path verified — no animations, sounds still play.
- Cross-screen: button juice fires on every `.btn-primary` (Roll, Play Hand, Done, Begin Ascension, etc.).

---

## Open Questions / Risks

- **Sample license tracking.** kenney.nl is CC0 (public domain) — credit in README is good practice but not legally required. Decide credit format during implementation.
- **Synth voice tuning.** New mod-* voices are first-pass — actual sound design will surface issues only on play. Plan tuning passes after manual verification.
- **Shockwave performance with rapid clicks.** Spam-clicking a button could spawn many shockwaves. Each is short-lived (~400ms) and self-removes; minor perf concern only at >10 clicks/sec.
- **`data-score-counter` selector dependency.** `orbitalFly` does a `document.querySelector` for the counter element. If counter is unmounted (e.g. screen transition mid-animation), animation will mis-target. Add fallback: cache target position at animation start; ignore subsequent layout changes.
- **Concurrent orbital animations.** A 5-die round-clear could spawn 25+ orbital tokens at peak. rAF amortizes but visual clutter possible. If feel feels chaotic, throttle to 1 token per beat (existing per-tick already paces them).

---

## Future Work (deferred)

- Tension-driven music shifts (per Phase 1+ spec — `screenMusic` infrastructure ready; just needs hooking).
- Per-screen SFX themes (different button-click sound on Forge vs Round vs Hub).
- Boss-specific arrival fanfares (boss-revealed event already plays `bossSting`; per-boss variation is expansion).
- Settings panel SFX volume slider (existing `audioSettings` infra supports this; UI not yet built).
- Per-button-class custom juice (e.g. `.btn-danger` red shockwave, `.btn-ghost` softer).
