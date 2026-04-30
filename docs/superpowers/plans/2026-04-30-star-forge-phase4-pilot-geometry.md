# Star Forge Mod Visuals — Phase 4 (Pilot Geometry Tweaks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply small, theme-coherent geometric mutations to the die's mesh for the three pilot mods — Loaded (asymmetric mass), Backstop (plated rim), Pip Charge (recessed pips).

**Architecture:** `buildDie` gains an optional `geometricVariant?: 'asymmetric' | 'plated' | 'recessed'` parameter. Each variant flips a single knob: ASYMMETRIC nudges +Y face vertices inward to create a weighted bowl, PLATED enlarges the RoundedBoxGeometry chamfer for a softer ceramic profile, RECESSED pushes pip orbs deeper. `DieView` looks up the primary mod's `visual.geometricVariant` and threads it through. Plus: lift the `resolveMod` helper from `DieView` (currently duplicated) into `core/mods/index.ts` as Phase 3 review's deferred cleanup.

**Tech Stack:** TypeScript + React 18 + Three.js 0.169 + Vitest + jsdom. No new dependencies.

**Spec source:** `docs/superpowers/specs/2026-04-29-star-forge-mod-visuals-design.md` — specifically the geometricVariant column in Section "Per-Mod Idle Material" and the "Pilot geometry" subsection of Verification.

**Phases 1+2+3 already shipped on `main`.** Reuse: `webglDetect`, `buildDie`, `sharedRenderer`, `DieView`, `MOD_MATERIALS`, `ModDef.visual` (already includes `geometricVariant`), `orbitalSatellite`, `rimOverlay`. Phase 2 wired `buildDie`'s 3rd parameter (`modOverride`); Phase 4 adds the 4th.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src-next/core/mods/index.ts` | MODIFY | Export new helper `resolveMod({ id?, name }) → ModDef \| undefined` (id-preferred, name-fallback). Existing API unchanged. |
| `src-next/core/mods/index.test.ts` | MODIFY | Add tests for `resolveMod`: id wins over name; name fallback works when id absent; undefined input returns undefined. |
| `src-next/render/three/DieView.tsx` | MODIFY | Replace 2 inline lookup chains with `resolveMod(...)` calls. Thread `matchedMod?.visual?.geometricVariant` into `buildDie` as the new 4th argument. |
| `src-next/render/three/DieView.test.tsx` | MODIFY | Add a test verifying the geometricVariant flows through to buildDie. |
| `src-next/render/three/buildDie.ts` | MODIFY | Add 4th parameter `geometricVariant?: GeometricVariant`. Apply chamfer change (plated), vertex bow (asymmetric), pip-depth change (recessed). Export the type. |
| `src-next/render/three/buildDie.test.ts` | MODIFY | Add 3 tests — one per variant — that observe an inspectable side-effect: chamfer radius for plated, max-Y vertex displacement for asymmetric, first orb's z-position for recessed. |

**Decomposition rationale:** `resolveMod` is pure data utility — belongs alongside `lookupMod` in `core/mods`. The 3 geometric variants share one parameter and one factory entry-point — keeping them in `buildDie` avoids fragmenting the mesh factory into N files. Tests pin observable side-effects (geometry params, orb position) rather than rendered visuals — visual quality is verified manually in Task 4.

**Phase 4 explicitly defers:**
- Trigger FX (Phase 5+6).
- CSS dice migration (Phase 7).
- Tuning the magnitude of the geometric tweaks beyond first-pass values — opportunistic follow-up after manual verification.

---

## Task 1: Lift `resolveMod` helper to core/mods

**Files:**
- Modify: `src-next/core/mods/index.ts`
- Modify: `src-next/core/mods/index.test.ts`

- [ ] **Step 1: Write the failing test**

In `src-next/core/mods/index.test.ts`, add a new `describe` block at the bottom (after the existing `MODS visual contract` describe):

```ts
import { resolveMod } from './index';

describe('resolveMod', () => {
  it('returns undefined for undefined input', () => {
    expect(resolveMod(undefined)).toBeUndefined();
  });

  it('prefers id when both id and name are provided', () => {
    // Name says one mod, id says another — id should win.
    const r = resolveMod({ id: 'gilded', name: 'Renamed' });
    expect(r?.id).toBe('gilded');
  });

  it('falls back to name (case-insensitive) when id is absent', () => {
    const r = resolveMod({ name: 'sharpened' });
    expect(r?.id).toBe('sharpened');
  });

  it('falls back to name when id refers to no known mod', () => {
    const r = resolveMod({ id: 'nonexistent' as never, name: 'Loaded' });
    expect(r?.id).toBe('loaded');
  });

  it('returns undefined when neither id nor name resolves', () => {
    const r = resolveMod({ name: 'no-such-mod' });
    expect(r).toBeUndefined();
  });
});
```

Add the corresponding import at the top of the test file:

```ts
import { resolveMod } from './index';
```

(Note: if there's already an `import { ... } from './index';` line, append `resolveMod` to that import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/core/mods/index.test.ts`
Expected: FAIL — `resolveMod` is not exported.

- [ ] **Step 3: Add `resolveMod` to `src-next/core/mods/index.ts`**

After the existing `lookupMod` function (around line 101), add:

```ts
/**
 * Resolve a DieMod-shaped object (typically `{ id, name, ... }`) to its full
 * `ModDef`. Prefers stable `id` lookup; falls back to case-insensitive name
 * match if `id` is absent or doesn't resolve. Used by `DieView` to look up
 * primary/secondary/tertiary mods consistently.
 */
export function resolveMod(
  m: { id?: ModId; name: string } | undefined,
): ModDef | undefined {
  if (!m) return undefined;
  return (m.id ? MODS.find((mm) => mm.id === m.id) : undefined)
    ?? MODS.find((mm) => mm.name.toLowerCase() === m.name.toLowerCase());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/core/mods/index.test.ts`
Expected: PASS, 5 new tests in addition to the existing ones.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: All tests pass (263 expected: 258 baseline + 5 new resolveMod tests).

- [ ] **Step 6: Commit**

```bash
git add src-next/core/mods/index.ts src-next/core/mods/index.test.ts
git commit -m "feat(mods): add resolveMod helper (id-preferred, name-fallback)"
```

---

## Task 2: DieView consumes `resolveMod`

**Files:**
- Modify: `src-next/render/three/DieView.tsx`

This task does NOT add new tests — the existing 8 DieView tests already lock the resolved-mod behavior at both the primary lookup (Phase 2) and the secondary/tertiary lookup (Phase 3). Replacing the inline chains with the shared helper is a pure refactor.

- [ ] **Step 1: Update import**

In `src-next/render/three/DieView.tsx`, find:

```ts
import { MODS } from '../../core/mods';
```

Replace with:

```ts
import { MODS, resolveMod } from '../../core/mods';
```

- [ ] **Step 2: Replace primary lookup**

Find the existing primary lookup block (Phase 2/3 left this in place):

```ts
    // Phase 3: lookup by id (preferred) with name fallback for backward
    // compatibility. Secondary/tertiary mods get orbital satellite + rim-band
    // (built later in this effect — Phase 3 task 4).
    const firstMod = props.mods?.[0];
    const matchedMod = firstMod
      ? (firstMod.id ? MODS.find((m) => m.id === firstMod.id) : undefined)
        ?? MODS.find((m) => m.name.toLowerCase() === firstMod.name.toLowerCase())
      : undefined;
```

Replace with:

```ts
    // Phase 4: primary mod material + optional geometric variant. Secondary
    // and tertiary mods (orbital satellite + rim-band) are built below.
    const matchedMod = resolveMod(props.mods?.[0]);
```

- [ ] **Step 3: Replace inline `resolveMod` helper for secondary/tertiary**

Find the existing block (Phase 3):

```ts
    // Resolve the secondary + tertiary mod definitions (if present) the same
    // way as primary — id preferred, name fallback.
    function resolveMod(m: DieMod | undefined) {
      if (!m) return undefined;
      return (m.id ? MODS.find((mm) => mm.id === m.id) : undefined)
        ?? MODS.find((mm) => mm.name.toLowerCase() === m.name.toLowerCase());
    }
    const secondary = resolveMod(props.mods?.[1]);
    const tertiary = resolveMod(props.mods?.[2]);
```

Replace with:

```ts
    const secondary = resolveMod(props.mods?.[1]);
    const tertiary = resolveMod(props.mods?.[2]);
```

(The inline function is gone — both calls now go through the imported helper.)

- [ ] **Step 4: Remove now-unused `MODS` import**

Check if `MODS` is still referenced anywhere in `DieView.tsx` after the replacements. It probably isn't (the inline lookups were the only direct uses). If unused, change the import to drop it:

```ts
import { resolveMod } from '../../core/mods';
```

(If TypeScript flags a different unused import, drop that one instead. Run `npx tsc --noEmit` to catch it.)

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: All 263 tests pass — DieView's 8 tests still cover the lookup behavior.

Run: `npx tsc --noEmit`
Expected: No new error categories.

- [ ] **Step 6: Commit**

```bash
git add src-next/render/three/DieView.tsx
git commit -m "refactor(render): DieView consumes resolveMod from core/mods"
```

---

## Task 3: Extend `buildDie` with `geometricVariant`

**Files:**
- Modify: `src-next/render/three/buildDie.ts`
- Modify: `src-next/render/three/buildDie.test.ts`

**Design:**
- Add `GeometricVariant` type union and 4th parameter to `buildDie`.
- PLATED: chamfer = `size * 0.26` instead of `size * 0.18`.
- ASYMMETRIC: after vertex-color computation, walk position attribute; for vertices on the +Y face (those with `y > size * 0.45`), nudge them downward by up to `size * 0.025` weighted by how far they are above the threshold.
- RECESSED: orbDepth = `size * 0.16` instead of `size * 0.10`.
- All other paths (pips, edges, halos) untouched.

- [ ] **Step 1: Write failing tests (additive — keep existing 7 tests)**

Add these 3 tests to `src-next/render/three/buildDie.test.ts` inside the existing `describe('buildDie', () => { ... })` block, after the existing tests:

```ts
  it("plated variant uses a larger RoundedBoxGeometry chamfer radius", () => {
    const baseline = buildDie(0.85, 'celestial');
    const plated = buildDie(0.85, 'celestial', undefined, 'plated');
    const baseBody = baseline.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    const platedBody = plated.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    // RoundedBoxGeometry stores its radius parameter on .parameters.radius.
    const baseRadius = (baseBody.geometry as any).parameters.radius as number;
    const platedRadius = (platedBody.geometry as any).parameters.radius as number;
    expect(platedRadius).toBeGreaterThan(baseRadius);
    expect(platedRadius).toBeCloseTo(0.85 * 0.26, 4);
  });

  it("asymmetric variant nudges +Y face vertices inward", () => {
    const baseline = buildDie(0.85, 'celestial');
    const asym = buildDie(0.85, 'celestial', undefined, 'asymmetric');
    const baseBody = baseline.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    const asymBody = asym.group.children.find((c: { name: string }) => c.name === 'Body') as THREE.Mesh;
    const basePos = baseBody.geometry.attributes.position!;
    const asymPos = asymBody.geometry.attributes.position!;
    // Find the maximum Y across all vertices for each. Asymmetric should have
    // a smaller max-Y because the +Y face was nudged inward.
    let baseMaxY = -Infinity;
    let asymMaxY = -Infinity;
    for (let i = 0; i < basePos.count; i++) baseMaxY = Math.max(baseMaxY, basePos.getY(i));
    for (let i = 0; i < asymPos.count; i++) asymMaxY = Math.max(asymMaxY, asymPos.getY(i));
    expect(asymMaxY).toBeLessThan(baseMaxY);
    // The displacement should be subtle — at most ~5% of die size below the
    // baseline's max-Y. (Spec calls for "subtle, not exaggerated".)
    expect(baseMaxY - asymMaxY).toBeLessThan(0.85 * 0.05);
  });

  it("recessed variant places pip orbs deeper inside the body", () => {
    const baseline = buildDie(0.85, 'celestial');
    const recessed = buildDie(0.85, 'celestial', undefined, 'recessed');
    // First face's first pip has the orb mesh at index 0 within its faceGroup.
    // We can grab it via pipGroup.children[0].children[0].
    const baseFirstFaceGroup = baseline.pipGroup.children[0]!;
    const recFirstFaceGroup = recessed.pipGroup.children[0]!;
    const baseOrb = baseFirstFaceGroup.children[0] as THREE.Mesh;
    const recOrb = recFirstFaceGroup.children[0] as THREE.Mesh;
    // Orb is sunk along local -Z; smaller (more negative) z = deeper.
    expect(recOrb.position.z).toBeLessThan(baseOrb.position.z);
    // Recessed should match `size * 0.16` exactly.
    expect(recOrb.position.z).toBeCloseTo(-0.85 * 0.16, 4);
    // Baseline should match `size * 0.10`.
    expect(baseOrb.position.z).toBeCloseTo(-0.85 * 0.10, 4);
  });
```

- [ ] **Step 2: Run test to verify the 3 new tests fail**

Run: `npm test -- src-next/render/three/buildDie.test.ts`
Expected: 3 of the new tests fail (function doesn't accept a 4th parameter; geometry is identical regardless).

- [ ] **Step 3: Modify `buildDie.ts`**

(a) Add the type export. After the existing `StyleDef` declaration block (around line 7), find the end of the `StyleDef` and `STYLES` exports. Then before `export const PIPS`, insert:

```ts
export type GeometricVariant = 'asymmetric' | 'plated' | 'recessed';
```

(Position it near the other exported types; if you prefer, put it right after `StyleDef`. The test file imports it indirectly through `buildDie`; making it a named export keeps the API discoverable.)

(b) Change the `buildDie` signature. Find:

```ts
export function buildDie(
  size: number,
  styleKey: StyleKey,
  modOverride?: ModMaterialOverride,
): BuiltDie {
```

Replace with:

```ts
export function buildDie(
  size: number,
  styleKey: StyleKey,
  modOverride?: ModMaterialOverride,
  geometricVariant?: GeometricVariant,
): BuiltDie {
```

(c) Apply PLATED chamfer change. Find:

```ts
  const bodyGeo = new RoundedBoxGeometry(size, size, size, 8, size * 0.18);
```

Replace with:

```ts
  // Plated variant: bigger chamfer hints at a ceramic-plate softness.
  const chamfer = size * (geometricVariant === 'plated' ? 0.26 : 0.18);
  const bodyGeo = new RoundedBoxGeometry(size, size, size, 8, chamfer);
```

(d) Apply ASYMMETRIC vertex bow. After the vertex-color loop (find `bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));`), insert a new block:

```ts
  // Asymmetric variant (Loaded): nudge +Y face vertices inward to create a
  // visible weighted-mass bowl. Subtle — the spec calls for "subtle, not
  // exaggerated" so the displacement is gated and capped at ~3% of size.
  if (geometricVariant === 'asymmetric') {
    const threshold = size * 0.45;
    const maxBow = size * 0.03;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > threshold) {
        const t = Math.min(1, (y - threshold) / (size / 2 - threshold));
        pos.setY(i, y - maxBow * t);
      }
    }
    pos.needsUpdate = true;
  }
```

(e) Apply RECESSED orb depth. Find:

```ts
  const half = size / 2;
  const pipR = size * 0.075;
  const orbDepth = size * 0.10;
  const surfaceOut = size * 0.0015;
```

Replace with:

```ts
  const half = size / 2;
  const pipR = size * 0.075;
  // Recessed variant (Pip Charge): orbs sit deeper, looking like contact points.
  const orbDepth = size * (geometricVariant === 'recessed' ? 0.16 : 0.10);
  const surfaceOut = size * 0.0015;
```

(All other code in `buildDie` stays unchanged — pip placement loop, halo, edges, materials.)

- [ ] **Step 4: Run test to verify all tests pass**

Run: `npm test -- src-next/render/three/buildDie.test.ts`
Expected: PASS, 10 tests (7 existing + 3 new).

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: All tests pass (266 expected: 263 baseline + 3 new).

Run: `npx tsc --noEmit`
Expected: No new error categories.

- [ ] **Step 6: Commit**

```bash
git add src-next/render/three/buildDie.ts src-next/render/three/buildDie.test.ts
git commit -m "feat(render): buildDie accepts geometricVariant — plated/asymmetric/recessed"
```

---

## Task 4: Wire `geometricVariant` into DieView

**Files:**
- Modify: `src-next/render/three/DieView.tsx`
- Modify: `src-next/render/three/DieView.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src-next/render/three/DieView.test.tsx`, add this test inside the existing `describe('DieView', () => { ... })`:

```ts
  it("threads the primary mod's geometricVariant into buildDie", () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const spy = vi.spyOn(buildDieMod, 'buildDie');
    // Loaded mod has visual.geometricVariant = 'asymmetric' per Phase 2 wiring.
    const mods = [{ id: 'loaded' as const, icon: '⚔', name: 'Loaded', color: '#c87a4a' }];
    const { unmount } = render(<DieView size={140} face={1} mods={mods} />);
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    // 4th argument is the geometricVariant.
    expect(lastCall[3]).toBe('asymmetric');
    unmount();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/DieView.test.tsx`
Expected: FAIL — `lastCall[3]` is `undefined` (DieView only passes 3 args today).

- [ ] **Step 3: Modify `DieView.tsx`**

Find the existing `buildDie` call (after the primary mod resolution):

```ts
    const modKey = matchedMod?.visual?.materialKey;
    const modOverride = modKey ? MOD_MATERIALS[modKey] : undefined;
    const built = buildDieMod.buildDie(0.85, style, modOverride);
```

Replace with:

```ts
    const modKey = matchedMod?.visual?.materialKey;
    const modOverride = modKey ? MOD_MATERIALS[modKey] : undefined;
    const geometricVariant = matchedMod?.visual?.geometricVariant;
    const built = buildDieMod.buildDie(0.85, style, modOverride, geometricVariant);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/DieView.test.tsx`
Expected: PASS — 9 tests now (8 prior + 1 new).

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: All tests pass (267 expected: 266 baseline + 1 new DieView).

Run: `npx tsc --noEmit`
Expected: No new error categories.

- [ ] **Step 6: Commit**

```bash
git add src-next/render/three/DieView.tsx src-next/render/three/DieView.test.tsx
git commit -m "feat(render): DieView threads primary mod's geometricVariant into buildDie"
```

---

## Task 5: Manual verification + acceptance check

**Acceptance criteria** (from spec — Pilot geometry):

- [ ] Loaded die: weighted face visible from rotation. Subtle, not exaggerated.
- [ ] Backstop die: rim plate visibly thicker than baseline.
- [ ] Pip Charge die: pips visibly recessed.
- [ ] Other 7 mods + 5 base styles unchanged.

**Steps:**

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` from the worktree (or via `preview_start` if using the harness — note: launch.json may need a worktree-pointing entry like Phase 1+2+3).
Expected: Vite dev server prints a localhost URL.

- [ ] **Step 2: Toggle the dev flag and reach Forge**

In the browser console:

```js
window.localStorage.setItem('ff_dieview_central', '1');
location.reload();
```

Open the dev console (`debug` button), click `screen` tab, click `forge`. Confirm DieView renders the central die at 140px.

- [ ] **Step 3: Test Loaded (asymmetric)**

Click `Loaded` in the codex (4th row). Watch the central die.

Confirm:
- Body material is bronze (Phase 2 wiring intact).
- The die's top face (+Y, the face-1 face) appears subtly bowed/sunken vs the other faces. The idle tumble rotation should expose the asymmetry.
- The displacement is subtle — not a dent or crater, just a hint of weighted mass.

- [ ] **Step 4: Test Backstop (plated)**

Detach Loaded. Click `Backstop` (7th row). Watch the central die.

Confirm:
- Body material is matte ceramic green.
- Corner edges look noticeably more rounded vs the celestial baseline (compare against a no-mod state).
- The die reads as "softer" or "ceramic" — the larger chamfer should be visible at 140px.

- [ ] **Step 5: Test Pip Charge (recessed)**

Detach Backstop. Click `Pip Charge` (8th row). Watch the lit pip on the visible face.

Confirm:
- Body material is dark glassy with amber accent.
- The lit pip's emissive orb sits visibly deeper inside the body — the glow is partially shrouded by the surface lens, looking like a recessed contact point.
- Compare against a non-pilot mod (e.g. Snake Eyes) — its pip should sit at the standard depth.

- [ ] **Step 6: Regression check — non-pilot mods + base styles**

Detach all mods. Confirm celestial baseline matches Phase 3 screenshots (no geometric mutation).

Attach a non-pilot mod (e.g. Sharpened, Gilded, or Mirror Pair). Confirm the body material changes per Phase 2 but the geometry is still the standard rounded box (no chamfer change, no vertex bow, no recessed pips).

- [ ] **Step 7: Run full automated suite**

Run: `npm test`, `npm run build`, `npx tsc --noEmit`.
Expected: tests pass; production build succeeds; no new typecheck errors.

- [ ] **Step 8: No commit needed**

If any tweak surfaced (e.g. asymmetric bow too aggressive, plated chamfer too subtle, recessed orb invisible), fix the magic number in `buildDie.ts` and commit separately:

```bash
git add src-next/render/three/buildDie.ts
git commit -m "tune(render): adjust <variant> magnitude — <one-line reason>"
```

Otherwise Phase 4 is complete.

---

## Verification (whole phase, automated)

Run from the worktree root:

- [ ] `npm test` → all tests pass (existing 258 + 5 resolveMod + 3 buildDie + 1 DieView = **267 expected**).
- [ ] `npx tsc --noEmit` → no new TypeScript error categories.
- [ ] `npm run build` → production build succeeds.

---

## Out of Scope (later phases)

- Generic pulse + pilot trigger phenomena (Phase 5+6).
- CSS dice migration to Three.js (Phase 7).
- Tuning the magnitude of any geometric tweak beyond first-pass values — opportunistic follow-up after Task 5 manual verification.

---

## Notes / Open Risks

- **Asymmetric and the idle tumble.** The DieView's idle tumble rotates the entire die. The asymmetric bow on +Y will sometimes face the camera and sometimes not. That's actually the point — the spec says "weighted face visible *from rotation*". If the bow doesn't read clearly during a few seconds of tumble, increase the `maxBow` constant from `0.03` to `0.04` or `0.05`.
- **Plated and the secondary-mod rim-overlay (Phase 3).** The Phase 3 rim-overlay is a torus welded just outside the die's body radius. Plated's larger chamfer rounds the die corners but doesn't change the body's *equator radius* (RoundedBoxGeometry's `width / height / depth` are unchanged). So the Phase 3 rim still hugs the equator correctly — the two effects coexist without z-fighting.
- **Recessed and the surface lens.** The lens disc sits at `surfaceOut = size * 0.0015` (very nearly flush with the face). With the orb at `size * 0.16` deep instead of `size * 0.10`, the orb is now further from the lens — the emissive glow should still refract through the body's transmission, but it'll be a touch dimmer at the surface. If it looks too dim during verification, raise the `emissiveIntensity` for `pip_charge` in `MOD_MATERIALS` (currently `1.5`).
- **`pos.needsUpdate = true` is required after vertex displacement.** The asymmetric block sets it; without it Three.js's GPU upload would not see the change. Verified inline in the implementation block.
- **`RoundedBoxGeometry.parameters.radius`.** This is an undocumented detail of the addon, but inspecting the source confirms it stores constructor params. The plated test relies on this. If it ever breaks, the test would need to switch to inspecting bounding-box dimensions instead.
