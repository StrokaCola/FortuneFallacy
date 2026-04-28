# Grounded-Constellation Re-Theme — Design

**Status**: Approved (design phase)
**Date**: 2026-04-28
**Sub-project**: B (of 4 — see decomposition)

## Goal

Strip mystical/divinatory language from Fortune Fallacy and replace it with a grounded, system-driven lexicon. Constellation names stay (Lyra, Orion, Cassiopeia, etc.) but everything else reads like a casual probabilist describing a cosmic simulation, not a wizard casting spells.

## Sibling sub-projects (not in this spec)

This is sub-project **B** of 4. The user listed four polish topics; we decomposed:

1. **B (this spec)** — re-theme.
2. **A** — scoring buildup escalation.
3. **C** — pause screen (audio mixer, title, portal).
4. **D** — modifiers + game juice.

Each gets its own spec → plan → implement cycle. B goes first because the lexicon it locks is referenced by A/C/D copy.

## Design rules (locked)

- **Banned words**: blessing, curse, fate, destiny, omen, invoke, ritual, divination, prophecy, arcane, mystic, sacred, hex, oracle (verb).
- **Preferred lexicon**: pattern, alignment, distribution, probability, resonance, vector, bias, sample, signal, observation.
- **Tone**: casual probabilist — gambler-meets-scientist. Dry, terse. Names favor 1–2 words. Flavor = one short observation or quip.
- **Each effect feels mechanical, not supernatural** — player exploits a cosmic simulation, not casts spells.
- **Constellation names kept** for combos only (Lyra, Cygnus, Orion, etc.). Bosses, consumables, vouchers use *phenomena* names (no constellation prefix).

## Approach

**Aggressive single-sweep rename** (Approach A, locked):

- Rename system-level concepts (Oracle/Rune/Arcanum) AND internal IDs (slice keys, event types, type names, file paths, CSS tokens).
- One spec, one plan. Big PR but coherent — no half-themed window.
- Mostly mechanical find-replace + thoughtful entry rewrites.

## Lexicon decisions

### System renames (player-facing + internal)

| Old | New | Notes |
|-----|-----|-------|
| Oracle | **Catalyst** | Reads as a thing that increases reaction without consumption. State key: `run.catalysts`. |
| Rune | **Mod** | Per-die attached effect. Slot key: `dice[i].mods`. |
| Arcanum | **Anomaly** | Boss numbering: "anomaly NN · ante N". |
| Astral (CSS / hint label) | **Vector** (CSS) / **Tip** (label) | `text-astral` → `text-vector`. "astral hint" → "tip". |
| Tribunal of Stars (Hub) | **Star Atlas** | Cartography metaphor. |
| Star Forge | **Star Forge** (keep) | Mechanical-sounding enough. |
| Begin Ascension | **Begin Ascension** (keep) | Reads as climb, not deity. |
| Codex | **Codex** (keep) | Already grounded. |
| `cosmos-*` Tailwind palette | **`cosmos-*` (keep)** | Astronomy term, color tokens only. |

### Verb sweep

| Banned | Replace |
|--------|---------|
| invoke / ritual | trigger / fire |
| blessing / boon | boost / bonus |
| curse / hex | penalty / drag |
| fate / destiny / fortune (verb) | outcome / trajectory |
| divination / prophecy | reading / forecast / signal |

**Exceptions** (kept as proper nouns / titles, not as mystical verbs):

- "Begin **Ascension**" — Title screen button. Reads as climb/progression.
- "Star Forge" — Forge screen heading. "Forge" = industrial.
- "Codex" — Scores button.

## Entry rewrites

### Combos (constellation-mapped — minor polish)

`src-next/app/hud/ScoreMoment.tsx` `CONSTELLATION_NAMES`:

| combo id | display |
|----------|---------|
| FIVE_KIND | Cygnus |
| FOUR_KIND | Orion |
| FULL_HOUSE | Pegasus |
| THREE_KIND | Auriga |
| LG_STRAIGHT | **Lyra** (was "The Lyre") |
| SM_STRAIGHT | Cassiopeia |
| TWO_PAIR | Gemini |
| ONE_PAIR | Vela |
| CHANCE | Wandering Star |

### Catalysts (was Oracles — `data/oracles.ts` + `core/upgrades/oracles/*`)

| Old | New | Effect (unchanged) | Flavor |
|-----|-----|--------------------|--------|
| The Oracle | **Stratifier** | Full House → Mult ×2 | "Three plus two. The shape pays." |
| Chaos Theory | **Chaos Theory** (keep) | Straights → +5 Mult | "Order from disorder. +5 for the trick." |
| The Prophet | **Six Bias** | Each 6 → +4 Chips | "Instrument loaded. Top of range pays." |
| Fortune's Fool | **Twin Sample** | Two Pair → Chips ×2 | "Both samples agree. Confidence doubled." |
| Silver Tongue | **Cold Hand** | Chance → +4 Mult | "No pattern? The book says you're due. The book is wrong, but you score anyway." |
| Entropy Stone | **Entropy Index** | Each unique face → ×1.25 Mult | "Variety paid in compounding interest." |

Icon polish: 🔮 → 📈 (The Prophet), 🃏 → 🔢 (Fortune's Fool). Other icons (👁, ∞, 💬, ◈) keep — abstract enough.

### Mods (was Runes — `core/runes/index.ts`)

| Old | New | Effect (unchanged) |
|-----|-----|--------------------|
| Amplify | **Amplify** | +2 chips/die |
| Sharpened | **Sharpened** | +1 mult/die |
| Gilded | **Gilded** | +1 shard on score |
| Loaded | **Loaded** | 1→6 face remap |
| Snake Cult | **Snake Eyes** | +2 mult if face=1 |
| High Roller | **High Roller** | +1 mult if face∈{5,6} |
| Blessed | **Backstop** | Min face = 4 |

### Vouchers (`data/vouchers.ts`)

| Old | New | Effect (unchanged) |
|-----|-----|--------------------|
| Astral Plane | **Bench** | +1 catalyst slot |
| Forged Links | **Forged Links** | +1 mod slot per die |
| Shard Streak | **Shard Streak** | +1 shard per cleared blind |

### Consumables (`core/consumables/index.ts`)

Type union renamed: `'tarot' \| 'spectral'` → **`'calibration' \| 'resource'`**.

| Old | New | Type | Effect (unchanged) |
|-----|-----|------|--------------------|
| The Moon ☽ | **Pin Six** | calibration | Set die to 6 |
| The Sun ☀ | **Pin One** | calibration | Set die to 1 |
| Shard Strike | **Shard Drop** | resource | +5 shards |
| The World | **Roll Token** | resource | +1 hand |

### Boss anomalies (`data/blinds.ts`)

| Old | New | Effect (unchanged) |
|-----|-----|--------------------|
| The Serpent | **Floor Lock** | Mods can't transform 1s |
| The Fool | **Sample Cap** | Hand size capped 4 |
| The Tower | **Single Pass** | No rerolls |
| The Devil | **No Hold** | Locks release after roll |
| The High Priestess | **Quiet Field** | Catalysts inert |

**Sigils**: existing tarot SVG paths kept as orphan placeholders with `// TODO art pass — sigil designed for tarot name` comment. Visual mismatch acceptable until later art pass.

## Screens, HUD, vendor lines

### Title (`Title.tsx`)

- Tagline: "◇ a roguelike of dice and divination ◇" → **"◇ the gambler's fallacy, weaponized ◇"**.
- Title, buttons, version line: unchanged.

### Hub (`Hub.tsx`)

- Heading: "The Tribunal of Stars" → **"Star Atlas"**.

### Forge (`Forge.tsx`)

- Sub-tagline: "◇ etch the cosmos ◇" → **"◇ etch a mod ◇"**.
- Heading "The Star Forge" kept.

### Shop (`Shop.tsx`)

- Sub-tagline: "◇ between the stars ◇" → **"◇ exchange ◇"**.

### HUD strings

| File | Old | New |
|------|-----|-----|
| `AstralHint.tsx` label | "◇ astral hint" | **"◇ tip"** |
| `AstralHint.tsx` body | "...form a constellation — your scoring pattern." | **"Click any die to lock for the next roll. Highlighted dice mark the scoring pattern — Lyra, Orion, etc."** |
| `BossReveal.tsx` | "arcanum NN · ante N" | **"anomaly NN · ante N"** |
| `OracleStrip.tsx` filename + labels | "Oracle*" | **`CatalystStrip.tsx`** + "Catalyst" labels |

### Vendor lines (`data/vendor-lines.ts`)

```ts
catalyst: [
  "Bias the curve.",
  "Hot tip — the catalyst remembers.",
  "Tilt the table. Quietly.",
],
voucher: [
  "Brass tokens. Bureaucratic. Useful.",
  "Permit's good through end of run.",
],
consumable: [
  "Single use. Plan twice.",
  "Spend it once. Spend it well.",
],
default: [
  "House doesn't refund.",
],
```

(Replaces "Read the stars, traveler", "the void weighs nothing", etc. Keys: `oracle` key in `LINES` record renamed to `catalyst`.)

## Code rename map

### File renames

| Old | New |
|-----|-----|
| `src-next/data/oracles.ts` | `src-next/data/catalysts.ts` |
| `src-next/core/upgrades/oracles/` | `src-next/core/upgrades/catalysts/` |
| `…/oracles/theOracle.ts` | `…/catalysts/stratifier.ts` |
| `…/oracles/chaosTheory.ts` | `…/catalysts/chaosTheory.ts` |
| `…/oracles/prophet.ts` | `…/catalysts/sixBias.ts` |
| `…/oracles/foolsFortune.ts` | `…/catalysts/twinSample.ts` |
| `…/oracles/silverTongue.ts` | `…/catalysts/coldHand.ts` |
| `…/oracles/entropyStone.ts` | `…/catalysts/entropyIndex.ts` |
| `src-next/core/runes/` | `src-next/core/mods/` |
| `src-next/core/upgrades/runes/` | `src-next/core/upgrades/mods/` |
| `src-next/app/hud/OracleStrip.tsx` | `src-next/app/hud/CatalystStrip.tsx` |
| `src-next/actions/handlers/oracle.ts` | `src-next/actions/handlers/catalyst.ts` |

Use `git mv` so rename history is preserved.

### Type renames

| Old | New |
|-----|-----|
| `OracleMeta` | `CatalystMeta` |
| `RuneDef` | `ModDef` |
| `RUNES` const | `MODS` |
| `MAX_RUNE_SLOTS` | `MAX_MOD_SLOTS` |
| `lookupOracle` / `lookupRune` | `lookupCatalyst` / `lookupMod` |
| `applyFaceRemaps`'s `diceRunes` param | `diceMods` |
| Consumable type union | `'calibration' \| 'resource'` |

### ID renames

| Surface | Old → New |
|---------|-----------|
| Catalyst ids | `the_oracle`→`stratifier`, `prophet`→`six_bias`, `fools_fortune`→`twin_sample`, `silver_tongue`→`cold_hand`, `entropy_stone`→`entropy_index` (chaos_theory unchanged) |
| Mod ids | `snake_cult`→`snake_eyes`, `blessed`→`backstop` |
| Voucher ids | `astral_plane`→`bench` |
| Consumable ids | `the_moon`→`pin_six`, `the_sun`→`pin_one`, `shard_strike`→`shard_drop`, `the_world`→`roll_token` |
| Boss ids | `the_serpent`→`floor_lock`, `the_fool`→`sample_cap`, `the_tower`→`single_pass`, `the_devil`→`no_hold`, `the_high_priestess`→`quiet_field` |
| Boss debuff strings | `disable_oracles`→`disable_catalysts`, `no_rune_transforms_on_ones`→`no_mod_transforms_on_ones` |

### State slice keys (`state/slices/run.ts`)

- `run.oracles: string[]` → `run.catalysts: string[]`
- `dice[i].runes: string[]` → `dice[i].mods: string[]`

### Event + action types (`events/types.ts`, `actions/types.ts`, `dispatch.ts`)

- `ORACLE_*` events/actions → `CATALYST_*`
- `RUNE_*` events/actions → `MOD_*`
- `INVOKE_ORACLE` (if exists) → `TRIGGER_CATALYST`

### CSS / Tailwind

- `tailwind.config.ts`: `astral` color key → `vector` (hex unchanged).
- `text-astral` / `bg-astral` / `ring-astral` usages → `*-vector` (find-replace).
- `cosmos-*` palette: keep.

## Save migration

**Strategy**: real migrator (not nuke).

- Bump save schema version: `v` → `v+1`.
- On load, if `version < new`, run migrator before validation:
  - Map `state.run.oracles[]` → `state.run.catalysts[]` with id remap.
  - Map `state.run.dice[*].runes[]` → `state.run.dice[*].mods[]` with id remap.
  - Remap consumable `type` field (`tarot`→`calibration`, `spectral`→`resource`) and ids.
  - Remap voucher ids and boss ids.
- Migrator file: `src-next/state/migrations/v{N}_retheme.ts` (or wherever migrations live — verify in plan).
- Unit test: round-trip a fixture old-save through migrator → assert new shape.
- Migrator stays for ~3 releases, then drop with comment.

## Tests to update

- `src-next/core/scoring/constellationChain.test.ts` — comments only (no behavior change).
- Any `lookupOracle` / `lookupRune` test → `lookupCatalyst` / `lookupMod`.
- `useScoreSequence.test.ts`, `adapter.test.ts`, `detectCombo.test.ts` — verify unaffected.
- New: save-migrator unit test.

## Non-goals

- Combo display polish beyond "The Lyre" → "Lyra".
- Color hex value changes.
- Mechanics, scoring numbers, balance.
- `cosmos-*` palette name.
- Game title, "Begin Ascension", "Star Forge", "Codex".
- Multiplayer/Portal protocol.
- Scoring sequence + audio (sub-project A).
- Pause screen (sub-project C).
- New modifiers/juice (sub-project D).
- Sigil art polish — orphan tarot SVGs kept with TODO comments.

## Risks + mitigations

| Risk | Mitigation |
|------|-----------|
| Find-replace collision: "rune" / "oracle" / "astral" in unrelated contexts | Word-boundary regex per rename; manual review of each match; build runs before commit |
| "Mod" collides with `mod`-as-modulo or import paths | Use `Mod` PascalCase for type, `mods` lowercase for state key; verify no `% mod %` math collisions |
| CSS token rename broad blast | Single tailwind config swap + global find-replace; visual smoke test post-build |
| Save migrator bug → corrupt save | Unit test with fixture; load failure falls back to fresh state |
| Boss SVG sigils visually mismatched with new names | Accepted; flagged as TODO art pass; orthogonal to this spec |
| Hot-reload mid-migration breaks dev sessions | Document "clear localStorage on first run after merge"; migrator covers this anyway |
| Sub-project A (scoring) refers to combo strings — already constellation-named | Verify in plan; no expected impact |
| Online leaderboard payload may include old ids (`online/leaderboard.ts`) | Verify in plan whether stored payloads need migration or just write path |

## Acceptance criteria

- No occurrence of banned words in `src-next/` outside dev-only comments.
- All player-facing strings match locked lexicon.
- All renamed file paths use `git mv` with history preserved.
- Save migrator round-trips a v-old fixture cleanly (unit test green).
- `npm run build` + `npm run test` + `npm run dev` smoke green.
- Visual sweep on Title / Hub / Forge / Shop / Round / Win / Codex screens — no orphan old strings.
