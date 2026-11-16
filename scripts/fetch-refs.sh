#!/bin/sh
# Clones the three reference implementations into refs/ (git-ignored) at the
# revisions the editor was verified against, and applies the oracle harness
# patches to the two Rust repos. Safe to re-run.
#
#   refs/ch57x-keyboard-tool           upstream (authority for YAML + protocol)
#   refs/ch57x-keyboard-tool-enhanced  the fork (514c:8850 12-key protocol)
#   refs/ch57x-programmer              TypeScript reference (bundled into test/reference/ref.cjs)
set -eu
cd "$(dirname "$0")/.."
mkdir -p refs

fetch() { # repo sha [patch]
  dir="refs/$(basename "$1")"
  [ -d "$dir/.git" ] || git clone -q "https://github.com/$1.git" "$dir"
  git -C "$dir" checkout -q --force "$2"
  git -C "$dir" clean -qfd
  if [ -n "${3:-}" ]; then git -C "$dir" apply "$PWD/patches/$3"; fi
  echo "$dir @ $(git -C "$dir" rev-parse --short HEAD)${3:+ + $3}"
}

fetch kriomant/ch57x-keyboard-tool              bdbffca368f2084fbd111bc64463b881cd7c8fee upstream-oracle-harness.patch
fetch daifukusensei/ch57x-keyboard-tool-enhanced fa28f1978f6284cddc5a7a3daad8a5ba9a782008 fork-oracle-harness.patch
fetch PollRobots/ch57x-programmer               355e40f0a0cc3df2f62e28652daeac2cd97ec76a
