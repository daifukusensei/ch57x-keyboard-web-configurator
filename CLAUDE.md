# CH57x Keyboard Web Configurator

Single-file web editor and WebHID uploader for [kriomant/ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool) YAML mappings.
The deliverable `ch57x-keyboard-web-configurator.html` is **built** from `src/`; never edit it by hand.

## Commands
```sh
npm ci
npm run build    # src/ -> ch57x-keyboard-web-configurator.html; commit both together
npm run check    # fails if the committed HTML is stale (CI)
npm test         # all test/*.cjs against the built HTML; one suite: node test/<name>.cjs [html]
npm run fetch-refs && sh scripts/regen-oracles.sh   # reference repos -> refs/, Rust oracles (needs cargo)
node scripts/shots/<name>.cjs   # Playwright screenshots -> scripts/shots/out/ (installed locally, not a dependency)
```
Edit `src/`, then `npm run build && npm test` before committing.

## Hard requirements (from the user)
- One self-contained `.html`: no build step for users, no runtime dependencies, no network calls.
- YAML syntax identical to upstream, so files round-trip with the original CLI.
- WebHID upload (Chrome/Edge desktop) with the CLI-script fallback kept.
- `model:` is not in the UI; it is filled in from the connected keyboard.
- User hardware: 514c:8850 12-key/4-knob pads and a 1189:8890. Their YAML files use CRLF line endings.

## Invariants
- `src/core.js` = pure logic, **no DOM** (`test/core_purity.cjs`). Tests pull `<script id="core">` out of the built HTML and run it with `new Function`, so keep that id and the exported function names.
- Scripts are classic globals (`ui.js` calls `core.js` directly), not modules.
- `renderAll()` must end with `hidSync()`: on 514c:8850 the protocol depends on the layout (16 keys → 4×4 `8850`, otherwise 12-key `884x-514c`).
- When sources disagree, the **upstream** protocol is the authority. The exception is the 514c:8850 12-key pad, which follows the user's **fork**.
- Element IDs used by tests: HANDOFF.md §3.3. localStorage access is always wrapped in try/catch.
- localStorage keys are `ch57x-configurator-*`. Renaming a key means adding a migration in `src/theme-init.js` (HANDOFF.md §3.4), or users lose their saved mapping.

## Where to look (read only the section needed)
- HANDOFF.md §3: architecture and function map. §4: protocol decisions and device table. §5: per-key comments format. §6: test inventory. §7: open items. §10: pitfalls.
- `README.md`: repo layout.

## Pitfalls
- Assertions placed after `process.exit()` never run.
- `.gitattributes` (`text=auto`) stores text files with LF, so a fresh checkout has LF fixtures even when the working copy has CRLF. To test the user's CRLF files, convert in the test (`.replace(/\r?\n/g,'\r\n')`), and always split with `/\r?\n/`.
- In tall pages the sticky upload bar overlaps Playwright screenshots; use a taller viewport.

## Session start
- Do **not** ask the user the questions in HANDOFF.md §7 "Awaiting the user" at session start; the user will answer them when ready (decided 2026-11-19). Keep them listed in §7, record answers there when given, and remove each item once it is resolved.

## Housekeeping
- Commit as the repo's existing author, `daifukusensei`. Git has no global identity here, so pass `-c user.name=... -c user.email=...` (the email is in `git log`).
- `gh` is installed and logged in. Use it to check CI after a push (`gh run list`, `gh run watch`, `gh run view --log-failed`) and for PRs.
- Keep the docs current **in the same commit** as each change: this file (commands, invariants, pitfalls), HANDOFF.md (§3 architecture, §4 protocol, §6 tests, §7 open items, §9 history, §10 pitfalls), README.md (layout).
- Keep all project notes and instructions in these committed files, **not** in Claude Code's private memory directory (`~/.claude/projects/…/memory`). The user wants every Claude note versioned in the repo.
