# Dice Score Animations

_Started 2026-04-27 01:18 UTC_

---

## User

What sort of Animations and particle effects can we create for scoring the dice? keep the constellation theme.

## Assistant

I'll explore the project first to understand the constellation theme and current state before proposing animations.

_[tool: list_files]_

_[tool: local_ls]_

_[tool: read_file]_

_[tool: read_file]_

Now let me look at the existing screens to understand current scoring layout/context.

_[tool: read_file]_

_[tool: grep]_

I have enough context. The user wants animation/particle ideas for dice scoring — keeping the constellation theme. Let me build a single explorer page that demonstrates 8 distinct effects, each triggerable, so they can compare. I'll set up a focused exploration file.

_[tool: read_file]_

I have plenty to work with already — no need to access the local folder. Let me build a dedicated scoring FX explorer.

_[tool: update_todos]_

_[tool: snip]_

I'll write a focused exploration page that shows 8 distinct constellation-themed scoring effects side-by-side, each replayable. The effects will all use the existing palette (`--astral`, `--gold`, `--ember`, `--cosmos-*`) and the existing `Die` component so they feel native to the game.

_[tool: write_file]_

_[tool: snip]_

_[tool: write_file]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

Built **Scoring FX.html** — a catalog page with 8 distinct constellation-themed scoring effects, each replayable.

**The eight effects:**

1. **Constellation Bloom** *(medium)* — concentric shock rings + 14 radial pip-stars. Default per-die scoring pulse.
2. **Zodiac Sigil** *(medium)* — a rotating 8-point rune draws around the die. For rune-marked dice.
3. **Pip Liftoff** *(medium)* — each pip detaches as a star and rises with a glowing trail. Reads the chip contribution literally.
4. **Comet Trail** *(high)* — a comet streaks past, impacts the die, scatters sparks. Oracle/consumable triggers.
5. **Orbit Lock** *(medium)* — 8 stars orbit the die then collapse to its center. "Locked into the constellation."
6. **Score Vault** *(low)* — the +chips numeral rises on a column of sparks with a satellite ×mult tag.
7. **Astral Shatter** *(high)* — diamond shards burst outward + dual shock rings. Save for 5-of-a-kind / large straight.
8. **Constellation Stamp** *(low)* — faint zodiac imprint behind the die, drawn line-by-line. Ambient, won't spam at 5-dice scoring.

**How to read the catalog:** intensity tags (low/medium/high) suggest layering — use one *low* on every scoring die, escalate to a *medium* on combo confirm, and reserve one *high* for the final scoring die or big-tier combos. Mixing all eight at once would drown the screen.

**Controls:** "Play All" replays every effect simultaneously; "Stagger All" plays them in sequence so you can compare side-by-side.

Each effect lives as a tiny React component in `scoring-fx.jsx` exported via `SCORING_FX` — easy to drop into the round screen by replacing the `+f` text node currently rendered above scoring dice.

**Next steps:** tell me which 1–3 you'd like to keep, and I'll wire them into the actual Round screen with proper trigger logic (per-die delay, combo-tier escalation, cleanup).

## User

make them more celestial

## Assistant

_[tool: snip]_

I'll push the effects deeper into the celestial register — more sigil geometry, twinkle, prismatic light, slower orbit, gold/violet/astral layering, less "particle pop" and more "starlight."

_[tool: read_file]_

_[tool: snip]_

I'll rewrite the effects file to push every animation into a richer celestial register: 4-pointed star sparkles, prismatic auras, slow zodiac wheels, gold/astral/violet layering, longer durations, twinkle and shimmer rather than punchy bursts.

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

Pushed every effect deeper into the celestial register. The big shifts:

**New shared primitives** (in `scoring-fx.jsx`):
- `SparkleStar` — 4-pointed star with prismatic radial gradient. This replaces all the round particle dots from the previous pass.
- `Rosette` — 6-petal sigil glyph used as the "ignition" core inside several effects.
- `ZodiacRing` — 12-house astrolabe ring with gold cardinal ticks, used as background geometry.

**Per-effect changes:**
1. **Constellation Bloom** — added a rotating prismatic conic-gradient aura (astral→violet→gold), tinted the three shock rings differently, swapped round particles for 12 sparkle stars in mixed gold/astral/violet.
2. **Zodiac Sigil** — full 12-house astrolabe rotates in, second counter-rotating inner ring underneath, gold rosette ignites at center, 12 cardinal ticks twinkle in sequence around the rim.
3. **Pip Liftoff** — pips rise as rotating 4-pt sparkle stars (alternating astral/gold) with tapering trails and trailing micro-star satellites.
4. **Comet Trail** — replaced the straight diagonal bar with a curving SVG path (quadratic bezier) that draws across the stage; head explodes into a large gold sparkle with afterglow; impact debris is now scattered sparkle stars.
5. **Orbit Lock** — 12 multi-color orbiters at varied radii, dual halos (solid + gold dashed), rosette ignites at the moment of collapse.
6. **Score Vault** — rising sparkle-star column instead of plain bars, gold/cosmos dust shower beneath the die, baseline gold shimmer.
7. **Astral Shatter** — rosette ignites at impact; shards are sparkle stars (gold/astral/ember mix), not diamonds; lingering gold dust drift.
8. **Constellation Stamp** — slow background zodiac wheel underneath the constellation lines; nodes twinkle on as the line reaches them; gold "anchor" star at the start of the path.

Durations stretched a touch (most effects ~1100–1700ms now) so the celestial language has room to read instead of flashing past.

