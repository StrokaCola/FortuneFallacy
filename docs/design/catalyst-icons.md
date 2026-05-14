# Catalyst icon system

Studio review's Art Direction dept (Dept 5) flagged the catalyst grid
as visually inconsistent across operating systems: ~10 catalysts
shipped with TRUE emoji icons (👁 📈 🔢 💬 🔔 🌑 🍀 🎼 ⏳ 💠) that
render differently on every OS. Mac users saw Apple Color Emoji,
Windows users saw Segoe UI Emoji, Android users saw Noto Color
Emoji. The visual identity was at the mercy of the player's OS.

This system replaces those emojis with hand-authored line-art SVG
sigils while keeping the migration **incremental** — the catalyst
data file (`data/catalysts.ts`) still ships an `icon` char that
serves as the fallback when no SVG renderer is registered.

## Architecture

```
src-next/data/catalystIcons.tsx       Registry: catalyst-id → SVG renderer.
src-next/app/visual/CatalystIcon.tsx  Consumer component. Picks SVG > fallback.
```

`CATALYST_ICON_SVGS` maps a catalyst id to a `(color, size) => ReactNode`
function that returns the SVG. The component checks the registry on
every render; if a renderer exists, it renders the SVG; otherwise it
renders the catalyst's existing `icon` char in the supplied color.

## Style guide

All renderers follow the same conventions so the catalyst grid reads
as one set:

- `viewBox="0 0 24 24"` — square, density tuned for 16-32 px sizes
- `fill="none"` + `stroke={color}` + `strokeWidth=1.5`
- `strokeLinecap="round"` + `strokeLinejoin="round"` — matches the
  thin-stroke esoteric / alchemy / celestial line-art register the
  studio review described
- Symmetric where possible (eye, hourglass, bell, diamond, four-leaf
  clover) — matches the boss sigil set in `data/blinds.ts`
- Filled accents only for emphasis (eye pupil + die pips). Most lines
  are open strokes to keep the silhouette legible at small sizes

When in doubt, look at the boss sigils in `BOSS_BLINDS[*].sigil` and
match their visual density.

## Adding a new sigil

```tsx
// In src-next/data/catalystIcons.tsx, add to CATALYST_ICON_SVGS:
foo_bar: (color, size) => (
  <svg {...baseSvgProps(color, size)}>
    {/* paths go here */}
  </svg>
),
```

`baseSvgProps` already supplies the viewBox / stroke / linecap. Just
add the path data.

The change is shipped — every consumer (CatalystCard in the strip,
OfferCard in the shop, CollectionPanel sell-row, Codex catalyst
grid) will pick up the new SVG on next render.

## Currently registered (10 of 89)

| Catalyst | Was | Now |
|---|---|---|
| Stratifier | 👁 (eye emoji) | Almond eye + 5 dots in 3-over-2 (full-house ref) |
| Six Bias | 📈 (chart emoji) | d6 face + upward arrow |
| Twin Sample | 🔢 (numbers emoji) | Two adjacent dice |
| Cold Hand | 💬 (speech emoji) | Speech plaque with text lines |
| Last Throw | 🔔 (bell emoji) | Closer's bell silhouette |
| Patience Counter | ⏳ (hourglass emoji) | Thin hourglass with sand |
| Stipend | 💠 (diamond emoji) | Concentric diamonds w/ pip |
| Lucky Streak | 🍀 (clover emoji) | 4-leaf clover w/ stem |
| Eclipse Pact | 🌑 (moon emoji) | Solar eclipse (sun + moon overlap) |
| Lyric Pulse | 🎼 (musical score emoji) | Eighth note + sound wave |

## Why not ALL 89?

The other 79 catalysts use Unicode dingbats (∆ ◈ ★ ✦ ⊚ ⌗ etc.) that
render consistently across systems. The visual identity is fine
already; replacing them gains little and costs ~30 hours of design
work. Future passes can register new SVGs incrementally as design
bandwidth allows — the migration system supports per-catalyst
opt-in without touching the data file.

## Related work

- `data/blinds.ts` — boss sigils. Same procedural-SVG-as-data
  pattern; the catalyst icons match its visual register.
- `public/brand/` — `extract-brand.ts` writes standalone SVG files
  for the boss sigils + constellation glyphs. A future pass could
  extract the catalyst icons too.
- `docs/company-review-2026-05-13.md` Dept 5 — original studio
  review finding.
