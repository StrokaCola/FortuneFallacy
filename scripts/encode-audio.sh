#!/usr/bin/env bash
# scripts/encode-audio.sh — convert public/audio/*.wav → *.opus.
#
# Why: WAV music beds are ~98 MB total. Opus 96 kbps is perceptually
# transparent for game music and ships at ~7 MB total. Howler picks the
# .opus source first via the source-array fallback in AudioEngine.ts /
# ScreenMusic.ts; .wav files stay in the repo as a Safari fallback.
#
# Usage:
#   bash scripts/encode-audio.sh
#
# Requires: ffmpeg with libopus support (most distro builds).
#   macOS:   brew install ffmpeg
#   Debian:  sudo apt-get install ffmpeg
#   Win:     scoop install ffmpeg
#
# Re-run any time the WAV stems change. Safe to re-run; existing .opus
# files are overwritten in place.
set -euo pipefail

cd "$(dirname "$0")/.."
AUDIO_DIR="public/audio"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "error: ffmpeg not found on PATH" >&2
  exit 1
fi

shopt -s nullglob
wavs=( "${AUDIO_DIR}"/*.wav )
if (( ${#wavs[@]} == 0 )); then
  echo "no .wav files in ${AUDIO_DIR}" >&2
  exit 1
fi

total_in=0
total_out=0
for wav in "${wavs[@]}"; do
  base="${wav%.wav}"
  opus="${base}.opus"
  echo "encoding $(basename "$wav") → $(basename "$opus")"
  ffmpeg -loglevel error -y -i "$wav" -c:a libopus -b:a 96k -vbr on -compression_level 10 "$opus"
  in_bytes=$(wc -c < "$wav")
  out_bytes=$(wc -c < "$opus")
  total_in=$(( total_in + in_bytes ))
  total_out=$(( total_out + out_bytes ))
done

human() {
  local bytes=$1
  if (( bytes >= 1048576 )); then
    awk -v b="$bytes" 'BEGIN { printf "%.1f MB", b / 1048576 }'
  else
    awk -v b="$bytes" 'BEGIN { printf "%.0f KB", b / 1024 }'
  fi
}

ratio=$(awk -v a="$total_in" -v b="$total_out" 'BEGIN { if (b == 0) print "n/a"; else printf "%.1fx", a / b }')
echo
echo "done: $(human "$total_in") wav → $(human "$total_out") opus  (${ratio} reduction)"
echo "commit the new .opus files alongside the .wav stems."
