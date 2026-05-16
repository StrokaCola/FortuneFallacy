# FortuneFallacy2 — Catalyst Card Illustration System Brief

A composable illustration system for the 71+ catalyst (upgrade) card library. The artist delivers a small set of reusable **layers**; the engine composites those layers into ~1,100 unique card states across (8 archetypes × 4 rarities × 4 editions). No per-catalyst paintings — system work first, optional bespoke portraits later, scoped separately.

> **For art-director review** — open the editorial HTML render at [`public/brand/catalyst-card-system-brief.html`](../public/brand/catalyst-card-system-brief.html). Served during dev at `http://localhost:5173/FortuneFallacy/brand/catalyst-card-system-brief.html` (Vite `base: '/FortuneFallacy/'`). Live composited sample cards per archetype + rarity + edition (foil sweep, holo prism, poly faceted-crystal lattice, void event-horizon with breathing rim glow) — pulled from the same CSS animations + SVG glyphs the live game uses. Click-to-copy hex swatches per archetype. The markdown below is canonical; the HTML is a viewing + spec-validation layer.

Authored: 2026-05-16. Canonical source data:
- [`src-next/data/catalysts.ts`](../src-next/data/catalysts.ts) — `CATALYST_META`, archetype + rarity tags, identity colors
- [`src-next/state/slices/run.ts`](../src-next/state/slices/run.ts) — `CatalystEdition` semantics (foil = +chips, holo = +mult, poly = ×own, void = zero-slot)
- [`src-next/app/hud/catalystStrip/CatalystCard.tsx`](../src-next/app/hud/catalystStrip/CatalystCard.tsx) — strip-card render path
- [`src-next/app/screens/shop/OfferCard.tsx`](../src-next/app/screens/shop/OfferCard.tsx) — shop-card render path
- [`public/brand/catalysts/`](../public/brand/catalysts) — 67 existing line-art SVG glyphs
- [`src-next/styles/index.css`](../src-next/styles/index.css) lines 1203-1342 — current `.ff-surface-{foil,holo,poly,void}` CSS the painted overlays will replace
- [`docs/boss-illustration-brief.md`](./boss-illustration-brief.md) — voice + anti-mystical style continuity

---

## Shared Style Bible

Read this once. Every brief below assumes it. Inherits the boss brief's rules — repeating the load-bearing ones plus card-specific additions.

- **Period reference**: scientific-instrument plates meets 60s industrial design catalog meets the Voyager Golden Record. Think the panel diagrams from a 1970s spectrometer manual, redrawn with the gravity of a museum plaque. **No mysticism, no occult symbology, no tarot, no robed figures, no spells.** Catalysts are objects you could hold.
- **Every catalyst is an instrument or artifact, never a creature or spell**. A lens, a gauge, a ferromagnetic shard, a calibration weight, a phase diagram, a sample under glass. If the artist's gut reach is "what creature personifies this mechanic" — that is the wrong gut.
- **Readability at 64×88 strip-card size**: the silhouette + frame + edition treatment must hold at the smallest in-game size. If the player can't tell a Common-Common from a Legendary-Void at thumbnail, the system has failed. Test every layer at 64×88 before signing it off at 240×320.
- **Palette discipline**: each catalyst ships with an identity color (in `CATALYST_META`). The painted layers must accept that identity color as a *tint pass* — provide grayscale base maps the engine can multiply through the per-catalyst hue. The card is **70% catalyst-color anchored + 20% archetype band tint + 10% rarity/edition accent**. The artist paints in neutral grayscale, the engine tints.
- **Layered, not flat**: every asset ships as a layered PSD with named layer groups (`base`, `highlight`, `shadow`, `animatable-sweep`, etc.) so the engine can isolate animated parts (foil sweep band, poly lattice rotation, void aurora bleed) without re-compositing the whole card.
- **Line economy carries over from the boss brief**: where ornament IS used (rarity frames, legendary cartouches), it should feel *engraved* on instrument metal — not drawn, not flourished. Brass-plate engraving, not calligraphy.
- **Aurora-violet underlight at the card edge** — the same `#9577ff` rim glow from the boss brief carries here. Every card sits inside the same cosmos; the rim glow is the visual rhyme.

---

## Card Anatomy

Back-to-front layer order. Each layer marked *artist-owns* or *engine-composites*.

```
┌──────────────────────────────────────────┐
│   ╔══════════════════════════════════╗   │   ← Rarity Frame  [artist-owns]
│   ║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║   │   ← Archetype Band [artist-owns]
│   ║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ║   │   ← Edition Overlay [artist-owns]
│   ║                                  ║   │
│   ║          ✦  GLYPH  ✦            ║   │   ← Catalyst Glyph SVG [artist-owns]
│   ║                                  ║   │
│   ║          NAME                    ║   │   ← Catalyst Name [engine: f-mono]
│   ║       desc · flavor              ║   │
│   ╚══════════════════════════════════╝   │
│ [sell ◇]                  [+stack badge] │   ← State Badges    [engine-composites]
└──────────────────────────────────────────┘
```

| Layer | Owner | Notes |
|---|---|---|
| Aurora rim glow | engine | CSS box-shadow on the outermost wrapper. Always on. |
| Rarity frame | **artist** | 9-slice scalable PNG, one per rarity. |
| Archetype band | **artist** | Tileable grayscale background pattern, one per archetype. Tinted by the engine using the catalyst's identity color. |
| Edition overlay | **artist** | Surface treatment painting, one per edition kind. Replaces the existing CSS in `index.css`. |
| Catalyst glyph | **artist** | Line-art SVG, per-catalyst. 67 shipped; 4+ missing (bone_tax, hollow_bishop, witchs_bargain + any future). |
| Catalyst name + desc text | engine | Cinzel + Exo 2 typography, already wired. |
| Sell button | engine | Existing component, positioned at top-left. |
| Stack badges | engine | Existing `CornerBadge` (recently bumped to 12px gold-glow). |
| Pulse / fire animation | engine | The painted frame must leave a 4px breathing margin inside the outer rim glow so the pulse class can scale up cleanly without clipping. |

**Critical**: rarity frame and edition overlay are SEPARATE layers. A legendary card can be foil OR holo OR poly OR void OR plain — every combination must read correctly when the engine stacks Legendary-frame + Foil-overlay + (any catalyst's) glyph.

---

## Archetype Visual Language

Nine archetypes. Each gets a paragraph defining the *motif vocabulary* — what shapes, materials, and patterns the archetype band paints. The artist paints **one** background plate per archetype in grayscale; per-catalyst identity color tints it at composite time.

### combo
Interlocking modular geometry — overlapping hexagons, gear teeth, locking joints. The motif is *parts that fit together*. Visual reads as "this catalyst keys off a shape." Mid-saturation, balanced composition. Refs: Bauhaus weaving studies, Bridget Riley's Op-Art interlocks (the grid pieces, not the hallucinatory bits).

### face
Calibration plates with engraved numeric scales. Vernier dials, slide-rule markings, pip-pattern stamps. The motif is *number made physical*. Tone is precise, instrumental. Refs: vintage navigation sextant inner mechanisms, scientific micrometer faces.

### economy
Burnished brass coins, weighing-scale balance arms, escapement gears (the metering kind, not clockwork-fantasy). The motif is *measured exchange*. Tone is warm-metal, mercantile but not opulent. Refs: 19th-century apothecary scales, the Royal Mint coin-press dies.

### scaling
Stratified geological layers, sedimentary cross-sections, tree-ring growth bands, glacial ice cores. The motif is *time made visible*. Tone is patient, accreted, cool-violet undertone. Refs: Smithsonian rock-stratigraphy plates, Andy Goldsworthy's layered-stone earthworks (cross-section view).

### mods
Wiring diagrams, signal-routing schematics, ferromagnetic field lines. The motif is *connection paths between dice*. Tone is technical-electrical, faint phosphor-green undertone allowed (the only archetype that gets a non-standard tonal hint). Refs: vintage telephone-exchange patch-board cards, Schlieren photography of airflow.

### timing
Metronome arms, escapement teeth, the literal mechanism of a wound spring. The motif is *the pause between beats*. Tone is brass + cool shadow, tightly contained. Refs: inside view of a mechanical metronome, the regulator wheel of a marine chronometer.

### utility
Toolbox cross-sections, swiss-army-knife internals, kit roll-outs. The motif is *useful object at hand*. Tone is unobtrusive, workshop-neutral, mid-grey. Refs: the cutaway diagrams in vintage Whole Earth Catalog, James May's *Toy Stories* diagrams.

### collision
Impact diagrams, vector arrows, shockwave ripples in solids (not water). The motif is *the moment two objects meet*. Tone is high-contrast, bright leading edge + dark trailing. Refs: high-speed photography of bullet impacts in gelatin, Newton's-cradle frame-by-frame.

### risk
Exposed fault lines, structural fissures, jagged crystalline cleavage planes, hairline fractures in obsidian. The motif is *the visible cost*. The player should feel the downside *before* reading the description. Tone is darker than the rest of the set — the risk archetype is the only one allowed to dim the catalyst's identity color, not amplify it. Refs: cleaved feldspar geological samples, structural-failure photography from civil engineering textbooks.

---

## Rarity Frame Set

Four frame variants. Each is a 9-slice scalable PNG, painted at 240×320 (Codex size, largest target) and tested down to 64×88 (strip size). The engine wraps any catalyst in any frame.

### Common
Thin engraved-edge border in muted graphite. Single-pixel inner light line + single-pixel outer shadow. Reads as "competent baseline, nothing special." No corner ornament. Frame thickness ≤6px at strip scale.

### Uncommon
Stepped frame with one inset metallic accent (copper-oxide or dim bronze). Two-tier edge — inner step engraved, outer step plain. One small notched detail at the top-center, like a brass nameplate marker. Frame thickness ~8px at strip scale.

### Rare
Ornate triple-step frame with corner sigils — small engraved geometric marks at the four corners (NOT mystical sigils — geometric calibration marks like the registration crosshairs on a printing plate). A faint aurora glow channel runs inside the inner edge — give the engine a 2px translucent band it can color-cycle slowly. Frame thickness ~10px at strip scale.

### Legendary
Full ornate frame with continuous gold-leaf trim, four bespoke corner pieces (each unique — not four copies of one design), and a **bottom cartouche** sized to hold the catalyst's name in Cinzel at 12px. The cartouche is the painted plate the engine writes the name into.

Legendary is also where the `LegendaryFlourish` micro-animation hooks live. Animation timing:
- **Idle loop**: 3-5s slow shimmer along the gold-leaf trim
- **Fire pulse**: ~600ms scale-up + brief secondary glow when the catalyst fires

Leave a 6px breathing margin inside the gold trim so the fire pulse can scale the frame ~108% without clipping the outer aurora rim.

Frame thickness ~14px at strip scale. The visual difference between Rare and Legendary must be readable at thumbnail — players will compare them side-by-side in the shop offer row.

---

## Edition Overlay Paintings

Four high-fidelity overlays that **replace** the existing CSS-only treatments in `src-next/styles/index.css` (lines 1203–1342). Each shipped at 360×500 minimum (1.5× the offer-card size for downsample headroom), layered PSD with animatable elements isolated on named layers.

### Foil (+chips when fires)
Brushed-gold metal sheet with a static diagonal grain. The painted base is the **non-animated** layer — fine brushed-metal texture that holds up under engine-cycled specular sweep. On a separate layer, paint the **sweep highlight**: a soft-edged diagonal band the engine animates across the surface every 4.2s. Color: warm gold `#f5c451` highlight on `#8b6f2c` brushed base. NO emoji-shiny mirror finish — this is a *worked metal* surface, not chrome.

### Holo (+mult when fires)
Prismatic refraction grid — paint a base diffraction pattern (think the actual grating pattern on a CD's data side, not a rainbow sticker). Layer five specular hot-spots at curated positions across the surface, painted as small bright dots with soft halos. The engine cycles the gradient hue underneath; the painted spots provide *anchor points* that the cycling color refracts around. The painted version must hold up regardless of which hue the engine has cycled to.

### Poly (×own contribution when fires)
Faceted crystalline interference pattern. Paint a triangular shard lattice — overlapping triangles of varying size, each with subtle internal gradient suggesting refraction. The engine rotates this layer slowly underneath (~26s/rotation). The artist paints the lattice as a single rotating-tileable layer at 1.5× card size so rotation doesn't expose edges.

### Void (zero slot cost — rarest, build-defining)
**Painted hero of the four.** This is the most build-defining edition; the visual must justify the rarity. Paint a dense, hand-placed starfield — not procedural noise. Hundreds of stars at varying sizes and brightnesses, with deliberate clusters and voids. At the center, an event-horizon shape: a near-circular zone where stars are sparser and a faint aurora-violet bleed emerges from inside. The card surface should read as a **window into deep space**, not a tinted gradient.

Animatable layers (isolate these in the PSD):
- The aurora bleed at center (engine pulses 3.6s ease-in-out)
- 5-7 designated "twinkling" stars that the engine fades in/out

Static layers (do NOT animate):
- The starfield itself — players will notice if stars drift
- The event-horizon dark zone

Void is the only edition where the artist's painted layer should feel like it has **depth** — every other edition is a surface treatment; this one is a hole.

---

## Per-Catalyst Illustration Tier (Stretch — Scoped Separately)

Optional follow-on deliverable. Five confirmed legendary catalysts get a *bespoke painted portrait* that lives BEHIND the standard glyph in the legendary card render. The portrait reads through the legendary frame's interior — the glyph stays in the foreground.

Catalysts in scope (id from `CATALYST_META` where `rarity === 'legendary'`):
1. **All-Band** — every archetype tag at once. Portrait: a calibration plate showing all 9 archetype motifs reduced to instrument-panel icons, arranged like a control board.
2. **Recursion Lens** — the catalyst that fires twice. Portrait: a lens stack viewed edge-on, the back element showing the front element's reflection showing the back element's reflection. Mise-en-abyme without ornament.
3. **Royal Flush** — the legendary combo enabler. Portrait: a brass straightedge with five aligned markers, the lattice of an interference pattern overlaid.
4. **Eclipse Pact** — unlocked on Eclipse constellation. Portrait: an annular eclipse photograph cross-sectioned, showing the corona's structure as engraved layers.
5. **Heirloom Locket** — cross-run carryover scaling. Portrait: a sealed metal capsule with a single hairline seam, suggesting something *inside* but never opened.

**Note**: the original ask mentioned "Crown" and "Resonance" — confirmed these are MODS, not catalysts. They live under the same kind-frame system but ship on a separate brief (mods get their own pass after catalyst system is locked).

**Pricing**: each portrait priced individually. Recommend delivering Eclipse Pact + Heirloom Locket first as the calibration pair; their motifs are most visually distinct from the procedural fallback.

---

## Icon Style Continuation

Existing 67 SVG glyphs at `public/brand/catalysts/*.svg` define the baseline. Document the style with 5 rules so missing glyphs (bone_tax, hollow_bishop, witchs_bargain, plus any future additions) match:

1. **viewBox**: `0 0 24 24`. No exceptions. The KindFrame component sizes from this assumption.
2. **Stroke**: monoline, weight 1.5–2.0 SVG units. No variable-weight strokes. No gradients. No fills except for filled "punctuation" elements (small dots, hard centers — used sparingly).
3. **Fill rules**: stroke-only by default. A glyph may have one filled dot or shape as an emphasis point (see `iron_six.svg` for the canonical example). No glyph should have more than ~30% filled area.
4. **Complexity ceiling**: maximum 6 path elements per glyph. If a concept needs more, the icon has failed and the concept should be re-framed. Reference `stratifier.svg`, `lodestone.svg`, `usurer.svg` for the upper bound.
5. **Color**: paths use `stroke="currentColor"` and `fill="currentColor"` ONLY. Tinting happens at the React layer via the catalyst's identity color. Never embed a literal hex value in the SVG.

For the 4 missing glyphs:
- `bone_tax`: a small balance scale with one pan tipped down; the down-pan contains a single fractured cube. Filled emphasis on the fracture line.
- `hollow_bishop`: a chess-bishop silhouette in stroke only, with the upper third hollowed out. Filled emphasis on a single small dot inside the hollow.
- `witchs_bargain`: a transaction-tally symbol (a brass coin and a notched mark side-by-side). No witch imagery. Filled emphasis on the notch.

---

## Combinatorics QA Matrix

Before signing off the system, the artist returns 4 flat PNG composites at 180×250 (offer-card size) proving the layers stack cleanly:

| # | Catalyst | Archetype Band | Rarity Frame | Edition Overlay | Glyph |
|---|---|---|---|---|---|
| 1 | Stipend | economy (brass scales) | Common | none | `stipend.svg` |
| 2 | Triplet Engine | combo (interlocks) | Rare | none | `triplet_engine.svg` |
| 3 | Heirloom Locket | scaling (strata) | Legendary | none | (placeholder ✦) |
| 4 | Stratifier | combo (interlocks) | Rare | Void | `stratifier.svg` |

QA criteria for each composite:
- Catalyst identity color visibly tints the archetype band without overwhelming it
- The rarity frame reads correctly without the edition overlay (composite 1, 2, 3)
- The edition overlay reads correctly when stacked with the rarity frame (composite 4)
- The glyph stays foreground-readable in all 4 compositions
- The sample names render in the legendary cartouche cleanly (composite 3)

If any composite fails any criterion, the underlying layer needs revision — not the composite.

---

## Delivery Checklist

Filename conventions:
- Rarity frames: `frame-{common,uncommon,rare,legendary}.png` + `.psd`
- Edition overlays: `edition-{foil,holo,poly,void}.png` + `.psd`
- Archetype bands: `archetype-{combo,face,economy,scaling,mods,timing,utility,collision,risk}-band.png` + `.psd`
- Missing glyphs: `{catalyst_id}.svg` in `public/brand/catalysts/`
- QA composites: `qa-composite-{1,2,3,4}.png`

Specs:
- Color profile: sRGB
- All PNGs transparent background where applicable
- Frames + bands: painted at 240×320 (largest target), 9-slice metadata documented in a sidecar `.txt` per frame
- Editions: painted at 360×500
- Source files: layered PSD with named layer groups (no flat exports — the engine needs the layered version for the animatable parts)

**Calibration-pair sequencing**:
1. Deliver **Common-Frame** + **Foil-Overlay** + **economy-band** + the QA composite #1 (Stipend / Common / Economy / no edition) as the first calibration pair. This is the cheapest combination; if these three layers don't composite cleanly, no other pairing will.
2. Sign-off on calibration pair before painting the remaining 3 frames + 3 overlays + 8 bands.
3. Legendary + Void ship LAST. They're the most labor-intensive and the most likely to need iteration after the lower tiers are calibrated.

**Timeline target**: 1 week for calibration pair, 4–6 weeks for full system. Bespoke legendary portraits (stretch tier) priced + scheduled separately after the system ships.

---

## What This Does NOT Cover

Out of scope for this brief — handled elsewhere or by different roles:

- **Animation timing** — engineer's job. The brief specifies *where* in the asset the animation hooks live (foil sweep band, poly lattice rotation, void aurora pulse, legendary fire pulse) but the artist does not deliver motion. The engine drives every animation; the painted asset is the *frame*, not the *film*.
- **Per-catalyst portraits at scale (71+)** — explicitly out. Only the 5 legendary catalysts get bespoke portraits, and even those are a stretch deliverable priced separately. The other 66 catalysts inherit their visual identity from (archetype band × rarity frame × edition overlay × line-art glyph). This is the whole point of the composable system.
- **Cosmetic-shop skin variants** — separate brief. The cosmetic system (Aurora Sigils palette, Solar Flare particles, Aurora Lyra constellation skin) handles palette swaps at the cosmetic layer; the catalyst card system delivers the *base* art that cosmetics later remix. Don't paint cosmetic variants here.
- **Mod cards** — separate brief. Mods (Crown, Resonance, Pip Charge, Loaded, Tally Mark, etc.) share the kind-frame system at the React level but ship with their own archetype + rarity treatment after catalyst lands.
- **Voucher / consumable / pack cards** — out. Those have different anatomy (no archetype band, no edition system) and ship their own pass.
- **Catalyst icon redesigns** — only the 4 missing glyphs are in scope. The existing 67 are LOCKED. Do not propose stylistic revisions to glyphs that already shipped.
- **Frame redesigns at the React-component level** — the engine's existing `KindFrame` outer hexagonal silhouette stays. The painted rarity frames live INSIDE that hexagonal stroke, not replacing it.

---

*This brief assumes the artist is fluent in scientific-instrument illustration + industrial-design plate work. If their portfolio is fantasy character art or trading-card creature illustration, route to a different artist — the brief is intentionally hostile to anthropomorphic or mystical interpretation. The shop is a workshop. The catalyst is a tool. The card is the tool's data sheet.*
