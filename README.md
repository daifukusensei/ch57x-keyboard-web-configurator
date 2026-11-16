# CH57x Macropad Config Editor

A single-file web app for editing [ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool)
YAML mappings and uploading them straight to the keyboard over WebHID (Chrome/Edge desktop), with a
CLI-script fallback for other browsers.

**The deliverable is [`ch57x-config-editor.html`](ch57x-config-editor.html)**: one file, no dependencies, no
network. Open it in a browser. It is *built* from `src/`; don't edit it by hand.

## Layout

```
src/index.template.html   markup; lines like <!-- @inline core.js --> are replaced by src/core.js
src/style.css             styles
src/theme-init.js         applies the saved theme before first paint (in <head>)
src/core.js               pure logic, no DOM: validation, YAML, state, protocol, upload planner
src/ui.js                 DOM, palette, WebHID
src/theme-ui.js           theme toggle
build.mjs                 inlines src/ into ch57x-config-editor.html (zero dependencies)
test/                     suites (*.cjs) + run.mjs; they load the *built* HTML
test/fixtures/            user YAML, Rust oracle outputs + their action lists, pre-comments HTML, stub tool
test/reference/           ch57x-programmer TS reference bundled to ref.cjs (committed)
scripts/fetch-refs.sh     clones the reference repos into refs/ at pinned revisions + applies patches/
scripts/regen-oracles.sh  reruns the Rust harnesses to regenerate test/fixtures/*-oracle.txt (needs cargo)
scripts/shots/            Playwright screenshot scripts (visual QA; output in scripts/shots/out/)
patches/                  oracle harness patches for upstream and the fork
HANDOFF.md                architecture, protocol decisions, history, open items
```

## Develop

```sh
npm ci
# edit src/...
npm run build      # writes ch57x-config-editor.html; commit it together with src/
npm run check      # fails if the committed HTML is out of date (CI runs this)
npm test           # all suites; pass another HTML path to test that: npm test -- path/to.html
```

Each suite can also be run alone: `node test/oracle_cmp.cjs [html]`.

Keep `<script id="core">` in the template and keep `src/core.js` free of DOM globals
(`test/core_purity.cjs` enforces it): the suites extract that block and run it in plain Node.

### Reference implementations and oracles

```sh
npm run fetch-refs   # refs/ch57x-keyboard-tool, refs/ch57x-keyboard-tool-enhanced, refs/ch57x-programmer
npm run build:ref    # rebuild test/reference/ref.cjs from refs/ch57x-programmer
sh scripts/regen-oracles.sh   # needs a Rust toolchain
```

### Screenshots

```sh
npm i --no-save playwright && npx playwright install chromium
node scripts/shots/shot_notes.cjs
```
