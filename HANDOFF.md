# CH57x Keyboard Web Configurator — handoff to Claude Code

*Written 2026-11-15 for the hand-over; updated the same day after the move to this repo (split into `src/` + `build.mjs`, tests in `test/`, CI). Source of truth for the code is now `src/`; `ch57x-keyboard-web-configurator.html` is the built single-file deliverable (see `README.md`).*

---

## 1. What this is

A **single-file, strictly-HTML** web app: a visual editor for the YAML mapping files used by
[kriomant/ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool), with **direct upload to the keyboard from the browser via WebHID** (no CLI needed). Name shown in the UI: **CH57x Keyboard Web Configurator** (renamed from *CH57x Macropad Config Editor* on 2026-11-15).

Hard requirements that came from the user and must be preserved:

1. **One `.html` file**, no build step, no runtime dependencies, no network calls.
2. **YAML syntax identical to the upstream tool**, so files round-trip with the original CLI (`validate` / `upload`).
3. **Direct upload from the browser** (Chrome/Edge desktop, WebHID), with the CLI-script fallback kept for other browsers.
4. The `model:` field is **not in the UI**; it is written into the YAML from the connected keyboard.
5. The user's own hardware: **514c:8850 12-key / 4-knob macropads** (and they have also used a **1189:8890** board). They use Windows-style (CRLF) YAML files.

Browser support: WebHID is Chrome/Edge desktop only. Linux needs a udev rule for the hidraw device.

---

## 2. Reference repositories (`npm run fetch-refs` clones them into `refs/`)

| Repo | Role | Revision used |
|---|---|---|
| `kriomant/ch57x-keyboard-tool` (upstream, Rust) | Authority for YAML syntax, action grammar and packet formats for 884x / 8890 / 8850 (4×4) | `bdbffca` "Add screen brightness and web page media keys (#190)" |
| `PollRobots/ch57x-programmer` (TypeScript) | Original WebHID reference; used as a second oracle for packet formats | `355e40f` "Writing to 8890 tested and functional" |
| `daifukusensei/ch57x-keyboard-tool-enhanced` (the **user's fork**) | The only source of the working protocol for the user's 514c:8850 **12-key/4-knob** pad | `fa28f19` |

Where sources disagree the editor follows **upstream**, except for the 514c:8850 12-key pad where it follows the **fork** (see §4.3).

---

## 3. Architecture of the HTML file

`build.mjs` inlines the `src/` files into `src/index.template.html`, giving one `<style>` and four inline `<script>` blocks, in this order:

| Block | Source | Purpose |
|---|---|---|
| `<style>` | `src/style.css` | All styles. |
| `<script id="theme-init">` (in `<head>`) | `src/theme-init.js` | Migrates renamed localStorage keys (§3.4), then applies the saved theme before first paint (no flash). |
| `<script id="core">` | `src/core.js` | **Pure logic, no DOM.** Action validation, YAML parse/export, state model, protocol encoders, upload planner, upload-script generator, `EXAMPLE` YAML. |
| `<script id="ui">` | `src/ui.js` | All DOM code: rendering, palette, events, WebHID connect/preview/upload, upload-script drawer, init. |
| `<script id="theme-ui">` | `src/theme-ui.js` | Theme toggle button. |

The scripts are classic (non-module) scripts sharing one global scope: `ui.js` calls `core.js` functions directly. `build.mjs` refuses a part that contains `</script` / `</style` or CR line endings.

**The test suites extract `<script id="core">` from the built HTML with a regex and run it with `new Function(...)`.** So: keep the `id="core"` tag, keep core free of `document`/`window` (`test/core_purity.cjs` enforces this), and keep the function names the tests import (listed below).

### 3.1 Core (important functions)

- **Validation**: `validateAction(raw)` → `{level:'ok'|'warn'|'error', kind:'empty'|'keys'|'media'|'mouse'|…, msgs[]}`; helpers `splitTop`, `splitDash`, `mouseParse`, `inRange` (mouse values clamp to **-127..127**).
- **YAML subset parser** (hand-written, no library): `stripComment`, `splitFlow`, `parseScalar`, `parseYaml`. Each parsed line is `{indent,text,comment}`; a trailing `# …` comment is kept (see §5).
- **State**: `blankLayer`, `normalizeState` (clamps rows/cols/knobs, forces exactly `LAYER_COUNT` = 3 layers by padding with blank ones or dropping extras, sizes every layer), `fromObj` (YAML object → state), `toYaml` (state → YAML). State shape:
  ```js
  { model, orientation, rows, columns, knobs,
    layers: [{ buttons: [[str]],            // R x C action strings
               knobs:   [{ccw,press,cw}],
               bnotes:  [[str]],            // R x C comments
               knotes:  [{ccw,press,cw}] }] }
  ```
- **Protocol**: `parseActionToMacro` (action string → macro), `keyIdFor`, `bind884x`, `bind8890`, `bind8850`, `bind884xFork`, `bindPackets(family,layer,key,macro)`, `familyWarnings`, `makeReport` (pads to 64 bytes), `buttonIndex` (orientation → hardware index), `planUpload(state,family,which)` → `{packets,items,skipped,errors,warnings}`.
- **Devices**: `DEVICES` table, `deviceInfo`, `familyFromProductId`, `resolveFamily(vid,pid,state)`.
- **Upload script**: `makeUploadScript(yaml, os, tool, sudo)` (sh / PowerShell fallback for non-WebHID browsers).

### 3.2 UI

QMK-Configurator-style layout (the user asked for "simplified, looks like QMK's"):

- Top nav (title, Help link, theme toggle: amber ☀ in dark mode / indigo ☾ in light mode, classes `.sun`/`.moon`) → layout settings card (orientation, rows, columns, knobs, "Load repo example", "New blank", one-line layout hint) → **layer column** (fixed tabs 1/2/3: no add/duplicate/remove, every CH57x board has 3 layers) beside a dark **"case"** with 3D keycaps (buttons grid + knobs drawn as dashed dials with ↺ ccw / ● press / ↻ cw) → status line + collapsible legend + **Show comments on keys** switch → **selected-key editor** (action text box, "Add as next chord", Clear, message area, **Comment** box) → **keycode palette** (tabs Basic / Media / Mouse / Advanced; Basic is a drawn **full-size keyboard**, see below) → sticky **upload bar** (Connect, Read device info, layers selector, Preview packets, Upload) → collapsed drawers: YAML (copy/download/import), CLI-script fallback, Help.
- Main render functions: `renderAll` → `renderSettings`, `renderTabs`, `renderDevice` (uses `cellEl`), `renderEditor`, `renderMsg`, `renderYaml`, then `hidSync()` (**required**: the protocol for 514c:8850 depends on the layout, so the info/upload buttons must be re-synced after any layout change).
- Palette: `buildControls`, `wirePalette`, `setPane`, `assignKey`, `assignMouse`, `applyAction`. Modifiers are one-shot chips; "Add as next chord" appends instead of replacing (palette caps a sequence at 5 chords; the validators allow more per family).
- **Basic-tab keyboard** (2026-11-16; only the key *picker*, the macropad drawing is unchanged): `kbGeometry(iso)` gives each key `[name,x,y,w,h]` in key units for a full-size board (main block, navigation cluster, numpad from `KB_NUMPAD_X` = 18.5u). `buildBoard()` draws them as `.kcap`s inside `#kbBoard`, each wrapper carrying `--x --y --w --h`; CSS turns those into percentages of `--kbw` (22.5u, or 18.25u under 700 px where the numpad `.np` keys are hidden and the same keycodes appear as a list in `#kbNumpad`). The board shrinks with `aspect-ratio` + container-query units, and below 760 px board width swaps long legends for `KB_SHORT`. Key names are positional HID usages, so a layout only changes the shape and legends: `KB_LAYOUTS` = `us` (ANSI) and `uk` (ISO: tall Enter, `nonushash` beside Enter, `nonusbackslash` beside a 1.25u Left Shift, UK legends `" £ @ ~ ¬ AltGr`). `detectKbLayout()` picks the first `KB_LAYOUTS[id].match` hitting `navigator.languages[0]` (`en-GB`/`en-UK`/`en-IE` → UK), else US; the `#kbLayout` select (Auto / US / UK) overrides it. Add a locale by adding a `KB_LAYOUTS` entry with `match` and `legend` overrides. Keycodes with no key on the current layout (`backslash` on ISO; `nonushash`/`nonusbackslash` on ANSI; `numpadequal` always) are listed in `#kbExtra`; F13–F24 stay a flat group in `#kbGroups`. The board's modifier keys carry `data-mod` and toggle the same one-shot chips as `#modChips` (`toggleMod`/`syncMods`), so `#modRow` is shown only on the Mouse tab. Page width (`main`, `.nav-in`) is 1240 px max (was 1100) so the full-size board keeps ~50 px keys.
- Delay: one button toggles **Apply delay option ↔ Remove delay option** (`syncDelayUi`, `DELAY_RE`).
- Confirmations (`confirm()`): Load repo example, New blank, and Clear (only when the action is non-empty).
- Theme: light/dark toggle, saved in `localStorage['ch57x-configurator-theme']`, defaults to system.

### 3.3 Element IDs the tests rely on (don't rename casually)

`orientation rows columns knobs btnExample btnBlank tabs device action actionMsg btnClear delay btnDelay yamlOut yamlIn btnImport fileIn btnCopy btnDownload hidConnect hidInfo hidLayers hidPreview hidUpload hidStatus hidPlan upOs upTool upSudo upSudoWrap btnUpScript btnUpCopy summary toast themeToggle editTitle seqMode modChips modRow ptab-* pane-* mx my mn mbtn msMove msDrag msWheel bhid hidCodeSet yamlDrawer cliDrawer help helpLink note showNotes showNotesWrap kbLayout kbBoard kbNumpad kbExtra kbGroups` plus classes `.cell .dial .tab .note .hasnote .kcap .isoenter` and `.kb.ansi`/`.kb.iso` on `#kbBoard`.

### 3.4 Persistence (localStorage, all wrapped in try/catch)

| Key | Contents |
|---|---|
| `ch57x-configurator-v1` | `{state, layerIdx}` — the whole mapping incl. comments |
| `ch57x-configurator-notes` | `'1'`/`'0'` — "Show comments on keys" preference (a viewer preference, not part of the mapping) |
| `ch57x-configurator-theme` | `'light'` / `'dark'` |
| `ch57x-configurator-kblayout` | `'auto'` (default, from the browser language) / `'us'` / `'uk'` — Basic-tab keyboard layout; an unknown value falls back to auto |

Until 2026-11-15 these were `ch57x-editor-v1`, `ch57x-editor-notes` and `ch57x-theme`. `src/theme-init.js` (the first script to run) copies an old value to its new key once, if the new key is empty. Old keys are kept so an older copy of the page still works. Renaming a key again needs the same kind of migration.

---

## 4. Protocol decisions

### 4.1 Device table

| USB id | Family key | YAML `model:` | Notes |
|---|---|---|---|
| 1189:8840, 1189:8842 | `884x` | `ch57x-1` | up to 3 knobs, 15 buttons, delay ≤ 6000 ms, ≤ 18 chords |
| 1189:8890 | `8890` | `ch57x-2` | up to 3 knobs, 12 buttons, **no delay support**, ≤ 6 chords |
| 514c:8850 | `8850` or `884x-514c` | `ch57x-3` | **two different keyboards share this id** (§4.3) |

WebHID details: filter on VID/PID **and** require an output report with `reportId === 3`; each 64-byte packet is sent with `sendReport(3, data)`; the leading `0x03` seen in the Rust sources is the report ID, so it is **not** in the editor's byte arrays. "Read device info" sends `fb fb fb` and reads an input report starting `0xfb` (buttons, encoders) — enabled for `884x` and `884x-514c` only.

### 4.2 Things settled during the work

- **Mouse range is -127..127** editor-wide (UI inputs, validator, upload parser). -128 is rejected on purpose (upstream oracle shows it as an intentional difference).
- **Alt mouse modifier = 0x04** (upstream), not 3 (ch57x-programmer). Verified against upstream output.
- **Delay on 1189:8890 is an error, not a bug.** The 8890 firmware has no delay; upstream, the fork and ch57x-programmer all refuse it. The editor now says so explicitly while editing (amber warning on the key) and at upload ("Cannot upload — Layer 1 R1 C1: …"). Triggered by the user report "1 action(s) cannot be uploaded — fix them first".
- **Mouse works on 8890** in upstream, the fork and the programmer. The fork sends `Move` as **(y,x)** on 8890 whereas upstream/programmer send **(x,y)**; the editor follows upstream. *Open question for the user: does their 8890 move on the wrong axis?*
- **Orientation**: `buttonIndex()` maps the grid position (as seen in the chosen orientation) to hardware index; knob order is reversed for `upsidedown` and `clockwise` (mirrors `reorient_row()` in the original tool).
- Empty actions are **skipped** on upload (whatever is on the keyboard for that key stays).

### 4.3 514c:8850 — the 12-key / 4-knob pad (`884x-514c`)

Ported from the user's fork (`src/keyboard/k884x.rs`, `Keyboard884x::bind_key`). Differences from upstream 884x:

- header byte is **always the chord count** (upstream writes 0 for a single modifier-only chord);
- every mouse action is `[5, modifier, button, x, y, wheel]`;
- a **click ignores its modifier** (editor warns via `familyWarnings`), **wheel is ±1 only**, **drag is unavailable**;
- **delay packet** = a full copy of the main packet with kind byte `5` and the delay in bytes 4–5 (max 6000 ms); a delay counts as one of the **max 18 entries**;
- **knob 4** uses key ids 13–15 (`keyIdFor`); max 4 knobs.

**Which keyboard is it?** The USB ids can't tell the 4×4 pad (upstream `k8850_4x4`, `ch57x-3`) from the 12-key pad, so `resolveFamily` decides by layout: `rows*columns === 16` → 4×4 (`8850`), otherwise `884x-514c`. The connect message says "— chosen from your layout".

> **Verified byte-for-byte against the fork's Rust output, but NOT tested on hardware by us.** The user should confirm on their device.

---

## 5. Per-key comments (the most recent feature, completed this session)

User request: *"Include the ability to add a comment to each key. Text prefaced with # are ignored… This would help knowing what each key does when importing a file."* (attached `daise_514C-8850.yaml`, CRLF line endings.)

**File convention (matches the user's file):**

- **Button rows** carry **one** trailing comment with **one note per key, `;`-separated, in column order**:
  `- ["shift-f4", "ctrl-grave,4,2", "alt-4"]   # IntelliJ split; IntelliJ zen; IntelliJ hide tools`
- **Knob lines** carry their own comment on each of `ccw:` / `press:` / `cw:`.

**Implementation:**

- Parser: `parseYaml` stores `comment` on each line; `parseSeq` copies it onto flow-sequence rows (`arr.comment`) and across `- key: value` lines; `parseMap` stores per-key comments on a **non-enumerable** `__notes` property.
- `splitRowNotes(text, n)` splits a row comment into `n` notes (gaps keep positions; extras beyond `n` are joined onto the last key; trailing `;` adds nothing).
- Export: `toYaml` aligns the `#` column per block; `rowNote()` joins notes with `; `, trims trailing empties, and **turns a `;` typed inside a non-last note into `,`** (otherwise it would shift later notes). Knob notes may contain `;`.
- UI: **Comment** input under the action (`#note`, `getNote/setNote`), dot on commented keys (`.hasnote`), **Show comments on keys** (`#showNotes`) swaps the keycap text to the comment with the action in small type beneath (`.device.notes`, CSS vars `--cw/--ch`). Importing a file with comments auto-enables the view and the toast says e.g. `Loaded daise_….yaml · 30 comments on keys`. *Clear* clears only the action. Resizing keeps comments on their keys.
- Backward compatible: a mapping with no comments exports **byte-identically** to the previous version (apart from the `# Generated by …` header line, which changed with the 2026-11-15 rename); saved state from older versions gets empty notes (`normalizeState`).

**Known limits (told to the user):** header comments and any comment not attached to a key row/knob line are dropped on export; `;` in a non-last button note becomes `,`.

---

## 6. Test and verification inventory

`npm test` runs every `test/*.cjs` against the built `ch57x-keyboard-web-configurator.html` (pass another path with `npm test -- other.html`); each suite also runs alone with `node test/<suite>.cjs [html]`. CI (`.github/workflows/test.yml`) runs `npm ci`, `npm run check` (built HTML up to date with `src/`) and `npm test`; a second job `oracles` installs Rust, runs `fetch-refs.sh` + `regen-oracles.sh` and fails if `test/fixtures` changes.

| Suite | Checks | Result |
|---|---|---|
| `test_core.cjs` | core parse/validate/YAML round-trip, range -127..127, upload-parser limits | `ALL PASSED` |
| `oracle_cmp.cjs` | JS packets vs **upstream Rust** output (`fixtures/upstream-oracle.txt`) for drivers 884x/8890/8850, layers 0 & 2, 8 key positions × 70 actions | 1040 ok / 0 bad per family; 0 differing; 0 orientation mismatches; only intentional `-128` rejections |
| `fork_cmp.cjs` | JS 12-key protocol vs **fork Rust** output (`fixtures/fork-oracle.txt`) | `ALL OK` |
| `compare.cjs` | JS vs **ch57x-programmer TS reference** (`reference/ref.cjs`, bundled from `reference/ref_entry.ts` by `npm run build:ref`) | `1460 checks, 0 failed` |
| `notes_test.cjs` | comment parse/export/round-trip/edge cases using `fixtures/user.yaml`; backward compatibility against `fixtures/before-comments.html`; writes `fixtures/exported.yaml` | `ALL PASSED` |
| `ui_notes_test.cjs` | comment UI end-to-end (jsdom) | `ALL PASSED` |
| `ui_test_kblayout.cjs` | Basic-tab keyboard: ANSI for `en-US`, ISO + UK legends for `en-GB`/`en-IE`, 104/105 keys incl. numpad, phone numpad list matches, saved override, board modifiers, every former palette keycode still offered once (ignoring the phone list) | `ALL PASSED` |
| `ui_test.cjs`, `ui_test3.cjs`, `ui_test8890.cjs`, `ui_test_palette.cjs`, `confirm_test.cjs`, `theme_test.cjs`, `delay_clear_test.cjs` | UI flows with **mocked WebHID devices** (jsdom), palette, confirmations, theme, delay toggle, 8890 behaviour | `ALL PASSED` |
| `delay8890.cjs` | delay limits per family at upload (≤ 6000 ms; error on 8890; 4×4 8850 drops the delay like upstream, with a warning) | `ALL PASSED` |
| `upload_script_test.cjs` | CLI-fallback `upload.sh` run end to end with the stub `fixtures/it's-tool` (quoting, validate-before-upload, failure stops upload); `upload.ps1` content | `ALL PASSED` |
| `storage_migration_test.cjs` | values under the old localStorage keys are carried over to the renamed ones; existing new keys win; old keys kept | `ALL PASSED` |
| `core_purity.cjs` | `src/core.js` uses no DOM/browser globals | `ALL PASSED` |
| `scripts/shots/*.cjs` (Playwright, not in CI) | screenshots for visual QA (desktop/mobile, light/dark; no horizontal page scroll at 320/360 px), written to `scripts/shots/out/` | visual only; all 5 run and reviewed 2026-11-15, no horizontal scroll at 320–1100 px. `shot_kb.cjs` (US/UK × light/dark × 1300/1100/360 px) added and reviewed 2026-11-16 |

Regenerating the Rust oracles: `npm run fetch-refs` clones upstream, the fork and ch57x-programmer into `refs/` at the pinned revisions and applies `patches/*-oracle-harness.patch` (a `#[cfg(test)] mod oracle` with `oracle::dump` in `src/keyboard/mod.rs`; the fork also gets `oracle::bind` in `k884x.rs`). Then `sh scripts/regen-oracles.sh` (needs cargo) runs those tests with `ORACLE_ACTIONS=test/fixtures/{upstream,fork}-actions.txt` and writes the `ORACLE|` / `FORK|` lines to `test/fixtures/{upstream,fork}-oracle.txt`. *Verified 2026-11-15: the patched clones are byte-identical to the copies used originally, and the user's local run of `regen-oracles.sh` reproduced both oracle files exactly. The CI job `oracles` repeats this on every push.*

Dependencies (root `package.json`, dev only): `jsdom`, `esbuild`, `zod` (zod only for `build:ref`). Playwright is not a dependency; see `README.md`.

---

## 7. Remaining tasks / open items

**Awaiting the user**
1. The user's message *"Two things: * mouse movement is only in the range of -127 to 127"* arrived with the **second bullet missing**. Ask what it was.
2. Does `move(x,y)` go the wrong way on their **1189:8890**? If yes, switch that family to the fork's (y,x) order.
3. **Hardware confirmation** that the 514c:8850 12-key upload (ported from their fork) behaves on their device.
3a. **Delay on the 4×4 514c:8850.** The user says the 4×4 pad supports delays, but upstream (even latest `master`), the fork and ch57x-programmer have no 4×4 delay encoding. Since 2026-11-15 the editor warns (amber, while editing with a 4×4 connected + upload preview/confirm) that the delay is dropped. To implement it, ask for a **USB capture** (Wireshark + USBPcap) of the vendor software programming `a` with 100 ms and 1000 ms delays plus plain `a`; a best-guess 884x-style packet tested on hardware is the fallback.

**Optional features discussed but not built**
4. Export in the **fork's YAML syntax** (`delay[ms]`, `mousemove[x,y]`) as an alternative to upstream syntax (editor currently only writes upstream syntax; the fork-syntax mapping exists in `test/fork_cmp.cjs: toEditor()`).
5. Preserve **file-header comments** on re-export (currently dropped).
6. LEDs are deliberately **out of scope** (separate CLI command, not in the YAML); Help mentions them.

**Engineering clean-up** — 7–10 done 2026-11-15 on branch `repo-split`
7. ~~Split into `src/` + inlining build, CI.~~ Done: `build.mjs`, `.github/workflows/test.yml`.
8. ~~Parameterise the tests.~~ Done: all resolve paths from their own location and accept an HTML path as `argv[2]`.
9. ~~Delete `qmk/assemble.py`.~~ Done, together with the rest of the stale `qmk/` redesign files.
10. ~~Make the oracles reproducible.~~ Done via `patches/` + `scripts/fetch-refs.sh` + `scripts/regen-oracles.sh` (cargo step untested here).
11. Consider a smoke test of the real WebHID path with a physical device (everything so far uses mocks).

---

## 8. File map

See the layout in `README.md`. The old scratchpad bundle was reorganised as follows: `tools/*.cjs` and `test_core.js` → `test/`; `notes/`, `orig/*.txt`, `fork/*.txt`, `qmk/before-qmk-style.html`, `up/it's-tool` → `test/fixtures/`; `tools/ref.cjs`, `ref_entry.ts` → `test/reference/`; `shot*.js` → `scripts/shots/`; `gen.js` + `up/` → `test/upload_script_test.cjs`. The vendored clones (`orig/src`, `fork/src`, `pr/src`) were replaced by `scripts/fetch-refs.sh`; the old screenshots, `qmk/` working files and `shot_qmk*.js` were dropped (all still in git history before `repo-split`).

---

## 9. History of requests (for context, chronological)

1. Build a web frontend for the Rust tool, strictly HTML → add automatic upload.
2. Leverage `ch57x-programmer` to upload from the browser while **keeping the original YAML syntax**.
3. Questions about where "only 3 knobs" came from; removed the **model dropdown** (kept `model:` in YAML, filled from the connected device); **added ch57x-3 (514c:8850)**.
4. Same confirmation dialog for *Load repo example* as for *New blank*; **light/dark theme toggle**; reworded layout hint + 4-line legend (explaining "R1 C1" etc.); **renamed** to *CH57x Macropad Config Editor*; confirm before *Clear*; **Apply ↔ Remove delay** button.
5. **Support for the user's 514c:8850 12-key/4-knob pads** by porting their fork's protocol.
6. Mouse range **-127..127**; the **8890 delay** error explained and made explicit; confirmed mouse is supported on 8890.
7. **QMK-style interface redesign.**
8. **Per-key comments** (§5), completed and delivered.
9. Moved to this git repo (2026-11-15): tests made path-independent; split into `src/` + `build.mjs`; tests moved to `test/`; reference repos fetched instead of vendored; CI added (tests + oracle reproducibility); 4×4 514c:8850 delay warning; `CLAUDE.md` added.
10. **Renamed** to *CH57x Keyboard Web Configurator* (page title, heading, `# Generated by` header in exported YAML and upload scripts). 
11. **Renamed the rest** (2026-11-15): the deliverable is now `ch57x-keyboard-web-configurator.html`, the npm package is `ch57x-keyboard-web-configurator`, and localStorage keys are `ch57x-configurator-*`, with a one-time migration from the old keys (§3.4).
12. (2026-11-16) Theme toggle tinted (amber sun / indigo moon). **Layers fixed at 3** (the CH57x maximum): add/duplicate/remove removed; imports and saved state are padded to 3, and a file with more than 3 layers keeps the first 3 (the import toast says so). Blank layers upload nothing, since empty keys are skipped.
13. (2026-11-16, branch `feature/physical-keyboard-layout`) Basic-tab key picker drawn as a **physical keyboard** whose shape and legends follow the browser language (UK ISO vs US ANSI), with a manual override. User's choices: replace the groups the board covers; shrink on small screens; hover unchanged; macropad drawing unchanged; more locales may come later. First built tenkeyless, then (same day, on request) full-size with the numpad on the board, page widened to 1240 px; on phones the numpad drops to a list. Light mode's macropad case lightened from near-black to slate grey (`--case` #c6cdd7, new `--case-inset` for the inner shadow) because the dark case clashed with the light page; dark mode unchanged.

---

## 10. Pitfalls already hit (so you don't repeat them)

- New assertions placed **after `process.exit(...)`** silently never run.
- After a layout change the Connect/Info buttons went stale → `renderAll()` must end with `hidSync()`.
- Byte offsets in UI tests changed when the protocol started depending on layout (e.g. `slice(9,15)==='5,0,1,0,0,0'` for the 12-key click).
- Small keycaps broke long names mid-word (`wheeldown`) — knob caps are 64×56 / round 66 px with a 9.5 px font.
- Playwright screenshots: the sticky upload bar overlaps lower content in short-viewport screenshots — a screenshot artefact, not a layout bug (use a taller viewport).
- A test that strips comments with `/\s+#.*$/` fails on CRLF input; use `split(/\r?\n/)`. The editor itself handles CRLF.
- Numpad keycodes exist twice in `#pane-basic` (board + the phone list `#kbNumpad`); uniqueness checks must exclude `#kbNumpad *`.
- `[data-mod="ctrl"]` matches two buttons (the hidden `#modChips` chip and the Basic-tab keyboard key); scope selectors with `#kbBoard` or `#modChips`, or Playwright waits forever on the hidden one.
- Don't commit or share anything that depends on `localStorage` surviving: every access is wrapped in try/catch and the page must render without it.
