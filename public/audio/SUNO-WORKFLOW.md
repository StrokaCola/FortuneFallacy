# Suno Workflow — Fortune Fallacy Music

The music in `public/audio/` was generated via [Suno](https://suno.com/),
mixed in a DAW, and exported as the WAV stems Howler loads at runtime.
This document captures the exact prompts and steps so the same source-of-
truth can regenerate or extend the soundtrack later.

> **Note:** the WAV stems are the *fallback* format. Run
> `bash scripts/encode-audio.sh` to generate the matching `.opus` files;
> Howler prefers the Opus source via the source-array fallback in
> `src-next/audio/AudioEngine.ts` and `src-next/audio/ScreenMusic.ts`.
> Shipping both keeps Safari (which lacks reliable Opus support) playable.

---

## Round adaptive stems

The four round-music stems (`base-loop`, `combo-loop`, `peak-loop`,
`fail-loop`) are the same song rendered with different layer mixes. They
play in sync, looped, with their volumes crossfaded by the round's
`score / target` ratio (see `audio/AudioEngine.ts:53`).

### Primary song (base / combo / peak)

- **Suno prompt:**
  ```
  TODO: paste the exact prompt used for the primary round song
  ```
- **Suno song URL:** `TODO: link`
- **Generation selected:** `TODO: which take (e.g. take 2 of 4)`
- **BPM:** `TODO`
- **Key:** `TODO`
- **Length:** `TODO sec`

### Fail layer

- **Suno prompt:**
  ```
  TODO: paste the exact prompt used for the fail layer
  ```
- **Suno song URL:** `TODO: link`
- **Generation selected:** `TODO`

---

## Per-screen tracks

Each non-round screen has its own loop. Suno generation details below.

### Title (`title-loop.wav`)
- **Prompt:** `TODO`
- **URL:** `TODO`

### Hub (`hub-loop.wav`)
- **Prompt:** `TODO`
- **URL:** `TODO`

### Shop (`shop-loop.wav`)
- **Prompt:** `TODO`
- **URL:** `TODO`

### Forge (`forge-loop.wav`)
- **Prompt:** `TODO`
- **URL:** `TODO`

### Boss (`boss-loop.wav`)
- **Prompt:** `TODO`
- **URL:** `TODO`

---

## DAW mixdown

The Suno generations land as full songs; for the four adaptive stems they
were exported as separate mixes (each layer rendered at unity, the others
muted) so the runtime crossfade lines up.

- **DAW:** `TODO (Logic / Reaper / Ableton / …)`
- **Sample rate / bit depth:** `TODO (e.g. 44.1 kHz / 24-bit)`
- **BPM-grid setup:** `TODO — describe how the loops were trimmed to align`
- **Trim points:** `TODO — start/end markers per stem`
- **Render settings:** `TODO — WAV / format / dither / normalisation`

---

## Encoding to Opus for shipping

Once new WAVs land, run:

```bash
bash scripts/encode-audio.sh
```

This invokes ffmpeg with `-c:a libopus -b:a 96k -vbr on -compression_level 10`
and writes `*.opus` next to each `*.wav`. Both files ship in `public/audio/`;
the runtime picks Opus when supported, falls back to WAV elsewhere.

Expected size reduction: **~10-15× smaller** (`~98 MB` WAV → `~7 MB` Opus
at the time of writing). Re-encode whenever a stem is regenerated.

---

## Adding a new music track

1. Generate the source via Suno (or your DAW).
2. Render the WAV into `public/audio/<name>.wav`.
3. If it's a per-screen track, register the filename in `audio/ScreenMusic.ts`
   under `TRACK_FILES`.
4. Run `bash scripts/encode-audio.sh` to produce the matching `.opus`.
5. Document the prompt + generation details in this file (so future-you
   can regenerate from the same starting point).
6. Commit both `.wav` and `.opus` together.
