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

All assets use the cosmos backdrop (`#07051a`) so they read identically
against the game's own dark-mode chrome.

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
