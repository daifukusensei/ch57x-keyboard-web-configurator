#!/bin/sh
# Regenerates test/fixtures/{upstream,fork}-oracle.txt by running the patched
# Rust oracle harnesses (needs cargo). Run scripts/fetch-refs.sh first.
set -eu
cd "$(dirname "$0")/.."
F="$PWD/test/fixtures"

run() { # repo actions-file prefix out-file
  ( cd "refs/$1" && ORACLE_ACTIONS="$F/$2" cargo test --quiet oracle::dump -- --nocapture 2>/dev/null ) \
    | grep "^$3|" > "$F/$4.tmp"
  [ -s "$F/$4.tmp" ] || { echo "no $3| lines from $1" >&2; rm -f "$F/$4.tmp"; exit 1; }
  mv "$F/$4.tmp" "$F/$4"; echo "wrote test/fixtures/$4 ($(wc -l < "$F/$4") lines)"
}

run ch57x-keyboard-tool           upstream-actions.txt ORACLE upstream-oracle.txt
run ch57x-keyboard-tool-enhanced  fork-actions.txt     FORK   fork-oracle.txt
