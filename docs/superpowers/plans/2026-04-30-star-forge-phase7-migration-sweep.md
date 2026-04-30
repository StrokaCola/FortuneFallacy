# Star Forge Mod Visuals — Phase 7 (Migration Sweep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the `ff_dieview_central` dev flag and migrate the last `Die3DCSS` production call sites in Forge to `DieView`, so the entire Forge screen uses the unified Three.js rendering path. `Die3DCSS` is kept as the WebGL fallback, never deleted.

**Architecture:** Two small surgical edits to `src-next/app/screens/Forge.tsx`. Remove the dev-flag conditional around the central die — always render `DieView`. Swap the 6-die selector strip's `Die3DCSS` for `DieView` at 56px (orbital satellite is already gated <80px per Phase 3, so it auto-hides). The `Die3DCSS` import + the WebGL-fallback path inside `DieView` remain untouched.

**Tech Stack:** TypeScript + React 18 + Three.js 0.169 + Vitest + jsdom. No new dependencies.

**Spec source:** `docs/superpowers/specs/2026-04-29-star-forge-mod-visuals-design.md` — "Implementation Phasing > 7. Migration sweep" + "Verification > Cross-screen consistency".

**Spec correction:** The spec lists "tray + hold strip" as CSS migration targets. The actual codebase renders gameplay tray + hold strip via `src-next/render/three/Dice3D.ts` (a separate Three.js class, not `Die3DCSS`). Those paths were never CSS in this codebase. The only remaining `Die3DCSS` production call sites are the two in `Forge.tsx`. This plan covers exactly those two.

**Phases 1-6 already shipped on `main`.** Reuse: `DieView` (already accepts size + mods + style props), Phase 3 satellite size-gate (<80px hides), Phase 4 geometric variant pass-through.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src-next/app/screens/Forge.tsx` | MODIFY | Two changes: (a) remove `useDieView` flag + the conditional around the central die, always use `DieView`; (b) swap selector-strip `Die3DCSS` → `DieView`. The `Die3DCSS` import is removed since neither call site uses it after this change. |
| `src-next/render/three/DieView.tsx` | UNCHANGED | Already imports `Die3DCSS` for the WebGL-fallback path. That import stays. |
| `src-next/app/visual/Die3DCSS.tsx` | UNCHANGED | Stays as the WebGL-fallback target. Don't delete. |

**Decomposition rationale:** One file, two minimal edits, no new modules. The whole phase is a 10-line cleanup.

**Phase 7 explicitly defers / out of scope:**
- Deleting `Die3DCSS.tsx` — kept indefinitely as the WebGL-fallback path inside `DieView`.
- Touching `Dice3D.ts` (gameplay tray + hold) — already Three.js; not in scope.
- Removing the `ff_dieview_central` flag's storage in localStorage — harmless; old browsers may still have it set.

---

## Task 1: Remove dev flag, always use DieView for central die

**Files:**
- Modify: `src-next/app/screens/Forge.tsx`

The flag was a Phase 1 dev-only A/B switch. With Phases 2-6 shipped + verified, the Three.js path is the production default. Drop the flag check + the `Die3DCSS` branch.

- [ ] **Step 1: Find the existing flag declaration**

In `src-next/app/screens/Forge.tsx`, locate the flag declaration (around line 27-28):

```ts
  const useDieView = typeof window !== 'undefined'
    && window.localStorage.getItem('ff_dieview_central') === '1';
```

Delete those two lines.

- [ ] **Step 2: Find the conditional render block**

Locate the central-die conditional (around line 88-92):

```tsx
          {useDieView ? (
            <DieView face={selectedFace} size={140} style="celestial" mods={selectedMods} />
          ) : (
            <Die3DCSS face={selectedFace} size={140} style="celestial" mods={selectedMods} />
          )}
```

Replace with the single `DieView` line:

```tsx
          <DieView face={selectedFace} size={140} style="celestial" mods={selectedMods} />
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 287/287 still pass. The Forge component renders `DieView` for the central die unconditionally — no test currently asserts on `useDieView`.

- [ ] **Step 4: Commit**

```bash
git add src-next/app/screens/Forge.tsx
git commit -m "refactor(forge): retire ff_dieview_central dev flag — DieView is the default"
```

---

## Task 2: Migrate selector strip Die3DCSS → DieView

**Files:**
- Modify: `src-next/app/screens/Forge.tsx`

The 6-die selector strip currently uses `Die3DCSS` at 56px. `DieView` works at 56px (Phase 3 already gates the orbital satellite <80px so the strip stays clean). After this change, both selector strip and central die use the same renderer — visually consistent.

- [ ] **Step 1: Find the selector strip render**

In `src-next/app/screens/Forge.tsx`, locate the selector strip dice (around line 116):

```tsx
            <Die3DCSS face={d.face} size={56} style="celestial" />
```

Replace with:

```tsx
            <DieView face={d.face} size={56} style="celestial" />
```

- [ ] **Step 2: Remove the now-unused Die3DCSS import**

After the swap, `Die3DCSS` is no longer used anywhere in `Forge.tsx`. Find:

```ts
import { Die3DCSS } from '../visual/Die3DCSS';
import { DieView } from '../../render/three/DieView';
```

Replace with:

```ts
import { DieView } from '../../render/three/DieView';
```

(Run `npx tsc --noEmit` after this — TypeScript will catch any other use of `Die3DCSS` in this file. There shouldn't be any.)

- [ ] **Step 3: Run tests + typecheck**

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: No new errors. The `Die3DCSS` import is removed only from `Forge.tsx`; `DieView.tsx` still imports it for the fallback.

- [ ] **Step 4: Commit**

```bash
git add src-next/app/screens/Forge.tsx
git commit -m "refactor(forge): swap selector strip Die3DCSS → DieView"
```

---

## Task 3: Manual verification + acceptance check

**Acceptance criteria** (from spec — Cross-screen consistency):

- [ ] Forge central die renders via DieView (always, no dev flag).
- [ ] Forge selector strip dice render via DieView at 56px.
- [ ] Same die identity is visible across Forge central + Forge selector strip + gameplay tray + hold strip — no "two different dice" effect.
- [ ] Orbital satellite hides on selector-strip dice (size=56 < 80 threshold).
- [ ] Material mutation flows to selector strip when a mod is attached to a die (gold for Gilded, bronze for Loaded, etc.).
- [ ] WebGL fallback path still works — force-disable WebGL in browser → Forge falls back to `Die3DCSS` for both central + selector strip via `DieView`'s internal fallback.

**Steps:**

- [ ] **Step 1: Start the dev server**

Add a worktree-pointing entry to `.claude/launch.json` if using preview:

```json
{
  "name": "fortune-fallacy-phase7",
  "runtimeExecutable": "cmd.exe",
  "runtimeArgs": ["/c", "cd .worktrees\\star-forge-phase7 && npm run dev -- --port 5174 --strictPort"],
  "port": 5174,
  "autoPort": false
}
```

Then start via `preview_start fortune-fallacy-phase7`. Or `npm run dev` directly from the worktree root.

- [ ] **Step 2: Verify central die uses DieView with no flag**

In the browser console:

```js
window.localStorage.removeItem('ff_dieview_central');
location.reload();
```

(Confirm the flag is no longer needed.)

Open the dev console (`debug` button) → `screen` tab → `forge`.

Confirm:
- The central die at 140px renders via Three.js (richer material, halo on lit pip face, gentle 3D tumble) — same as Phases 1-6 with the flag set.
- No console errors.

- [ ] **Step 3: Verify selector strip dice are now Three.js**

Look at the 6-die selector strip below the central die. Each tile should now render via `DieView` at 56px. Compare to a Phase 6 screenshot (where the strip was still flat CSS) — the strip should now show the same celestial material + edge highlights as the central die, just smaller.

In the browser console:

```js
document.querySelectorAll('[data-die-view]').length
```

Expected: `7` (1 central + 6 selector strip dice).

- [ ] **Step 4: Verify orbital satellite hides on small dice**

Attach 2 mods to die 0 (e.g. Gilded + Sharpened). The central die (140px) should show the orbital satellite (cool steel chip orbiting). The selector strip die for die 0 (56px) should NOT show the orbital — Phase 3's `<80px` size gate hides it. The badge icon in the selector tile (existing system) still indicates the second mod's presence at small size.

Confirm:
- Central die: orbital visible.
- Selector strip die 0: no orbital, but badge icon visible.

- [ ] **Step 5: Verify material flows to selector strip**

Attach Gilded only to die 0. Look at the selector strip — die 0's tile should now render gold (the gilded material). Detach. Tile returns to celestial purple.

Try Loaded → bronze tile. Backstop → jade tile. Confirms material mutation flows through the same DieView path consistently.

- [ ] **Step 6: Verify WebGL fallback**

Force-disable WebGL via DevTools:
1. Open DevTools → ⋮ menu → More tools → Rendering.
2. Tick "Disable WebGL".
3. Reload the page.

Navigate back to the Forge. Confirm:
- Both the central die AND the selector strip dice fall back to the CSS rendering (the existing `Die3DCSS` look — flat 3D, drop shadows, badge icons).
- No console errors.
- The page is otherwise responsive — gameplay still functional (the gameplay path doesn't have a fallback because Phase 1 left `Dice3D.ts` unchanged; that's a known existing limitation).

Re-enable WebGL when done.

- [ ] **Step 7: Run full automated suite**

Run: `npm test`, `npm run build`, `npx tsc --noEmit`.
Expected: tests pass; production build succeeds; no new typecheck errors.

- [ ] **Step 8: No commit needed**

If anything visually surfaces (e.g. selector strip dice feel cluttered with material mutation visible at small sizes; or DOM-canvas alignment issues for many `DieView` instances), tune accordingly. Most likely this is clean — `DieView` was already working at 56px since Phase 1. Otherwise Phase 7 is complete.

---

## Verification (whole phase, automated)

Run from the worktree root:

- [ ] `npm test` → all tests pass (287 expected — Phase 7 adds no tests, only refactors call sites).
- [ ] `npx tsc --noEmit` → no new TypeScript error categories.
- [ ] `npm run build` → production build succeeds.

---

## Out of Scope

- Deleting `src-next/app/visual/Die3DCSS.tsx` — explicitly retained as the WebGL-fallback target inside `DieView`. The Phase 1 spec mandated this.
- Migrating gameplay tray + hold strip rendering — not CSS in this codebase; already `Dice3D.ts`.
- WebGL fallback support for the gameplay (`Dice3D.ts`) path — pre-existing limitation outside Phase 7's scope.
- Removing the `ff_dieview_central` localStorage key proactively from any user storage — harmless if it lingers.

---

## Notes / Open Risks

- **Performance: 7 concurrent DieView instances on the Forge screen.** Phase 1's renderer was provisioned for a worst-case ~12 dice; 7 is well within budget. The selector strip dice are static (no idle tumble difference vs central — they all use the same per-instance rAF), so frame cost should be minimal. Monitor during Step 7 of manual verification.
- **WebGL fallback for selector strip.** With Phase 7's swap, force-disabling WebGL means all 7 Forge dice fall back to `Die3DCSS`. That's correct behavior — the fallback path was always there. But it means a WebGL-disabled user now sees 7 CSS dice in Forge instead of 1 + 6. The render budget is fine (CSS dice are cheap); just noting the visual difference.
- **`DieView` at 56px hides orbital satellite.** Phase 3 gated it. If a future phase wants to *show* per-mod identity at small sizes, the badge icon system in `Die3DCSS` would need to port to `DieView`'s overlay (or sit alongside the canvas). Out of scope here — flag for the next time someone touches selector-strip identity.
- **No Dice3DCSS deletion.** Spec is explicit: keep `Die3DCSS.tsx` as the fallback target. Don't delete the file even though it's no longer called directly from Forge.tsx — `DieView` imports it.
