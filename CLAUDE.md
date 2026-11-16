# CH57x Keyboard Web Configurator

Single-file web editor and WebHID uploader for [kriomant/ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool) YAML mappings.
The deliverable `ch57x-config-editor.html` is **built** from `src/`; never edit it by hand.

## Commands
```sh
npm ci
npm run build    # src/ -> ch57x-config-editor.html; commit both together
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

## Where to look (read only the section needed)
- HANDOFF.md §3: architecture and function map. §4: protocol decisions and device table. §5: per-key comments format. §6: test inventory. §7: open items. §10: pitfalls.
- `README.md`: repo layout.

## Pitfalls
- Assertions placed after `process.exit()` never run.
- Test fixtures are CRLF: split with `/\r?\n/`.
- In tall pages the sticky upload bar overlaps Playwright screenshots; use a taller viewport.

## Housekeeping
- Commit as the repo's existing author, `daifukusensei`. Git has no global identity here, so pass `-c user.name=... -c user.email=...` (the email is in `git log`).
- `gh` isn't installed and the repo is private, so CI status can't be checked from here. Ask the user.
- Open questions for the user are in HANDOFF.md §7 ("Awaiting the user").
- Keep the docs current **in the same commit** as each change: this file (commands, invariants, pitfalls), HANDOFF.md (§3 architecture, §4 protocol, §6 tests, §7 open items, §9 history, §10 pitfalls), README.md (layout).
