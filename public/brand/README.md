# FortuneFallacy brand kit

Standalone SVG assets generated from the canonical game data in
`src-next/data/`. Regenerate any time the underlying boss / constellation
data changes:

```bash
npx tsx scripts/extract-brand.ts
```

## Contents

| File                              | Source                                              |
|-----------------------------------|-----------------------------------------------------|
| `wordmark.svg`                    | Hand-authored (Cinzel Decorative 900 + Exo 2 tag) |
| `mark.svg`                        | Hand-authored (d6 silhouette on cosmos disc)      |
| `boss-<id>.svg` (×8)              | `BOSS_BLINDS[*].sigil` in `src-next/data/blinds.ts` |
| `constellation-<id>.svg` (×8)     | `CONSTELLATIONS[*].glyph` in `src-next/data/constellations.ts` |
| `catalysts/<id>.svg` (×68)        | JSX renderers in `src-next/data/catalystIcons.tsx` |
| `mods/<id>.svg` (×18)             | JSX renderers in `src-next/data/modIcons.tsx`     |

All assets use the cosmos backdrop (`#07051a`) so they read identically
against the game's own dark-mode chrome.

The `catalysts/` and `mods/` sigils are the same line-art glyphs the
in-game `<CatalystIcon>` / `<ModIcon>` components render — pulled out as
standalone files so the press kit, og:image variants, achievement
art, and social-share cards can compose them without a React runtime.
Each is tinted with the catalyst/mod's canonical accent colour from
`data/catalysts.ts` and `core/mods/index.ts`.

## Where to use

- **Open Graph / Twitter share images** — `wordmark.svg` or `mark.svg`.
  Convert to PNG via `inkscape --export-type=png --export-width=1200 wordmark.svg`.
- **Boss reveal preview cards** — `boss-<id>.svg` is the same sigil
  shape rendered in-game; pre-rasterising for social posts saves
  rendering cost.
- **Discord / Bluesky avatars** — `mark.svg` is square-aspect at 128×128.
- **Press kit** — bundle the whole `public/brand/` directory as the
  assets folder.
- **Steam capsule reference** — the wordmark + mark are the starting
  point; Steam capsules need higher-fidelity art for the eventual
  launch, but the typography choices and palette anchor here.

## Licence

Same as the parent project — MIT (see `/LICENSE`). The Cinzel + Exo 2
fonts referenced in `wordmark.svg` are SIL Open Font Licence (covered
by the Google Fonts terms).
